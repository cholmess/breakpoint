/**
 * Rules Engine
 * Evaluates deterministic rules against probe results to detect failures
 */

import type {
  Rule,
  ProbeResult,
  FailureEvent,
  FailureMode,
  Severity,
  ProbeConfig,
} from "../types";

// Default thresholds for rules (tuned to catch failures in both simulation and real API)
const LATENCY_SLO_MS = 4500; // 4.5 seconds - balanced so latency doesn't dominate
const COST_THRESHOLD_DAILY = 100; // $100 per day (assuming ~1000 probes/day)
const COST_THRESHOLD_PER_PROBE = 0.025; // $0.025 per probe - sensitive for demo
const RETRIEVAL_NOISE_THRESHOLD = 6; // top_k > 6 considered noisy (lowered from 8)

/**
 * Compute percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Compute dynamic thresholds from probe results (percentile-based)
 * Returns P95 for latency and cost to flag the worst 5% as failures
 */
export function computeDynamicThresholds(results: ProbeResult[]): {
  latency_p95: number;
  cost_p95: number;
  context_usage_p95: number;
} {
  if (results.length === 0) {
    return {
      latency_p95: LATENCY_SLO_MS,
      cost_p95: COST_THRESHOLD_PER_PROBE,
      context_usage_p95: 0.85,
    };
  }

  const latencies = results.map((r) => r.telemetry.latency_ms).sort((a, b) => a - b);
  const costs = results.map((r) => r.estimated_cost).sort((a, b) => a - b);
  const contextUsages = results.map((r) => r.context_usage).sort((a, b) => a - b);

  return {
    latency_p95: percentile(latencies, 0.95),
    cost_p95: percentile(costs, 0.95),
    context_usage_p95: percentile(contextUsages, 0.95),
  };
}

/**
 * Get default rules for failure detection
 */
export function getDefaultRules(): Rule[] {
  return [
    {
      id: "rule_context_overflow",
      name: "Context Overflow",
      condition: (result: ProbeResult) => {
        // Simplified version - uses heuristic since we don't have config access
        // This function is kept for compatibility but getEnhancedRules should be used instead
        const totalInputTokens =
          result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens;
        // Heuristic: assume default context window of 8192
        return totalInputTokens > 8192;
      },
      severity: "HIGH",
      mode: "context_overflow",
      breaksAt: (result: ProbeResult) =>
        `tokens_in > context_window (${result.total_tokens} tokens)`,
      getSignal: (result: ProbeResult) => ({
        tokens_in:
          result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens,
        context_window: 8192, // Will be overridden by actual config lookup
      }),
    },
    {
      id: "rule_silent_truncation",
      name: "Silent Truncation Risk",
      condition: (result: ProbeResult) => result.context_usage > 0.85,
      severity: "MED",
      mode: "silent_truncation_risk",
      breaksAt: (result: ProbeResult) =>
        `context_usage > 0.85 (current: ${(result.context_usage * 100).toFixed(1)}%)`,
      getSignal: (result: ProbeResult) => ({
        context_usage: result.context_usage,
      }),
    },
    {
      id: "rule_latency_breach",
      name: "Latency Breach",
      condition: (result: ProbeResult) =>
        result.telemetry.latency_ms > LATENCY_SLO_MS,
      severity: (result: ProbeResult) =>
        result.telemetry.latency_ms > LATENCY_SLO_MS * 2 ? "HIGH" : "MED",
      mode: "latency_breach",
      breaksAt: (result: ProbeResult) =>
        `latency_ms > ${LATENCY_SLO_MS}ms (current: ${result.telemetry.latency_ms}ms)`,
      getSignal: (result: ProbeResult) => ({
        latency_ms: result.telemetry.latency_ms,
      }),
    },
    {
      id: "rule_cost_runaway",
      name: "Cost Runaway",
      condition: (result: ProbeResult) =>
        result.estimated_cost > COST_THRESHOLD_DAILY / 1000, // Per probe threshold
      severity: "HIGH",
      mode: "cost_runaway",
      breaksAt: (result: ProbeResult) =>
        `estimated_cost > $${(COST_THRESHOLD_DAILY / 1000).toFixed(4)} per probe (current: $${result.estimated_cost.toFixed(4)})`,
      getSignal: (result: ProbeResult) => ({
        cost_per_day: result.estimated_cost * 1000, // Estimate for 1000 probes
      }),
    },
    {
      id: "rule_tool_timeout",
      name: "Tool Timeout Risk",
      condition: (result: ProbeResult) =>
        result.telemetry.tool_calls > 0 &&
        result.telemetry.tool_timeouts > 0,
      severity: "HIGH",
      mode: "tool_timeout_risk",
      breaksAt: (result: ProbeResult) =>
        `tool_calls > 0 && timeouts > 0 (calls: ${result.telemetry.tool_calls}, timeouts: ${result.telemetry.tool_timeouts})`,
      getSignal: (result: ProbeResult) => ({
        tool_calls: result.telemetry.tool_calls,
        tool_timeouts: result.telemetry.tool_timeouts,
        timeout_rate:
          result.telemetry.tool_timeouts / result.telemetry.tool_calls,
      }),
    },
    {
      id: "rule_retrieval_noise",
      name: "Retrieval Noise Risk",
      condition: (result: ProbeResult) => {
        // We need to check top_k from config, but for now use a heuristic
        // If retrieved_tokens are high relative to prompt, likely high top_k
        const retrievalRatio =
          result.telemetry.retrieved_tokens / result.telemetry.prompt_tokens;
        return retrievalRatio > 3; // Heuristic: >3x retrieval suggests high top_k
      },
      severity: "MED",
      mode: "retrieval_noise_risk",
      breaksAt: (result: ProbeResult) => {
        const retrievalRatio =
          result.telemetry.retrieved_tokens / result.telemetry.prompt_tokens;
        return `top_k high OR retrieval_ratio > 3 (current: ${retrievalRatio.toFixed(2)})`;
      },
      getSignal: (result: ProbeResult) => {
        const retrievalRatio =
          result.telemetry.retrieved_tokens / result.telemetry.prompt_tokens;
        return {
          retrieval_ratio: retrievalRatio,
          retrieved_tokens: result.telemetry.retrieved_tokens,
        };
      },
    },
  ];
}

