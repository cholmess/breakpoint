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
import { callLLM } from "./llm-client";
import { RateLimiter } from "./gemini-client";

// Execution mode: "simulate" or "real"
export type ExecutionMode = "simulate" | "real";
let currentMode: ExecutionMode = "simulate";

/** Strip UTF-8 BOM if present so JSON.parse succeeds */
function stripBOM(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

// Rate limiter for API calls
let rateLimiter: RateLimiter | null = null;

// Deterministic seed for reproducibility (simulation mode only)
let seed = 42;

/**
 * Simple seeded random number generator for deterministic results
 */
function seededRandom(): number {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

/**
 * Set the seed for deterministic probe execution (simulation mode only)
 */
export function setSeed(newSeed: number): void {
  seed = newSeed;
}

/**
 * Set the execution mode (simulate or real)
 */
export function setMode(mode: ExecutionMode): void {
  currentMode = mode;
  
  // Initialize rate limiter for real mode
  if (mode === "real" && !rateLimiter) {
    rateLimiter = new RateLimiter(5, 200); // Max 5 concurrent, 200ms between calls
  }
}

/**
 * Get current execution mode
 */
export function getMode(): ExecutionMode {
  return currentMode;
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
    const content = stripBOM(fs.readFileSync(filePath, "utf-8"));
    const config = JSON.parse(content) as ProbeConfig;
    configs.push(config);
  }
  
  return configs;
}

/**
 * Domain prompt suite metadata
 */
export interface SuiteMetadata {
  use_case_description: string;
  generated_at: string;
  generation_method: string;
  prompt_count: number;
  complexity?: string;
  telemetry_method?: string;
}

/**
 * Load domain-generated prompts from a suite file
 * Supports the domain-prompt-suite format with metadata
 */
export function loadDomainPrompts(suiteFile: string): {
  metadata: SuiteMetadata;
  prompts: PromptRecord[];
} {
  const targetPath = path.join(process.cwd(), suiteFile);
  
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Suite file not found: ${targetPath}`);
  }
  
  const content = stripBOM(fs.readFileSync(targetPath, "utf-8"));
  const data = JSON.parse(content);
  
  // Check if it's a domain prompt suite format
  if (data.suite_metadata && Array.isArray(data.prompts)) {
    return {
      metadata: data.suite_metadata as SuiteMetadata,
      prompts: data.prompts as PromptRecord[],
    };
  }
  
  throw new Error(
    `Invalid domain prompt suite format. Expected { suite_metadata, prompts }`
  );
}

/**
 * Load all prompts from a directory or single file
 * Supports multiple formats:
 * - Array of prompts: [prompt1, prompt2, ...]
 * - Single prompt object: { id, family, ... }
 * - Domain suite format: { suite_metadata, prompts: [...] }
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
      const content = stripBOM(fs.readFileSync(filePath, "utf-8"));
      const data = JSON.parse(content);
      
      // Handle domain suite format
      if (data.suite_metadata && Array.isArray(data.prompts)) {
        prompts.push(...(data.prompts as PromptRecord[]));
      }
      // Handle array format
      else if (Array.isArray(data)) {
        prompts.push(...data);
      }
      // Handle single prompt object
      else if (data.id && data.prompt) {
        prompts.push(data);
      }
    }
    
    return prompts;
  } else {
    // Load single file
    const content = stripBOM(fs.readFileSync(targetPath, "utf-8"));
    const data = JSON.parse(content);
    
    // Handle domain suite format
    if (data.suite_metadata && Array.isArray(data.prompts)) {
      return data.prompts as PromptRecord[];
    }
    // Handle array format
    if (Array.isArray(data)) {
      return data;
    }
    // Handle single prompt object
    if (data.id && data.prompt) {
      return [data];
    }
    
    throw new Error(
      `Invalid prompt file format. Expected array, single prompt, or domain suite format.`
    );
  }
}

/**
 * Filter prompts by family
 * Returns all prompts if family is "all", otherwise filters by matching family
 */
export function filterPromptsByFamily(
  prompts: PromptRecord[],
  family: string
): PromptRecord[] {
  if (family === "all" || !family) {
    return prompts;
  }
  return prompts.filter((p) => p.family === family);
}

/**
 * Estimate token count from text (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Thresholds aligned with rules-engine so simulation can trigger failures
const LATENCY_BREACH_MS = 3000;
const COST_BREACH_PER_PROBE = 0.10;
const CONTEXT_USAGE_BREACH = 0.85;

/**
 * Get model-specific latency parameters for more realistic simulation
 */
function getModelLatencyProfile(model: string): { baseMin: number; baseMax: number; tokenMultiplier: number } {
  const modelLower = model.toLowerCase();
  
  // GPT-4 family: slower, more thorough
  if (modelLower.includes("gpt-4") && !modelLower.includes("turbo") && !modelLower.includes("mini")) {
    return { baseMin: 800, baseMax: 1500, tokenMultiplier: 0.8 };
  }
  // GPT-4 Turbo / GPT-4o: faster than base GPT-4
  if (modelLower.includes("gpt-4-turbo") || modelLower.includes("gpt-4o")) {
    return { baseMin: 400, baseMax: 900, tokenMultiplier: 0.5 };
  }
  // GPT-3.5 / mini models: fast
  if (modelLower.includes("gpt-3.5") || modelLower.includes("mini")) {
    return { baseMin: 200, baseMax: 500, tokenMultiplier: 0.3 };
  }
  // Gemini family: generally fast
  if (modelLower.includes("gemini")) {
    return { baseMin: 300, baseMax: 700, tokenMultiplier: 0.4 };
  }
  // Manus: async, slower
  if (modelLower.includes("manus")) {
    return { baseMin: 1000, baseMax: 2500, tokenMultiplier: 1.0 };
  }
  // Default: moderate speed
  return { baseMin: 400, baseMax: 800, tokenMultiplier: 0.5 };
}

/**
 * Generate realistic telemetry based on config and prompt.
 * Simulates multiple failure modes so failure rate varies by config (not just 0% or 5%).
 * Uses model-specific variance for realistic behavior.
 */
function generateTelemetry(
  config: ProbeConfig,
  prompt: PromptRecord
): TelemetryRecord {
  const promptTokens = estimateTokens(prompt.prompt);
  const latencyProfile = getModelLatencyProfile(config.model);

  // Simulate retrieved tokens (for RAG scenarios) – match suite family names
  let retrievedTokens = 0;
  const hasRetrieval =
    prompt.family.includes("doc_grounded") || prompt.family === "long_context";
  if (hasRetrieval) {
    const chunksRetrieved = Math.min(config.top_k, 10);
    retrievedTokens = chunksRetrieved * config.chunk_size;
    retrievedTokens = Math.floor(
      retrievedTokens * (0.8 + seededRandom() * 0.4)
    );
  }

  // Simulate completion tokens based on prompt complexity and model
  let completionTokens = Math.floor(
    promptTokens * (0.3 + seededRandom() * 0.4)
  );
  
  // Model-specific output tendencies
  const modelLower = config.model.toLowerCase();
  if (modelLower.includes("gpt-4") && !modelLower.includes("mini")) {
    // GPT-4 tends to be more verbose
    completionTokens = Math.floor(completionTokens * (1.1 + seededRandom() * 0.2));
  } else if (modelLower.includes("mini") || modelLower.includes("3.5")) {
    // Smaller models are more concise
    completionTokens = Math.floor(completionTokens * (0.8 + seededRandom() * 0.2));
  }
  
  // Prompt family adjustments
  if (prompt.family.startsWith("short")) {
    completionTokens = Math.floor(completionTokens * 0.5);
  } else if (
    prompt.family.includes("long") ||
    prompt.family === "long_context"
  ) {
    completionTokens = Math.floor(completionTokens * 1.5);
  }
  completionTokens = Math.min(completionTokens, config.max_output_tokens);

  // Occasional non-tool failures so tools-disabled configs don't always show 0%
  const rollLatency = seededRandom();
  const rollContext = seededRandom();
  const rollCost = seededRandom();

  // ~10% chance: latency breach (rule: latency_ms > 3000)
  let latencyMs: number;
  if (rollLatency < 0.10) {
    latencyMs = Math.floor(
      LATENCY_BREACH_MS + 200 + seededRandom() * 2500
    );
  } else {
    // Use model-specific base latency for realism
    const baseLatency = latencyProfile.baseMin + seededRandom() * (latencyProfile.baseMax - latencyProfile.baseMin);
    const tokenLatency =
      (promptTokens + retrievedTokens + completionTokens) * latencyProfile.tokenMultiplier;
    latencyMs = Math.floor(
      baseLatency + tokenLatency + seededRandom() * 500
    );
  }

  // ~8% chance: push context usage over 0.85 (silent truncation rule)
  if (rollContext < 0.08) {
    const needed =
      Math.ceil(CONTEXT_USAGE_BREACH * config.context_window) -
      promptTokens;
    if (needed > 0) {
      retrievedTokens = Math.max(retrievedTokens, needed);
    }
  }

  // ~5% chance: cost runaway (rule: estimated_cost > 0.10 per probe)
  const totalSoFar = promptTokens + retrievedTokens + completionTokens;
  const minTokensForCostBreach = Math.ceil(
    (COST_BREACH_PER_PROBE * 1000) / config.cost_per_1k_tokens
  );
  if (rollCost < 0.05 && minTokensForCostBreach > totalSoFar) {
    const extra = minTokensForCostBreach - totalSoFar + 100;
    completionTokens = Math.min(
      completionTokens + extra,
      config.max_output_tokens
    );
  }

  // Simulate tool calls and timeouts with realistic distribution
  let toolCalls = 0;
  let toolTimeouts = 0;
  if (config.tools_enabled && prompt.expects_tools) {
    // More realistic tool call distribution based on prompt complexity
    // Simple prompts: 1-2 calls, complex prompts: 2-8 calls
    const isComplexPrompt = prompt.family.includes("long") || 
                           prompt.family.includes("doc_grounded") ||
                           promptTokens > 500;
    
    if (isComplexPrompt) {
      // Complex: 2-8 tool calls with bias toward 3-5
      const roll = seededRandom();
      if (roll < 0.6) {
        toolCalls = Math.floor(3 + seededRandom() * 3); // 3-5 (60%)
      } else {
        toolCalls = Math.floor(2 + seededRandom() * 7); // 2-8 (40%)
      }
    } else {
      // Simple: 1-3 tool calls, mostly 1-2
      toolCalls = Math.floor(1 + seededRandom() * (seededRandom() < 0.7 ? 2 : 3));
    }
    
    // More realistic timeout rate: 1-3% chance (was 5-18%)
    const timeoutChance = 0.01 + seededRandom() * 0.02;
    if (seededRandom() < timeoutChance) {
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
 * Supports both simulation and real API modes
 */
export async function runProbe(
  config: ProbeConfig,
  prompt: PromptRecord
): Promise<ProbeResult> {
  let telemetry: TelemetryRecord;
  
  if (currentMode === "real") {
    // Call real API with rate limiting
    if (!rateLimiter) {
      throw new Error("Rate limiter not initialized. Call setMode('real') first.");
    }
    
    telemetry = await rateLimiter.execute(() => callLLM(config, prompt));
  } else {
    // Use simulated telemetry
    telemetry = generateTelemetry(config, prompt);
  }
  
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
 * Supports both simulation and real API modes
 */
export async function runAllProbes(
  configs: ProbeConfig[],
  prompts: PromptRecord[]
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  
  const total = configs.length * prompts.length;
  let completed = 0;
  
  for (const config of configs) {
    for (const prompt of prompts) {
      const result = await runProbe(config, prompt);
      results.push(result);
      
      completed++;
      if (currentMode === "real" && completed % 10 === 0) {
        console.log(`   Progress: ${completed}/${total} probes completed`);
      }
    }
  }
  
  return results;
}
