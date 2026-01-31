/**
 * Probe Runner
 * Executes probes against configurations and generates telemetry
 */

import * as fs from "fs";
import * as path from "path";
import type {
  ProbeConfig,
  PromptRecord,
  ProbeResult,
  TelemetryRecord,
} from "../types";
import { logTelemetry } from "./telemetry-logger";

// Deterministic seed for reproducibility
let seed = 42;

/**
 * Simple seeded random number generator for deterministic results
 */
function seededRandom(): number {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

/**
 * Set the seed for deterministic probe execution
 */
export function setSeed(newSeed: number): void {
  seed = newSeed;
}

/**
 * Load all probe configurations from a directory
 */
export function loadConfigs(dir: string): ProbeConfig[] {
  const configDir = path.join(process.cwd(), dir);
  
  if (!fs.existsSync(configDir)) {
    throw new Error(`Config directory not found: ${configDir}`);
  }
  
  const files = fs.readdirSync(configDir).filter((f) => f.endsWith(".json"));
  const configs: ProbeConfig[] = [];
  
  for (const file of files) {
    const filePath = path.join(configDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const config = JSON.parse(content) as ProbeConfig;
    configs.push(config);
  }
  
  return configs;
}

/**
 * Load all prompts from a directory or single file
 */
export function loadPrompts(dirOrFile: string): PromptRecord[] {
  const targetPath = path.join(process.cwd(), dirOrFile);
  
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Prompt path not found: ${targetPath}`);
  }
  
  const stats = fs.statSync(targetPath);
  
  if (stats.isDirectory()) {
    // Load all JSON files from directory
    const files = fs.readdirSync(targetPath).filter((f) => f.endsWith(".json"));
    const prompts: PromptRecord[] = [];
    
    for (const file of files) {
      const filePath = path.join(targetPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      // Handle both single object and array
      if (Array.isArray(data)) {
        prompts.push(...data);
      } else {
        prompts.push(data);
      }
    }
    
    return prompts;
  } else {
    // Load single file
    const content = fs.readFileSync(targetPath, "utf-8");
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      return data;
    } else {
      return [data];
    }
  }
}

/**
 * Estimate token count from text (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate realistic telemetry based on config and prompt
 * This simulates what would happen if we actually called an LLM API
 */
function generateTelemetry(
  config: ProbeConfig,
  prompt: PromptRecord
): TelemetryRecord {
  const promptTokens = estimateTokens(prompt.prompt);
  
  // Simulate retrieved tokens (for RAG scenarios)
  let retrievedTokens = 0;
  if (prompt.family === "doc_grounded" || prompt.family === "long_context") {
    // Simulate retrieval based on chunk_size and top_k
    const chunksRetrieved = Math.min(config.top_k, 10);
    retrievedTokens = chunksRetrieved * config.chunk_size;
    // Add some randomness (±20%)
    retrievedTokens = Math.floor(
      retrievedTokens * (0.8 + seededRandom() * 0.4)
    );
  }
  
  // Simulate completion tokens based on prompt complexity
  let completionTokens = Math.floor(promptTokens * (0.3 + seededRandom() * 0.4));
  if (prompt.family === "short") {
    completionTokens = Math.floor(completionTokens * 0.5);
  } else if (prompt.family === "long_context") {
    completionTokens = Math.floor(completionTokens * 1.5);
  }
  
  // Cap completion tokens by max_output_tokens
  completionTokens = Math.min(completionTokens, config.max_output_tokens);
  
  // Simulate latency (base latency + token-dependent latency)
  const baseLatency = 200 + seededRandom() * 300; // 200-500ms base
  const tokenLatency = (promptTokens + retrievedTokens + completionTokens) * 0.5; // ~0.5ms per token
  const latencyMs = Math.floor(baseLatency + tokenLatency + seededRandom() * 500);
  
  // Simulate tool calls
  let toolCalls = 0;
  let toolTimeouts = 0;
  if (config.tools_enabled && prompt.expects_tools) {
    toolCalls = Math.floor(1 + seededRandom() * 5); // 1-5 tool calls
    // 10% chance of timeout if tools are used
    if (seededRandom() < 0.1) {
      toolTimeouts = Math.floor(1 + seededRandom() * 2);
    }
  }
  
  return {
    prompt_id: prompt.id,
    config_id: config.id,
    prompt_tokens: promptTokens,
    retrieved_tokens: retrievedTokens,
    completion_tokens: completionTokens,
    latency_ms: latencyMs,
    tool_calls: toolCalls,
    tool_timeouts: toolTimeouts,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run a single probe (prompt + config) and return result
 */
export function runProbe(
  config: ProbeConfig,
  prompt: PromptRecord
): ProbeResult {
  const telemetry = generateTelemetry(config, prompt);
  
  // Compute derived metrics
  const totalInputTokens = telemetry.prompt_tokens + telemetry.retrieved_tokens;
  const contextUsage = totalInputTokens / config.context_window;
  const totalTokens =
    telemetry.prompt_tokens +
    telemetry.retrieved_tokens +
    telemetry.completion_tokens;
  const estimatedCost =
    (totalTokens / 1000) * config.cost_per_1k_tokens;
  
  const result: ProbeResult = {
    prompt_id: prompt.id,
    config_id: config.id,
    telemetry,
    context_usage: contextUsage,
    total_tokens: totalTokens,
    estimated_cost: estimatedCost,
  };
  
  // Log telemetry
  logTelemetry(telemetry);
  
  return result;
}

/**
 * Run all probes (all configs × all prompts)
 */
export function runAllProbes(
  configs: ProbeConfig[],
  prompts: PromptRecord[]
): ProbeResult[] {
  const results: ProbeResult[] = [];
  
  for (const config of configs) {
    for (const prompt of prompts) {
      const result = runProbe(config, prompt);
      results.push(result);
    }
  }
  
  return results;
}