/**
 * Adaptive rules with dynamic thresholds based on run distribution (Option B)
 * Cost/context use P95; latency uses fixed SLO so latency_breach doesn't dominate.
 * costMultiplier: allow "2× cost" tolerance — cost rule uses costThreshold * costMultiplier (default 1).
 * latencyMultiplier: allow "2× latency" tolerance — latency rule uses fixed SLO * latencyMultiplier (default 1).
 * mode: "real" uses tighter cost SLO; latency uses the same fixed SLO in both modes so real API runs are not overfocused on latency breaches.
 */
export function getAdaptiveRules(
  configs: Map<string, ProbeConfig>,
  results: ProbeResult[],
  costMultiplier: number = 1,
  latencyMultiplier: number = 1,
  mode: "simulate" | "real" = "simulate"
): Rule[] {
  const thresholds = computeDynamicThresholds(results);

  // Use fixed SLO for latency in both modes so latency_breach doesn't dominate (real API was overfocused when we used P95 of the run).
  const latencyThreshold = LATENCY_SLO_MS * latencyMultiplier;
  const costSloPerProbe = mode === "real" ? 0.015 : COST_THRESHOLD_PER_PROBE;

  const costThreshold = costSloPerProbe * costMultiplier;
  const contextUsageThreshold = Math.max(thresholds.context_usage_p95, 0.85);

  return [
    {
      id: "rule_context_overflow",
      name: "Context Overflow",
      condition: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        if (!config) return false;
        const totalInputTokens =
          result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens;
        return totalInputTokens > config.context_window;
      },
      severity: "HIGH",
      mode: "context_overflow",
      breaksAt: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        const totalInputTokens =
          result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens;
        return `tokens_in > context_window (${totalInputTokens} > ${config?.context_window || "?"})`;
      },
      getSignal: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        const totalInputTokens =
          result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens;
        return {
          tokens_in: totalInputTokens,
          context_window: config?.context_window || 0,
        };
      },
    },
    {
      id: "rule_silent_truncation",
      name: "Silent Truncation Risk",
      condition: (result: ProbeResult) => result.context_usage > contextUsageThreshold,
      severity: "MED",
      mode: "silent_truncation_risk",
      breaksAt: (result: ProbeResult) =>
        `context_usage > ${(contextUsageThreshold * 100).toFixed(1)}% (current: ${(result.context_usage * 100).toFixed(1)}%)`,
      getSignal: (result: ProbeResult) => ({
        context_usage: result.context_usage,
        threshold: contextUsageThreshold,
      }),
    },
    {
      id: "rule_latency_breach",
      name: "Latency Breach",
      condition: (result: ProbeResult) =>
        result.telemetry.latency_ms > latencyThreshold,
      severity: (result: ProbeResult) =>
        result.telemetry.latency_ms > latencyThreshold * 2 ? "HIGH" : "MED",
      mode: "latency_breach",
      breaksAt: (result: ProbeResult) =>
        `latency_ms > ${latencyThreshold.toFixed(0)}ms SLO (current: ${result.telemetry.latency_ms}ms)`,
      getSignal: (result: ProbeResult) => ({
        latency_ms: result.telemetry.latency_ms,
        latency_slo_ms: latencyThreshold,
      }),
    },
    {
      id: "rule_cost_runaway",
      name: "Cost Runaway",
      condition: (result: ProbeResult) =>
        result.estimated_cost > costThreshold,
      severity: "HIGH",
      mode: "cost_runaway",
      breaksAt: (result: ProbeResult) =>
        `estimated_cost > $${costThreshold.toFixed(4)} SLO (current: $${result.estimated_cost.toFixed(4)})`,
      getSignal: (result: ProbeResult) => ({
        cost: result.estimated_cost,
        cost_slo: costThreshold,
      }),
    },
    {
      id: "rule_tool_timeout",
      name: "Tool Timeout Risk",
      condition: (result: ProbeResult) =>
        result.telemetry.tool_calls > 0 &&
        result.telemetry.tool_timeouts > 0,
      severity: "HIGH",
      mode: "tool_timeout_risk",
      breaksAt: (result: ProbeResult) =>
        `tool_calls > 0 && timeouts > 0 (calls: ${result.telemetry.tool_calls}, timeouts: ${result.telemetry.tool_timeouts})`,
      getSignal: (result: ProbeResult) => ({
        tool_calls: result.telemetry.tool_calls,
        tool_timeouts: result.telemetry.tool_timeouts,
        timeout_rate:
          result.telemetry.tool_timeouts / result.telemetry.tool_calls,
      }),
    },
    {
      id: "rule_retrieval_noise",
      name: "Retrieval Noise Risk",
      condition: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        if (!config) return false;
        const usedRetrieval = result.telemetry.retrieved_tokens > 0;
        // Also flag if retrieved tokens are excessive (>3000) even with low top_k
        const excessiveRetrieval = result.telemetry.retrieved_tokens > 3000;
        return usedRetrieval && (config.top_k > RETRIEVAL_NOISE_THRESHOLD || excessiveRetrieval);
      },
      severity: "LOW",
      mode: "retrieval_noise_risk",
      breaksAt: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        const excessive = result.telemetry.retrieved_tokens > 3000;
        if (excessive) {
          return `retrieved_tokens > 3000 (current: ${result.telemetry.retrieved_tokens})`;
        }
        return `top_k > ${RETRIEVAL_NOISE_THRESHOLD} (current: ${config?.top_k || "?"})`;
      },
      getSignal: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        return {
          top_k: config?.top_k || 0,
          chunk_size: config?.chunk_size || 0,
          retrieved_tokens: result.telemetry.retrieved_tokens,
        };
      },
    },
  ];
}

