/**
 * API Route: Run Simulation
 * POST /api/run-simulation
 *
 * Runs the probe pipeline with the provided configs,
 * evaluates rules, and returns analysis, comparisons, distributions,
 * and timeline for the dashboard.
 *
 * Request body: { configA, configB, seed?: number, promptFamily?: string, mode?: "simulate" | "real" }
 * Response: { analysis, comparisons, distributions, timeline }
 * 
 * mode: "simulate" (default) - uses generated telemetry, "real" - calls actual LLM APIs
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadPrompts,
  runAllProbes,
  setMode,
  setSeed,
  filterPromptsByFamily,
} from "@/src/lib/probe-runner";
import { getAdaptiveRules, evaluateAllRules } from "@/src/lib/rules-engine";
import { buildBreakFirstTimeline } from "@/src/lib/timeline";
import {
  runAnalysis,
  runComparisons,
  runDistributions,
  computeTrialsPerConfig,
} from "@/src/lib/analysis";
import { clearTelemetry } from "@/src/lib/telemetry-logger";
import type { ProbeConfig, PromptRecord, ProbeResult, FailureEvent } from "@/src/types";

const PROMPTS_PATH = "data/prompts/prompt-suite.json";

export const maxDuration = 120;

/** Log k/n/phat per config to verify Task 2 (failure rate calculation). */
function logAnalysisKn(analysis: { configs: Record<string, { config_id: string; k: number; n: number; phat: number; low_sample_warning?: boolean }> }): void {
  for (const [id, s] of Object.entries(analysis.configs)) {
    const warn = s.low_sample_warning ? " [low_sample_warning]" : "";
    console.log(`[run-simulation] Analysis ${id}: k=${s.k} n=${s.n} phat=${(s.phat * 100).toFixed(2)}%${warn}`);
  }
}

