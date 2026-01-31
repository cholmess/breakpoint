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
  FailureMode,
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
    rateLimiter = new RateLimiter(20, 50); // Max 20 concurrent, 50ms between calls - optimized for <1min completion
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
const LATENCY_BREACH_MS = 15000; // 15s - realistic for real LLM APIs (GPT-4, tools, RAG)
const COST_BREACH_PER_PROBE = 0.10;
const CONTEXT_USAGE_BREACH = 0.85;

// Context window above this is treated as "huge" – we don't force ~8% silent truncation,
// so configs with insane context actually see fewer context-related failures.
const CONTEXT_AT_RISK_MAX = 256 * 1024; // 256k tokens

/** Latency threshold used by rules-engine for latency_breach (must match). */
const LATENCY_SLO_MS = 15000;

/**
 * Get model-specific latency parameters for realistic simulation.
 * Token multiplier is kept small (ms per token) so typical simulated requests stay under 2800ms.
 * Input processing is fast; output tokens dominate but we use a blended conservative estimate.
 */
function getModelLatencyProfile(model: string): { baseMin: number; baseMax: number; tokenMultiplier: number } {
  const modelLower = model.toLowerCase();
  
  // GPT-4 family: slower, more thorough
  if (modelLower.includes("gpt-4") && !modelLower.includes("turbo") && !modelLower.includes("mini")) {
    return { baseMin: 400, baseMax: 900, tokenMultiplier: 0.06 };
  }
  // GPT-4 Turbo / GPT-4o: faster than base GPT-4
  if (modelLower.includes("gpt-4-turbo") || modelLower.includes("gpt-4o")) {
    return { baseMin: 250, baseMax: 600, tokenMultiplier: 0.04 };
  }
  // GPT-3.5 / mini models: fast
  if (modelLower.includes("gpt-3.5") || modelLower.includes("mini")) {
    return { baseMin: 150, baseMax: 400, tokenMultiplier: 0.03 };
  }
  // Gemini family: generally fast
  if (modelLower.includes("gemini")) {
    return { baseMin: 200, baseMax: 550, tokenMultiplier: 0.04 };
  }
  // Manus: async, slower
  if (modelLower.includes("manus")) {
    return { baseMin: 500, baseMax: 1200, tokenMultiplier: 0.08 };
  }
  // Default: moderate speed
  return { baseMin: 300, baseMax: 650, tokenMultiplier: 0.05 };
}

/**
 * All six failure modes so we can guarantee at least one of each in simulate (Problem 5).
 */
const ALL_FAILURE_MODES: FailureMode[] = [
  "context_overflow",
  "silent_truncation_risk",
  "latency_breach",
  "cost_runaway",
  "tool_timeout_risk",
  "retrieval_noise_risk",
];

/**
 * Generate realistic telemetry based on config and prompt.
 * Simulates multiple failure modes so failure rate varies by config (not just 0% or 5%).
 * Uses model-specific variance for realistic behavior.
 * When forceFailureMode is set (simulate demo mix), telemetry is shaped so that rule fires.
 */
