import { NextRequest, NextResponse } from "next/server";
import {
  runAllProbes,
  loadPrompts,
  setMode,
  setSeed,
  filterPromptsByFamily,
} from "@/src/lib/probe-runner";
import { getEnhancedRules, evaluateAllRules } from "@/src/lib/rules-engine";
import { buildBreakFirstTimeline } from "@/src/lib/timeline";
/**
 * API Route: Run Simulation
 * POST /api/run-simulation
 *
 * Runs the probe pipeline (simulate mode) with the provided configs,
 * evaluates rules, and returns analysis, comparisons, and distributions
 * for the dashboard.
 *
 * Request body: { configA, configB, seed?: number, promptFamily?: string }
 * Response: { analysis, comparisons, distributions }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadPrompts,
  runAllProbes,
  setMode,
  setSeed,
} from "../../../src/lib/probe-runner";
import { getEnhancedRules, evaluateAllRules } from "../../../src/lib/rules-engine";
import {
  runAnalysis,
  runComparisons,
  runDistributions,
} from "@/src/lib/analysis";
import type { ProbeConfig } from "@/src/types";

const PROMPTS_PATH = "data/prompts/prompt-suite.json";
} from "../../../src/lib/analysis";
import { clearTelemetry } from "../../../src/lib/telemetry-logger";
import type { ProbeConfig, PromptRecord } from "../../../src/types";

export const maxDuration = 60; // Allow up to 60s for 400 probes in simulate mode

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      configA,
      configB,
      promptFamily,
      seed = 42,
    }: {
      configA: ProbeConfig;
      configB: ProbeConfig;
      promptFamily?: string;
      seed?: number;
    } = body;
    const { configA, configB, seed = 42, promptFamily } = body;

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

    setMode("simulate");
    setSeed(seed);

    const allPrompts = loadPrompts(PROMPTS_PATH);
    const prompts = filterPromptsByFamily(allPrompts, promptFamily || "all");

    const configs: ProbeConfig[] = [configA, configB];

    const results = await runAllProbes(configs, prompts);

    const configMap = new Map(configs.map((c) => [c.id, c]));
    const rules = getEnhancedRules(configMap);
    const events = evaluateAllRules(results, rules);

    const timeline = buildBreakFirstTimeline(events);

    // Validate required config fields
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

    const configs: ProbeConfig[] = [configA as ProbeConfig, configB as ProbeConfig];

    setMode("simulate");
    setSeed(Number(seed) || 42);
    clearTelemetry();

    let prompts: PromptRecord[] = [];
    try {
      prompts = loadPrompts("data/prompts/prompt-suite.json");
    } catch (e) {
      return NextResponse.json(
        {
          error: "Failed to load prompts",
          message: e instanceof Error ? e.message : String(e),
        },
        { status: 500 }
      );
    }

    if (promptFamily && promptFamily !== "all") {
      const filtered = prompts.filter((p) => p.family === promptFamily);
      if (filtered.length > 0) prompts = filtered;
      // If filter matched nothing (e.g. UI sent "long-context" but suite has "long_plain"), use all prompts
    }
    if (prompts.length === 0) {
      return NextResponse.json(
        { error: "No prompts to run (check prompt suite path)" },
        { status: 400 }
      );
    }

    const results = await runAllProbes(configs, prompts);
    const configMap = new Map<string, ProbeConfig>(
      configs.map((c) => [c.id, c])
    );
    const rules = getEnhancedRules(configMap);
    const events = evaluateAllRules(results, rules);

    const analysis = runAnalysis(events, prompts);
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
    console.error("Run simulation failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Simulation failed",
    });
  } catch (error) {
    console.error("Run simulation error:", error);
    return NextResponse.json(
      {
        error: "Simulation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
