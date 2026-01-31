/**
 * Person A: Unit tests for rules engine – all 6 failure modes
 * Run: npx tsx tests/rules-engine.test.ts
 */

import * as assert from "assert";
import {
  getDefaultRules,
  getEnhancedRules,
  evaluateRules,
} from "../src/lib/rules-engine";
import type { ProbeConfig, ProbeResult, TelemetryRecord } from "../src/types";

const CONFIG_ID = "cfg1";

function mockTelemetry(overrides: Partial<TelemetryRecord> = {}): TelemetryRecord {
  return {
    prompt_id: "p1",
    config_id: CONFIG_ID,
    prompt_tokens: 100,
    retrieved_tokens: 200,
    completion_tokens: 150,
    latency_ms: 500,
    tool_calls: 0,
    tool_timeouts: 0,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function mockResult(
  config: ProbeConfig,
  overrides: {
    telemetry?: Partial<TelemetryRecord>;
    context_usage?: number;
    total_tokens?: number;
    estimated_cost?: number;
  } = {}
): ProbeResult {
  const telemetry = mockTelemetry({
    config_id: config.id,
    ...overrides.telemetry,
  });
  const totalInput =
    telemetry.prompt_tokens + telemetry.retrieved_tokens;
  const context_usage =
    overrides.context_usage ?? totalInput / config.context_window;
  const total_tokens =
    overrides.total_tokens ??
    totalInput + telemetry.completion_tokens;
  const estimated_cost =
    overrides.estimated_cost ??
    (total_tokens / 1000) * config.cost_per_1k_tokens;
  return {
    prompt_id: telemetry.prompt_id,
    config_id: config.id,
    telemetry,
    context_usage,
    total_tokens,
    estimated_cost,
  };
}

function baseConfig(overrides: Partial<ProbeConfig> = {}): ProbeConfig {
  return {
    id: CONFIG_ID,
    model: "gpt-4",
    context_window: 8192,
    top_k: 5,
    chunk_size: 512,
    max_output_tokens: 2048,
    tools_enabled: false,
    temperature: 0.7,
    cost_per_1k_tokens: 0.03,
    ...overrides,
  };
}

// --- context_overflow ---
function testContextOverflow(): void {
  const config = baseConfig({ context_window: 8000 });
  const result = mockResult(config, {
    telemetry: {
      prompt_tokens: 5000,
      retrieved_tokens: 4000, // 9000 > 8000
    },
    context_usage: 9000 / 8000,
    total_tokens: 9500,
    estimated_cost: 0.2,
  });
  const configMap = new Map([[config.id, config]]);
  const rules = getEnhancedRules(configMap);
  const events = evaluateRules(result, rules);
  const overflow = events.find((e) => e.failure_mode === "context_overflow");
  assert.ok(overflow, "context_overflow should be detected when tokens exceed context_window");
  console.log("  context_overflow: ok");
}

// --- silent_truncation_risk ---
function testSilentTruncationRisk(): void {
  const config = baseConfig();
  const result = mockResult(config, {
    context_usage: 0.9, // > 0.85
  });
  const configMap = new Map([[config.id, config]]);
  const rules = getEnhancedRules(configMap);
  const events = evaluateRules(result, rules);
  const trunc = events.find((e) => e.failure_mode === "silent_truncation_risk");
  assert.ok(trunc, "silent_truncation_risk should be detected when context_usage > 0.85");
  console.log("  silent_truncation_risk: ok");
}

// --- latency_breach ---
function testLatencyBreach(): void {
  const config = baseConfig();
  const result = mockResult(config, {
    telemetry: { latency_ms: 20000 }, // > 15000
  });
  const configMap = new Map([[config.id, config]]);
  const rules = getEnhancedRules(configMap);
  const events = evaluateRules(result, rules);
  const latency = events.find((e) => e.failure_mode === "latency_breach");
  assert.ok(latency, "latency_breach should be detected when latency_ms > 15000");
  console.log("  latency_breach: ok");
}

// --- cost_runaway ---
function testCostRunaway(): void {
  const config = baseConfig();
  const result = mockResult(config, {
    estimated_cost: 0.15, // > 0.10
  });
  const configMap = new Map([[config.id, config]]);
  const rules = getEnhancedRules(configMap);
  const events = evaluateRules(result, rules);
  const cost = events.find((e) => e.failure_mode === "cost_runaway");
  assert.ok(cost, "cost_runaway should be detected when estimated_cost > 0.10");
  console.log("  cost_runaway: ok");
}

// --- tool_timeout_risk ---
function testToolTimeoutRisk(): void {
  const config = baseConfig({ tools_enabled: true });
  const result = mockResult(config, {
    telemetry: { tool_calls: 3, tool_timeouts: 1 },
  });
  const configMap = new Map([[config.id, config]]);
  const rules = getEnhancedRules(configMap);
  const events = evaluateRules(result, rules);
  const tool = events.find((e) => e.failure_mode === "tool_timeout_risk");
  assert.ok(tool, "tool_timeout_risk should be detected when tool_calls > 0 && tool_timeouts > 0");
  console.log("  tool_timeout_risk: ok");
}

// --- retrieval_noise_risk ---
function testRetrievalNoiseRisk(): void {
  const config = baseConfig({ top_k: 10 }); // > 8
  const result = mockResult(config, {
    telemetry: { retrieved_tokens: 500 },
  });
  const configMap = new Map([[config.id, config]]);
  const rules = getEnhancedRules(configMap);
  const events = evaluateRules(result, rules);
  const retrieval = events.find((e) => e.failure_mode === "retrieval_noise_risk");
  assert.ok(retrieval, "retrieval_noise_risk should be detected when top_k > 8 and retrieved_tokens > 0");
  console.log("  retrieval_noise_risk: ok");
}

// --- retrieval_noise_risk not fired when top_k <= 8 ---
function testRetrievalNoiseNotFiredWhenLowTopK(): void {
  const config = baseConfig({ top_k: 5 });
  const result = mockResult(config, {
    telemetry: { retrieved_tokens: 1000 },
  });
  const configMap = new Map([[config.id, config]]);
  const rules = getEnhancedRules(configMap);
  const events = evaluateRules(result, rules);
  const retrieval = events.find((e) => e.failure_mode === "retrieval_noise_risk");
  assert.strictEqual(retrieval, undefined, "retrieval_noise_risk should not fire when top_k <= 8");
  console.log("  retrieval_noise_risk (top_k<=8): ok");
}

// --- getDefaultRules: context_overflow with 8192 heuristic ---
function testDefaultRulesContextOverflow(): void {
  const result = mockResult(baseConfig(), {
    telemetry: { prompt_tokens: 5000, retrieved_tokens: 4000 }, // 9000 > 8192
    context_usage: 9000 / 8192,
    total_tokens: 9500,
    estimated_cost: 0.05,
  });
  const rules = getDefaultRules();
  const events = evaluateRules(result, rules);
  const overflow = events.find((e) => e.failure_mode === "context_overflow");
  assert.ok(overflow, "getDefaultRules context_overflow (8192 heuristic) should fire");
  console.log("  getDefaultRules context_overflow: ok");
}

// --- no false positives when all within bounds ---
function testNoFalsePositives(): void {
  const config = baseConfig({ top_k: 5 });
  const result = mockResult(config, {
    telemetry: {
      prompt_tokens: 500,
      retrieved_tokens: 200,
      latency_ms: 1000,
      tool_calls: 0,
      tool_timeouts: 0,
    },
    context_usage: 700 / config.context_window,
    estimated_cost: 0.02,
  });
  const configMap = new Map([[config.id, config]]);
  const rules = getEnhancedRules(configMap);
  const events = evaluateRules(result, rules);
  assert.strictEqual(
    events.length,
    0,
    "no failure events when all metrics within bounds"
  );
  console.log("  no false positives: ok");
}

function main(): void {
  console.log("\n=== Rules Engine: All 6 Failure Modes ===\n");
  testContextOverflow();
  testSilentTruncationRisk();
  testLatencyBreach();
  testCostRunaway();
  testToolTimeoutRisk();
  testRetrievalNoiseRisk();
  testRetrievalNoiseNotFiredWhenLowTopK();
  testDefaultRulesContextOverflow();
  testNoFalsePositives();
  console.log("\n✓ All rules-engine tests passed.\n");
}

main();