function generateTelemetry(
  config: ProbeConfig,
  prompt: PromptRecord,
  forceFailureMode?: FailureMode
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
  const rollContext = seededRandom();
  const rollContextOverflow = seededRandom();
  const rollCost = seededRandom();

  // Simulation mode: keep latency under 15s unless we're forcing latency_breach (demo mix).
  let latencyMs: number;
  if (forceFailureMode === "latency_breach") {
    latencyMs = LATENCY_SLO_MS + 1000; // Over threshold so rule fires
  } else {
    const baseLatency = latencyProfile.baseMin + seededRandom() * (latencyProfile.baseMax - latencyProfile.baseMin);
    const tokenLatency =
      (promptTokens + retrievedTokens + completionTokens) * latencyProfile.tokenMultiplier;
    latencyMs = Math.floor(
      Math.min(
        baseLatency + tokenLatency + seededRandom() * 400,
        2800 // Cap - well below 15s so other failure modes can surface
      )
    );
  }

  const contextAtRisk = config.context_window <= CONTEXT_AT_RISK_MAX;

  let toolCalls = 0;
  let toolTimeouts = 0;

  // Forced demo mix: shape telemetry so this probe triggers the requested failure mode
  if (forceFailureMode) {
    switch (forceFailureMode) {
      case "context_overflow": {
        const overflowAmount = Math.floor(100 + seededRandom() * 500);
        retrievedTokens = Math.max(
          retrievedTokens,
          config.context_window + overflowAmount - promptTokens
        );
        break;
      }
      case "silent_truncation_risk": {
        const needed = Math.ceil(CONTEXT_USAGE_BREACH * config.context_window) - promptTokens;
        if (needed > 0) retrievedTokens = Math.max(retrievedTokens, needed);
        break;
      }
      case "cost_runaway": {
        const minTokensForCostBreach = Math.ceil(
          (COST_BREACH_PER_PROBE * 1000) / config.cost_per_1k_tokens
        );
        const totalSoFar = promptTokens + retrievedTokens + completionTokens;
        if (minTokensForCostBreach > totalSoFar) {
          const extra = minTokensForCostBreach - totalSoFar + 100;
          completionTokens = Math.min(
            completionTokens + extra,
            config.max_output_tokens
          );
        }
        break;
      }
      case "tool_timeout_risk":
        if (config.tools_enabled && prompt.expects_tools) {
          toolCalls = 2;
          toolTimeouts = 1;
        }
        break;
      case "retrieval_noise_risk":
        if (config.top_k > 8) retrievedTokens = Math.max(retrievedTokens, 1000);
        break;
      case "latency_breach":
        // latencyMs already set above
        break;
    }
  }

  if (!forceFailureMode || forceFailureMode !== "tool_timeout_risk") {
    if (config.tools_enabled && prompt.expects_tools) {
      const isComplexPrompt = prompt.family.includes("long") || 
                             prompt.family.includes("doc_grounded") ||
                             promptTokens > 500;
      
      if (isComplexPrompt) {
        const roll = seededRandom();
        if (roll < 0.6) {
          toolCalls = Math.floor(3 + seededRandom() * 3);
        } else {
          toolCalls = Math.floor(2 + seededRandom() * 7);
        }
      } else {
        toolCalls = Math.floor(1 + seededRandom() * (seededRandom() < 0.7 ? 2 : 3));
      }
      
      const timeoutChance = 0.01 + seededRandom() * 0.02;
      if (seededRandom() < timeoutChance) {
        toolTimeouts = Math.floor(1 + seededRandom() * 2);
      }
    }
  }

  if (!forceFailureMode) {
    // ~5% chance: context_overflow
    if (contextAtRisk && rollContextOverflow < 0.05) {
      const overflowAmount = Math.floor(100 + seededRandom() * 500);
      const minInputForOverflow = config.context_window + overflowAmount;
      const currentInput = promptTokens + retrievedTokens;
      if (minInputForOverflow > currentInput) {
        retrievedTokens = Math.max(0, minInputForOverflow - promptTokens);
      }
    }

    // ~8% chance: silent truncation
    if (contextAtRisk && rollContext < 0.08) {
      const needed =
        Math.ceil(CONTEXT_USAGE_BREACH * config.context_window) -
        promptTokens;
      if (needed > 0) {
        retrievedTokens = Math.max(retrievedTokens, needed);
      }
    }

    // ~5% chance: cost runaway
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
 * Supports both simulation and real API modes.
 * In simulate mode, optional forceFailureMode shapes telemetry so that rule fires (demo mix).
 */
export async function runProbe(
  config: ProbeConfig,
  prompt: PromptRecord,
  forceFailureMode?: FailureMode
): Promise<ProbeResult> {
  let telemetry: TelemetryRecord;
  
  if (currentMode === "real") {
    // Call real API with rate limiting
    if (!rateLimiter) {
      throw new Error("Rate limiter not initialized. Call setMode('real') first.");
    }
    
    telemetry = await rateLimiter.execute(() => callLLM(config, prompt));
  } else {
    // Use simulated telemetry (with optional forced failure mode for demo mix)
    telemetry = generateTelemetry(config, prompt, forceFailureMode);
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
 * Progress callback type for probe execution
 */
export type ProgressCallback = (completed: number, total: number) => void;

/**
 * Run all probes (all configs × all prompts)
 * Supports both simulation and real API modes
 * Optional progress callback for real-time feedback
 * 
 * In real mode, probes run concurrently (rate limiter controls max 5 concurrent)
 * In simulate mode, runs all probes in parallel for maximum speed
 */
export async function runAllProbes(
  configs: ProbeConfig[],
  prompts: PromptRecord[],
  onProgress?: ProgressCallback
): Promise<ProbeResult[]> {
  const total = configs.length * prompts.length;
  let completed = 0;
  
  // In simulate mode, run all probes in parallel for better performance
  if (currentMode === "simulate") {
    // Guaranteed demo mix (Problem 5): assign one probe per failure mode so all 6 appear
    const forcedByKey = new Map<string, FailureMode>();
    const tasks: { config: ProbeConfig; prompt: PromptRecord; configIdx: number; promptIdx: number }[] = [];
    for (let ci = 0; ci < configs.length; ci++) {
      for (let pi = 0; pi < prompts.length; pi++) {
        tasks.push({ config: configs[ci], prompt: prompts[pi], configIdx: ci, promptIdx: pi });
      }
    }
    const assigned = new Set<number>();
    for (const mode of ALL_FAILURE_MODES) {
      for (let i = 0; i < tasks.length; i++) {
        if (assigned.has(i)) continue;
        const { config, prompt } = tasks[i];
        const canSupport =
          mode === "tool_timeout_risk"
            ? config.tools_enabled && prompt.expects_tools
            : mode === "retrieval_noise_risk"
              ? config.top_k > 8
              : true;
        if (canSupport) {
          const key = `${config.id}:${prompt.id}`;
          forcedByKey.set(key, mode);
          assigned.add(i);
          break;
        }
      }
    }

    const allProbePromises: Promise<ProbeResult>[] = [];
    for (const config of configs) {
      for (const prompt of prompts) {
        const key = `${config.id}:${prompt.id}`;
        const forced = forcedByKey.get(key);
        allProbePromises.push(runProbe(config, prompt, forced));
      }
    }
    
    const probeResults = await Promise.all(allProbePromises);
    if (onProgress) {
      onProgress(total, total);
    }
    return probeResults;
  }
  
  // In real mode, use concurrent execution with rate limiting
  // Build all probe tasks
  const probeTasks: Array<{ config: ProbeConfig; prompt: PromptRecord }> = [];
  for (const config of configs) {
    for (const prompt of prompts) {
      probeTasks.push({ config, prompt });
    }
  }
  
  // For real mode: process all concurrently (rate limiter will control to max 5)
  const results: ProbeResult[] = [];
  
  // Run all probes concurrently (rate limiter controls concurrency in real mode)
  const probePromises = probeTasks.map(async ({ config, prompt }) => {
    const result = await runProbe(config, prompt);
    
    completed++;
    
    // Call progress callback if provided
    if (onProgress) {
      onProgress(completed, total);
    }
    
    // Keep console.log for debugging (only in real mode, every 10 probes)
    if (currentMode === "real" && completed % 10 === 0) {
      console.log(`   Progress: ${completed}/${total} probes completed`);
    }
    
    return result;
  });
  
  const allResults = await Promise.all(probePromises);
  results.push(...allResults);
  
  return results;
}