/** Log per-result rule evaluation for debugging Problem 5 (all failure modes). */
function logRuleEvaluationSummary(
  results: ProbeResult[],
  events: FailureEvent[],
  maxSampleLogs: number = 5
): void {
  const eventsByKey = new Map<string, FailureEvent[]>();
  for (const e of events) {
    const key = `${e.prompt_id}:${e.config_id}`;
    if (!eventsByKey.has(key)) eventsByKey.set(key, []);
    eventsByKey.get(key)!.push(e);
  }
  const modeCounts = new Map<string, number>();
  for (const e of events) {
    modeCounts.set(e.failure_mode, (modeCounts.get(e.failure_mode) ?? 0) + 1);
  }
  console.log("[run-simulation] Rules: evaluating", results.length, "results →", events.length, "failure events");
  console.log("[run-simulation] Failure modes detected:", Object.fromEntries([...modeCounts.entries()].sort((a, b) => b[1] - a[1])));
  let logged = 0;
  for (const r of results) {
    if (logged >= maxSampleLogs) break;
    const key = `${r.prompt_id}:${r.config_id}`;
    const resultEvents = eventsByKey.get(key) ?? [];
    const modes = resultEvents.map((e) => e.failure_mode).join(", ") || "none";
    console.log(
      `[run-simulation]   ${r.prompt_id} ${r.config_id}: context_usage=${(r.context_usage * 100).toFixed(1)}% latency=${r.telemetry.latency_ms}ms cost=$${r.estimated_cost.toFixed(4)} tool_timeouts=${r.telemetry.tool_timeouts} → ${modes}`
    );
    logged++;
  }
} // Allow up to 120s (2 minutes) for probes - simulate mode is fast (~20s), real mode optimized to <1min

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      configA,
      configB,
      promptFamily,
      runSize = "full",
      seed = 42,
      mode = "simulate",
    }: {
      configA: ProbeConfig;
      configB: ProbeConfig;
      promptFamily?: string;
      runSize?: "quick" | "full";
      seed?: number;
      mode?: "simulate" | "real";
    } = body;

    if (!configA || !configB) {
      return NextResponse.json(
        { error: "configA and configB are required" },
        { status: 400 }
      );
    }

    if (!configA.id || !configB.id) {
      return NextResponse.json(
        { error: "configA.id and configB.id are required" },
        { status: 400 }
      );
    }

    // Normalize config fields to numbers (form inputs can send strings)
    const normalizeConfig = (c: ProbeConfig): ProbeConfig => ({
      ...c,
      context_window: Number(c.context_window) || 0,
      top_k: Number(c.top_k) || 0,
      chunk_size: Number(c.chunk_size) || 0,
      max_output_tokens: Number(c.max_output_tokens) || 0,
      temperature: Number(c.temperature) ?? 0,
      cost_per_1k_tokens: Number(c.cost_per_1k_tokens) ?? 0,
      tools_enabled: Boolean(c.tools_enabled),
    });
    const normalizedA = normalizeConfig(configA as ProbeConfig);
    const normalizedB = normalizeConfig(configB as ProbeConfig);

    // Log received configs so we can verify UI sends updated values
    console.log("[run-simulation] configA:", {
      id: normalizedA.id,
      tools_enabled: normalizedA.tools_enabled,
      context_window: normalizedA.context_window,
    });
    console.log("[run-simulation] configB:", {
      id: normalizedB.id,
      tools_enabled: normalizedB.tools_enabled,
      context_window: normalizedB.context_window,
    });

    const required = [
      "id",
      "model",
      "context_window",
      "top_k",
      "chunk_size",
      "max_output_tokens",
      "tools_enabled",
      "temperature",
      "cost_per_1k_tokens",
    ];
    for (const key of required) {
      if (!(key in normalizedA) || !(key in normalizedB)) {
        return NextResponse.json(
          { error: `Both configs must have "${key}"` },
          { status: 400 }
        );
      }
    }

    setMode(mode);
    setSeed(Number(seed) || 42);
    clearTelemetry();

    let prompts: PromptRecord[] = [];
    try {
      prompts = loadPrompts(PROMPTS_PATH);
    } catch (e) {
      return NextResponse.json(
        {
          error: "Failed to load prompts",
          message: e instanceof Error ? e.message : String(e),
        },
        { status: 500 }
      );
    }

    const filtered = filterPromptsByFamily(prompts, promptFamily || "all");
    // If filter matched no family (e.g. UI sent "long-context" but suite has "short_plain"), use all prompts
    prompts = filtered.length > 0 ? filtered : prompts;
    // Quick run: 20 prompts. Full run: 200 prompts (consistent with UI "Full (200 prompts)").
    if (runSize === "quick") {
      prompts = prompts.slice(0, 20);
    } else if (runSize === "full") {
      prompts = prompts.slice(0, 200);
    }
    if (prompts.length === 0) {
      return NextResponse.json(
        { error: "No prompts to run (check prompt suite path)" },
        { status: 400 }
      );
    }

    const configs: ProbeConfig[] = [normalizedA, normalizedB];
    const results = await runAllProbes(configs, prompts);
    const configMap = new Map<string, ProbeConfig>(
      configs.map((c) => [c.id, c])
    );
    const configIds = configs.map(c => c.id);
    const trialsPerConfig = computeTrialsPerConfig(results);

    // Cost vs reliability: precompute bands (fewer combos to avoid timeout)
    const costMults = [1, 2, 3] as const;
    const latencyMults = [1, 2] as const;
    const costBands: Record<string, { analysis: ReturnType<typeof runAnalysis>; comparisons: ReturnType<typeof runComparisons>; distributions: ReturnType<typeof runDistributions> }> = {};

    for (const c of costMults) {
      for (const l of latencyMults) {
        const rules = getAdaptiveRules(configMap, results, c, l);
        const events = evaluateAllRules(results, rules);
        const analysis = runAnalysis(events, prompts, configIds, trialsPerConfig);
        const statsList = Object.values(analysis.configs);
        const comparisons = runComparisons(statsList);
        const distributions = runDistributions(events, prompts);
        costBands[`${c}_${l}`] = { analysis, comparisons, distributions };
      }
    }

    const { analysis, comparisons, distributions } = costBands["1_1"];
    const rules1x = getAdaptiveRules(configMap, results, 1, 1);
    const events1x = evaluateAllRules(results, rules1x);
    logRuleEvaluationSummary(results, events1x);
    const timeline = buildBreakFirstTimeline(events1x);
    logAnalysisKn(analysis);

    return NextResponse.json({
      analysis,
      comparisons,
      distributions,
      timeline,
      configA: normalizedA,
      configB: normalizedB,
      costBands,
    });
  } catch (err) {
    console.error("Run simulation error:", err);
    return NextResponse.json(
      {
        error: "Simulation failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
