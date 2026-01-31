/**
 * OpenAI API Client
 * Handles real API calls to OpenAI models (GPT-4, etc.)
 */

import OpenAI from "openai";
import type { ProbeConfig, PromptRecord, TelemetryRecord } from "../types";

/**
 * Initialize OpenAI client with API key from environment
 */
export function initOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY not found in environment. Please set it in .env file."
    );
  }

  return new OpenAI({ apiKey });
}

/**
 * Call OpenAI API with the given prompt and config
 * Returns actual telemetry from the API response
 */
export async function callOpenAIAPI(
  config: ProbeConfig,
  prompt: PromptRecord
): Promise<TelemetryRecord> {
  const client = initOpenAIClient();

  const modelName = config.model || "gpt-4o-mini";
  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt.prompt }],
      max_tokens: config.max_output_tokens,
      temperature: config.temperature,
    });

    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    const usage = response.usage;
    if (!usage) {
      throw new Error("No usage metadata returned from API");
    }

    const telemetry: TelemetryRecord = {
      prompt_id: prompt.id,
      config_id: config.id,
      prompt_tokens: usage.prompt_tokens || 0,
      retrieved_tokens: 0, // OpenAI doesn't expose RAG retrieval tokens separately
      completion_tokens: usage.completion_tokens || 0,
      latency_ms: latencyMs,
      tool_calls: response.choices[0]?.message?.tool_calls?.length || 0,
      tool_timeouts: 0,
      timestamp: new Date().toISOString(),
    };

    return telemetry;
  } catch (error) {
    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    console.error(`OpenAI API call failed for ${prompt.id} with ${config.id}:`, error);

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
