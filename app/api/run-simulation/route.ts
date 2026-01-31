import { NextRequest, NextResponse } from "next/server";
import {
  runAllProbes,
  loadPrompts,
  setMode,
  setSeed,
} from "@/src/lib/probe-runner";
import { getEnhancedRules, evaluateAllRules } from "@/src/lib/rules-engine";
import { buildBreakFirstTimeline } from "@/src/lib/timeline";
import {
  runAnalysis,
  runComparisons,
  runDistributions,
} from "@/src/lib/analysis";
import type { ProbeConfig } from "@/src/types";

const PROMPTS_PATH = "data/prompts/prompt-suite.json";

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
    // promptFamily filtering will be applied in A4; for now use all prompts
    const prompts =
      promptFamily && promptFamily !== "all"
        ? allPrompts.filter((p) => p.family === promptFamily)
        : allPrompts;

    const configs: ProbeConfig[] = [configA, configB];

    const results = await runAllProbes(configs, prompts);

    const configMap = new Map(configs.map((c) => [c.id, c]));
    const rules = getEnhancedRules(configMap);
    const events = evaluateAllRules(results, rules);

    const timeline = buildBreakFirstTimeline(events);

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
      },
      { status: 500 }
    );
  }
}