/**
 * Enhanced rules that can access config directly
 * This version is more accurate as it can check actual config values
 */
export function getEnhancedRules(configs: Map<string, ProbeConfig>): Rule[] {
  return [
    {
      id: "rule_context_overflow",
      name: "Context Overflow",
      condition: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        if (!config) return false;
        const totalInputTokens =
          result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens;
        return totalInputTokens > config.context_window;
      },
      severity: "HIGH",
      mode: "context_overflow",
      breaksAt: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        const totalInputTokens =
          result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens;
        return `tokens_in > context_window (${totalInputTokens} > ${config?.context_window || "?"})`;
      },
      getSignal: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        const totalInputTokens =
          result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens;
        return {
          tokens_in: totalInputTokens,
          context_window: config?.context_window || 0,
        };
      },
    },
    {
      id: "rule_silent_truncation",
      name: "Silent Truncation Risk",
      condition: (result: ProbeResult) => result.context_usage > 0.85,
      severity: "MED",
      mode: "silent_truncation_risk",
      breaksAt: (result: ProbeResult) =>
        `context_usage > 0.85 (current: ${(result.context_usage * 100).toFixed(1)}%)`,
      getSignal: (result: ProbeResult) => ({
        context_usage: result.context_usage,
      }),
    },
    {
      id: "rule_latency_breach",
      name: "Latency Breach",
      condition: (result: ProbeResult) =>
        result.telemetry.latency_ms > LATENCY_SLO_MS,
      severity: (result: ProbeResult) =>
        result.telemetry.latency_ms > LATENCY_SLO_MS * 2 ? "HIGH" : "MED",
      mode: "latency_breach",
      breaksAt: (result: ProbeResult) =>
        `latency_ms > ${LATENCY_SLO_MS}ms (current: ${result.telemetry.latency_ms}ms)`,
      getSignal: (result: ProbeResult) => ({
        latency_ms: result.telemetry.latency_ms,
      }),
    },
    {
      id: "rule_cost_runaway",
      name: "Cost Runaway",
      condition: (result: ProbeResult) =>
        result.estimated_cost > COST_THRESHOLD_DAILY / 1000,
      severity: "HIGH",
      mode: "cost_runaway",
      breaksAt: (result: ProbeResult) =>
        `estimated_cost > $${(COST_THRESHOLD_DAILY / 1000).toFixed(4)} per probe (current: $${result.estimated_cost.toFixed(4)})`,
      getSignal: (result: ProbeResult) => ({
        cost_per_day: result.estimated_cost * 1000,
      }),
    },
    {
      id: "rule_tool_timeout",
      name: "Tool Timeout Risk",
      condition: (result: ProbeResult) =>
        result.telemetry.tool_calls > 0 &&
        result.telemetry.tool_timeouts > 0,
      severity: "HIGH",
      mode: "tool_timeout_risk",
      breaksAt: (result: ProbeResult) =>
        `tool_calls > 0 && timeouts > 0 (calls: ${result.telemetry.tool_calls}, timeouts: ${result.telemetry.tool_timeouts})`,
      getSignal: (result: ProbeResult) => ({
        tool_calls: result.telemetry.tool_calls,
        tool_timeouts: result.telemetry.tool_timeouts,
        timeout_rate:
          result.telemetry.tool_timeouts / result.telemetry.tool_calls,
      }),
    },
    {
      id: "rule_retrieval_noise",
      name: "Retrieval Noise Risk",
      condition: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        if (!config) return false;
        // Only flag when retrieval actually occurred (high top_k + retrieved tokens used)
        const usedRetrieval = result.telemetry.retrieved_tokens > 0;
        return usedRetrieval && config.top_k > RETRIEVAL_NOISE_THRESHOLD;
      },
      severity: "MED",
      mode: "retrieval_noise_risk",
      breaksAt: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        return `top_k > ${RETRIEVAL_NOISE_THRESHOLD} (current: ${config?.top_k || "?"})`;
      },
      getSignal: (result: ProbeResult) => {
        const config = configs.get(result.config_id);
        return {
          top_k: config?.top_k || 0,
          chunk_size: config?.chunk_size || 0,
        };
      },
    },
  ];
}

/**
 * Evaluate rules against a probe result and return failure events
 */
export function evaluateRules(
  result: ProbeResult,
  rules: Rule[]
): FailureEvent[] {
  const events: FailureEvent[] = [];

  for (const rule of rules) {
    if (rule.condition(result)) {
      // Handle severity as either a constant or a function
      const severity =
        typeof rule.severity === "function"
          ? rule.severity(result)
          : rule.severity;
      
      const event: FailureEvent = {
        prompt_id: result.prompt_id,
        config_id: result.config_id,
        failure_mode: rule.mode,
        severity,
        breaks_at: rule.breaksAt(result),
        signal: rule.getSignal(result),
        timestamp: result.telemetry.timestamp,
      };
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Evaluate rules against multiple probe results
 */
export function evaluateAllRules(
  results: ProbeResult[],
  rules: Rule[]
): FailureEvent[] {
  const allEvents: FailureEvent[] = [];
  
  for (const result of results) {
    const events = evaluateRules(result, rules);
    allEvents.push(...events);
  }
  
  return allEvents;
}
