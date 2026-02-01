/**
 * API Route: Check Prompt (What-if)
 * POST /api/check-prompt
 *
 * Runs a single pasted prompt through one config using the same rules as simulation.
 * Returns which failure modes would trigger.
 *
 * Request body: { promptText: string, config: Config, mode?: "simulate" | "real" }
 * Response: { failure_modes: string[], pass: boolean, mode_used: "simulate" | "real", details?: { events } }
 */

import { NextRequest, NextResponse } from "next/server";
import { runProbe, setMode, setSeed } from "@/src/lib/probe-runner";
import { getEnhancedRules, evaluateRules } from "@/src/lib/rules-engine";
import type { ProbeConfig, PromptRecord, FailureEvent } from "@/src/types";

export const maxDuration = 30;

function toProbeConfig(c: {
  id: string;
  model: string;
  context_window: number;
  top_k: number;
  chunk_size: number;
  max_output_tokens: number;
  tools_enabled: boolean;
  temperature: number;
  cost_per_1k_tokens: number;
}): ProbeConfig {
  return {
    id: c.id,
    model: c.model,
    context_window: Number(c.context_window) || 8192,
    top_k: Number(c.top_k) || 10,
    chunk_size: Number(c.chunk_size) || 512,
    max_output_tokens: Number(c.max_output_tokens) || 2048,
    tools_enabled: Boolean(c.tools_enabled),
    temperature: Number(c.temperature) ?? 0.7,
    cost_per_1k_tokens: Number(c.cost_per_1k_tokens) ?? 0.03,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { promptText, config, mode = "simulate" }: { promptText?: string; config?: unknown; mode?: "simulate" | "real" } = body;
    const runMode = mode === "real" ? "real" : "simulate";

    if (typeof promptText !== "string" || !promptText.trim()) {
      return NextResponse.json(
        { error: "promptText is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!config || typeof config !== "object" || !("id" in config) || !("model" in config)) {
      return NextResponse.json(
        { error: "config is required with id, model, context_window, etc." },
        { status: 400 }
      );
    }

    const probeConfig = toProbeConfig(config as Parameters<typeof toProbeConfig>[0]);
    const promptRecord: PromptRecord = {
      id: "check-prompt",
      family: "what_if",
      use_case: "check",
      prompt: promptText.trim(),
      expects_tools: false,
      expects_citations: false,
    };

    setMode(runMode);
    setSeed(42);

    const result = await runProbe(probeConfig, promptRecord);
    const configMap = new Map<string, ProbeConfig>([[probeConfig.id, probeConfig]]);
    const rules = getEnhancedRules(configMap);
    const events: FailureEvent[] = evaluateRules(result, rules);
    const failure_modes = [...new Set(events.map((e) => e.failure_mode))];

    return NextResponse.json({
      failure_modes,
      pass: failure_modes.length === 0,
      mode_used: runMode,
      details: {
        events: events.map((e) => ({
          failure_mode: e.failure_mode,
          severity: e.severity,
          breaks_at: e.breaks_at,
        })),
      },
    });
  } catch (err) {
    console.error("Check prompt error:", err);
    return NextResponse.json(
      {
        error: "Check failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
