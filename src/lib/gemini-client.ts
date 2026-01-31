/**
 * Gemini API Client
 * Handles real API calls to Google Gemini models
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ProbeConfig, PromptRecord, TelemetryRecord } from "../types";

/**
 * Initialize Gemini client with API key from environment
 */
export function initGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY_CH || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY_CH or GEMINI_API_KEY not found in environment. Please set it in .env file."
    );
  }
  
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Call Gemini API with the given prompt and config
 * Returns actual telemetry from the API response
 */
export async function callGeminiAPI(
  config: ProbeConfig,
  prompt: PromptRecord
): Promise<TelemetryRecord> {
  const genAI = initGeminiClient();
  
  // Map config to Gemini model settings
  const modelName = config.model || "gemini-1.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: config.temperature,
      topK: config.top_k,
      maxOutputTokens: config.max_output_tokens,
    },
  });
  
  const startTime = Date.now();
  
  try {
    // Call the API
    const result = await model.generateContent(prompt.prompt);
    const response = result.response;
    
    const endTime = Date.now();
    const latencyMs = endTime - startTime;
    
    // Extract usage metadata
    const usageMetadata = response.usageMetadata;
    
    if (!usageMetadata) {
      throw new Error("No usage metadata returned from API");
    }
    
    // Count function calls from response
    const candidates = (result as any).response?.candidates;
    const functionCallCount = candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall)?.length ?? 0;
    
    // Map API response to our telemetry format
    const telemetry: TelemetryRecord = {
      prompt_id: prompt.id,
      config_id: config.id,
      prompt_tokens: usageMetadata.promptTokenCount || 0,
      retrieved_tokens: usageMetadata.cachedContentTokenCount || 0,
      completion_tokens: usageMetadata.candidatesTokenCount || 0,
      latency_ms: latencyMs,
      tool_calls: functionCallCount,
      tool_timeouts: 0,
      timestamp: new Date().toISOString(),
    };
    
    return telemetry;
    
  } catch (error) {
    // Handle API errors
    const endTime = Date.now();
    const latencyMs = endTime - startTime;
    
    console.error(`API call failed for ${prompt.id} with ${config.id}:`, error);
    
    // Return error telemetry
    return {
      prompt_id: prompt.id,
      config_id: config.id,
      prompt_tokens: 0,
      retrieved_tokens: 0,
      completion_tokens: 0,
      latency_ms: latencyMs,
      tool_calls: 0,
      tool_timeouts: 1, // Mark as timeout/error
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Call Gemini API with retry logic
 */
export async function callGeminiWithRetry(
  config: ProbeConfig,
  prompt: PromptRecord,
  maxRetries = 3,
  delayMs = 1000
): Promise<TelemetryRecord> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const telemetry = await callGeminiAPI(config, prompt);
      
      // If no error field, success
      if (!("error" in telemetry)) {
        return telemetry;
      }
      
      // If error, retry
      lastError = new Error(telemetry.error);
      console.log(`Attempt ${attempt + 1}/${maxRetries} failed, retrying...`);
      
      // Exponential backoff
      await sleep(delayMs * Math.pow(2, attempt));
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt + 1}/${maxRetries} failed, retrying...`);
      await sleep(delayMs * Math.pow(2, attempt));
    }
  }
  
  // All retries failed
  throw lastError || new Error("All retries failed");
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate limiter to prevent hitting API limits
 */
export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  
  constructor(
    private maxConcurrent: number,
    private minDelayMs: number
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await sleep(100);
    }
    
    this.running++;
    
    try {
      const result = await fn();
      await sleep(this.minDelayMs);
      return result;
    } finally {
      this.running--;
    }
  }
}
