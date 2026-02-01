/**
 * Unified LLM Client
 * Routes API calls to the appropriate provider (OpenAI, Gemini, or Manus)
 */

import type { ProbeConfig, TelemetryRecord } from "../types";
import type { PromptRecord } from "../types";
import { callGeminiWithRetry } from "./gemini-client";
import { callOpenAIAPI } from "./openai-client";
import { callManusAPI } from "./manus-client";

export type ProviderType = "openai" | "gemini" | "manus";

/**
 * Infer provider from model name if not explicitly set
 */
export function inferProvider(config: ProbeConfig): ProviderType {
  if (config.provider) {
    return config.provider;
  }
  const model = config.model?.toLowerCase() || "";
  if (model.startsWith("gpt-") || model.startsWith("o1")) {
    return "openai";
  }
  if (model.startsWith("gemini-")) {
    return "gemini";
  }
  if (model.startsWith("manus-")) {
    return "manus";
  }
  throw new Error(
    `Unknown model provider for: ${config.model ?? "(empty)"}. Set 'provider' explicitly (openai, gemini, or manus).`
  );
}

/**
 * Call the appropriate LLM API based on config provider/model
 */
export async function callLLM(
  config: ProbeConfig,
  prompt: PromptRecord
): Promise<TelemetryRecord> {
  const provider = inferProvider(config);

  if (provider === "openai") {
    return callOpenAIAPI(config, prompt);
  }
  if (provider === "manus") {
    return callManusAPI(config, prompt);
  }

  return callGeminiWithRetry(config, prompt);
}
