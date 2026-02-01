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
      "OPENAI_API_KEY not found. Copy .env.example to .env in the project root and add your key. Get a key: https://platform.openai.com/api-keys"
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

  // Newer models (o1, gpt-4.5, etc.) use max_completion_tokens instead of max_tokens
  const usesNewAPI = modelName.startsWith("o1") || modelName.includes("gpt-5") || modelName === "gpt-4.5-turbo";
  
  try {
    const completionParams: any = {
      model: modelName,
      messages: [{ role: "user", content: prompt.prompt }],
      temperature: config.temperature,
    };
    
    // Use correct parameter name based on model
    if (usesNewAPI) {
      completionParams.max_completion_tokens = config.max_output_tokens;
    } else {
      completionParams.max_tokens = config.max_output_tokens;
    }
    
    const response = await client.chat.completions.create(completionParams);

    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    const usage = response.usage;
    if (!usage) {
      throw new Error("No usage metadata returned from API");
    }

    const toolCallsCount = response.choices[0]?.message?.tool_calls?.length || 0;
    
    // Estimate retrieved tokens for RAG scenarios
    const retrievedTokens = 
      (prompt.expects_citations || prompt.family?.includes("doc_grounded"))
        ? Math.floor(config.top_k * config.chunk_size * 0.8)
        : 0;
    
    // Infer tool timeouts from high latency (>10s) when tools are used
    // APIs don't expose per-tool timeout, so we infer from overall latency
    const toolTimeouts = (toolCallsCount > 0 && latencyMs > 10000) ? 1 : 0;

    const telemetry: TelemetryRecord = {
      prompt_id: prompt.id,
      config_id: config.id,
      prompt_tokens: usage.prompt_tokens || 0,
      retrieved_tokens: retrievedTokens,
      completion_tokens: usage.completion_tokens || 0,
      latency_ms: latencyMs,
      tool_calls: toolCallsCount,
      tool_timeouts: toolTimeouts,
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
