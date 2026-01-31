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
import { getEnhancedRules, evaluateAllRules } from "@/src/lib/rules-engine";
import { buildBreakFirstTimeline } from "@/src/lib/timeline";
import {
  runAnalysis,
  runComparisons,
  runDistributions,
} from "@/src/lib/analysis";
import { clearTelemetry } from "@/src/lib/telemetry-logger";
import type { ProbeConfig, PromptRecord } from "@/src/types";

const PROMPTS_PATH = "data/prompts/prompt-suite.json";

export const maxDuration = 60; // Allow up to 60s for probes (simulate mode is fast, real mode may need longer)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      configA,
      configB,
      promptFamily,
      seed = 42,
      mode = "simulate",
    }: {
      configA: ProbeConfig;
      configB: ProbeConfig;
      promptFamily?: string;
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
      if (!(key in configA) || !(key in configB)) {
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
    if (prompts.length === 0) {
      return NextResponse.json(
        { error: "No prompts to run (check prompt suite path)" },
        { status: 400 }
      );
    }

    const configs: ProbeConfig[] = [configA as ProbeConfig, configB as ProbeConfig];
    const results = await runAllProbes(configs, prompts);
    const configMap = new Map<string, ProbeConfig>(
      configs.map((c) => [c.id, c])
    );
    const rules = getEnhancedRules(configMap);
    const events = evaluateAllRules(results, rules);
    const timeline = buildBreakFirstTimeline(events);

    const configIds = configs.map(c => c.id);
    const analysis = runAnalysis(events, prompts, configIds);
    const statsList = Object.values(analysis.configs);
    const comparisons = runComparisons(statsList);
    const distributions = runDistributions(events, prompts);

    return NextResponse.json({
      analysis,
      comparisons,
      distributions,
      timeline,
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
