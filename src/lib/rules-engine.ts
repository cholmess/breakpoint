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

// Default thresholds for rules
const LATENCY_SLO_MS = 3000; // 3 seconds
const COST_THRESHOLD_DAILY = 100; // $100 per day (assuming ~1000 probes/day)
const RETRIEVAL_NOISE_THRESHOLD = 8; // top_k > 8 considered noisy

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
        return config.top_k > RETRIEVAL_NOISE_THRESHOLD;
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
