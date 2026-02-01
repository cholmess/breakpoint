/**
 * API Route: Run Simulation (Streaming)
 * POST /api/run-simulation/stream
 *
 * Same input as run-simulation; returns Server-Sent Events:
 * - "probe" events: { type, index, total, config_id, prompt_id } as each probe completes
 * - "done" event: { type, analysis, comparisons, distributions, timeline, configA, configB, costBands, probeOutcomes }
 * - "error" event: { type, message } on failure
 */

import { NextRequest } from "next/server";
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
import type { ProbeConfig, PromptRecord, FailureEvent } from "@/src/types";

const PROMPTS_PATH = "data/prompts/prompt-suite.json";

export const maxDuration = 120;

function sseLine(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: {
    configA: ProbeConfig;
    configB: ProbeConfig;
    promptFamily?: string;
    runSize?: "quick" | "full";
    seed?: number;
    mode?: "simulate" | "real";
  };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const {
    configA: rawA,
    configB: rawB,
    promptFamily,
    runSize = "full",
    seed = 42,
    mode = "simulate",
  } = body;

  if (!rawA || !rawB || !rawA.id || !rawB.id) {
    return new Response(
      JSON.stringify({ error: "configA and configB with ids are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

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
  const configA = normalizeConfig(rawA as ProbeConfig);
  const configB = normalizeConfig(rawB as ProbeConfig);

  const required = [
    "id", "model", "context_window", "top_k", "chunk_size",
    "max_output_tokens", "tools_enabled", "temperature", "cost_per_1k_tokens",
  ];
  for (const key of required) {
    if (!(key in configA) || !(key in configB)) {
      return new Response(
        JSON.stringify({ error: `Both configs must have "${key}"` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        setMode(mode);
        setSeed(Number(seed) || 42);
        clearTelemetry();

        let prompts: PromptRecord[] = [];
        try {
          prompts = loadPrompts(PROMPTS_PATH);
        } catch (e) {
          controller.enqueue(encoder.encode(sseLine({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          })));
          controller.close();
          return;
        }

        const filtered = filterPromptsByFamily(prompts, promptFamily || "all");
        prompts = filtered.length > 0 ? filtered : prompts;
        if (runSize === "quick") prompts = prompts.slice(0, 20);
        else if (runSize === "full") prompts = prompts.slice(0, 200);

        if (prompts.length === 0) {
          controller.enqueue(encoder.encode(sseLine({
            type: "error",
            message: "No prompts to run",
          })));
          controller.close();
          return;
        }

        const configs: ProbeConfig[] = [configA, configB];
        const configMap = new Map<string, ProbeConfig>(configs.map((c) => [c.id, c]));
        const configIds = configs.map((c) => c.id);

        const promptById = new Map(prompts.map((p) => [p.id, p]));
        /** In simulate mode, delay between events so the UI shows 1/40, 2/40, ... line by line. Real mode has natural pacing. */
        const streamDelayMs = mode === "simulate" ? 15 : 0;
        const results = await runAllProbes(
          configs,
          prompts,
          undefined,
          async (completed, total, result) => {
            const prompt = promptById.get(result.prompt_id);
            controller.enqueue(encoder.encode(sseLine({
              type: "probe",
              index: completed,
              total,
              config_id: result.config_id,
              prompt_id: result.prompt_id,
              family: prompt?.family ?? "",
              use_case: prompt?.use_case ?? "",
            })));
            if (streamDelayMs > 0) await new Promise((r) => setTimeout(r, streamDelayMs));
          }
        );

        const trialsPerConfig = computeTrialsPerConfig(results);
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
        const events = evaluateAllRules(results, rules1x);
        const timeline = buildBreakFirstTimeline(events);

        const eventsByKey = new Map<string, FailureEvent[]>();
        for (const e of events) {
          const key = `${e.config_id}:${e.prompt_id}`;
          if (!eventsByKey.has(key)) eventsByKey.set(key, []);
          eventsByKey.get(key)!.push(e);
        }
        const probeOutcomes = results.map((r) => ({
          config_id: r.config_id,
          prompt_id: r.prompt_id,
          failure_modes: [...new Set((eventsByKey.get(`${r.config_id}:${r.prompt_id}`) ?? []).map((e) => e.failure_mode))],
        }));

        controller.enqueue(encoder.encode(sseLine({
          type: "done",
          analysis,
          comparisons,
          distributions,
          timeline,
          configA,
          configB,
          costBands,
          probeOutcomes,
        })));
      } catch (err) {
        controller.enqueue(encoder.encode(sseLine({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
