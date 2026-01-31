/**
 * Manus AI API Client
 * Manus uses async tasks - create task, then poll until completed
 * API docs: https://open.manus.ai/docs
 */

import type { ProbeConfig, PromptRecord, TelemetryRecord } from "../types";

const MANUS_API_BASE = "https://api.manus.ai/v1";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 120000; // 2 min timeout

/**
 * Estimate token count from text (rough: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Call Manus API - creates task and polls until completion
 * Note: Manus is async; latency reflects total task time, not just API round-trip
 */
export async function callManusAPI(
  config: ProbeConfig,
  prompt: PromptRecord
): Promise<TelemetryRecord> {
  const apiKey = process.env.MANUS_API_KEY_CH || process.env.MANUS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "MANUS_API_KEY_CH or MANUS_API_KEY not found in environment. Please set it in .env file."
    );
  }

  const startTime = Date.now();
  const model = config.model || "manus-1.6";
  const agentProfile = ["manus-1.6", "manus-1.6-lite", "manus-1.6-max"].includes(model)
    ? model
    : "manus-1.6";

  try {
    // 1. Create task
    const createRes = await fetch(`${MANUS_API_BASE}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API_KEY": apiKey,
      },
      body: JSON.stringify({
        prompt: prompt.prompt,
        agentProfile,
        taskMode: "chat", // Use chat for faster sync-like behavior
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Manus create failed: ${createRes.status} ${errText}`);
    }

    const createData = (await createRes.json()) as { task_id: string };
    const taskId = createData.task_id;

    if (!taskId) {
      throw new Error("Manus did not return task_id");
    }

    // 2. Poll until completed or failed
    let task: ManusTaskResponse | null = null;
    const pollStart = Date.now();

    while (Date.now() - pollStart < MAX_POLL_TIME_MS) {
      const getRes = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
        headers: { "API_KEY": apiKey },
      });

      if (!getRes.ok) {
        throw new Error(`Manus get task failed: ${getRes.status}`);
      }

      task = (await getRes.json()) as ManusTaskResponse;

      if (task.status === "completed") {
        break;
      }
      if (task.status === "failed") {
        throw new Error(task.error || "Manus task failed");
      }

      await sleep(POLL_INTERVAL_MS);
    }

    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    if (!task || task.status !== "completed") {
      throw new Error(`Manus task timed out after ${MAX_POLL_TIME_MS}ms`);
    }

    // 3. Map to telemetry
    const promptTokens = estimateTokens(prompt.prompt);
    const creditUsage = task.credit_usage ?? 0;
    // Manus uses credits, not tokens - rough mapping: 1 credit ≈ 50 tokens
    const completionTokens = Math.max(0, creditUsage * 50);

    return {
      prompt_id: prompt.id,
      config_id: config.id,
      prompt_tokens: promptTokens,
      retrieved_tokens: 0,
      completion_tokens: completionTokens,
      latency_ms: latencyMs,
      tool_calls: 0,
      tool_timeouts: 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    console.error(`Manus API failed for ${prompt.id} with ${config.id}:`, error);

    // Only mark as timeout if it's an actual timeout (>60s) or timeout error
    const isTimeout = latencyMs > 60000 || 
      (error instanceof Error && (
        error.message.includes("timeout") || 
        error.message.includes("timed out") ||
        error.message.includes("ETIMEDOUT")
      ));

    return {
      prompt_id: prompt.id,
      config_id: config.id,
      prompt_tokens: 0,
      retrieved_tokens: 0,
      completion_tokens: 0,
      latency_ms: latencyMs,
      tool_calls: 0,
      tool_timeouts: isTimeout ? 1 : 0,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface ManusTaskResponse {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
  credit_usage?: number;
  created_at?: number;
  updated_at?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
