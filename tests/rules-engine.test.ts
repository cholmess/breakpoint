/**
 * Person A: Unit tests for rules-engine
 * Tests rule evaluation logic, getEnhancedRules, and failure detection
 * Run: npx tsx tests/rules-engine.test.ts
 */

import * as assert from "assert";
import {
  getDefaultRules,
  getEnhancedRules,
  evaluateRules,
  evaluateAllRules,
} from "../src/lib/rules-engine";
import type { ProbeResult, ProbeConfig, TelemetryRecord } from "../src/types";

// --- Mock Data Helpers ---

function createMockTelemetry(overrides: Partial<TelemetryRecord> = {}): TelemetryRecord {
  return {
    prompt_id: "p_001",
    config_id: "config-test",
    prompt_tokens: 100,
    retrieved_tokens: 0,
    completion_tokens: 50,
    latency_ms: 1000,
    tool_calls: 0,
    tool_timeouts: 0,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createMockProbeResult(overrides: Partial<ProbeResult> = {}): ProbeResult {
  return {
    prompt_id: "p_001",
    config_id: "config-test",
    telemetry: createMockTelemetry(),
    context_usage: 0.5,
    total_tokens: 150,
    estimated_cost: 0.001,
    ...overrides,
  };
}

function createMockConfig(overrides: Partial<ProbeConfig> = {}): ProbeConfig {
  return {
    id: "config-test",
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_output_tokens: 500,
    context_window: 8192,
    top_k: 5,
    chunk_size: 512,
    ...overrides,
  };
}

// --- Test: getDefaultRules ---

function testGetDefaultRules(): void {
  const rules = getDefaultRules();
  
  assert.ok(Array.isArray(rules), "getDefaultRules should return array");
  assert.ok(rules.length > 0, "Should have at least one rule");
  
  // Check structure of first rule
  const rule = rules[0];
  assert.ok(rule.id, "Rule should have id");
  assert.ok(rule.name, "Rule should have name");
  assert.ok(typeof rule.condition === "function", "Rule should have condition function");
  assert.ok(rule.severity, "Rule should have severity");
  assert.ok(rule.mode, "Rule should have mode");
  assert.ok(typeof rule.breaksAt === "function", "Rule should have breaksAt function");
  assert.ok(typeof rule.getSignal === "function", "Rule should have getSignal function");
  
  console.log("✓ getDefaultRules returns valid rule structure");
}

// --- Test: getEnhancedRules ---

function testGetEnhancedRules(): void {
  const configMap = new Map<string, ProbeConfig>();
  configMap.set("config-test", createMockConfig());
  
  const rules = getEnhancedRules(configMap);
  
  assert.ok(Array.isArray(rules), "getEnhancedRules should return array");
  assert.ok(rules.length > 0, "Should have at least one enhanced rule");
  
  // Check that rules can access config
  const result = createMockProbeResult({
    telemetry: createMockTelemetry({ prompt_tokens: 9000, retrieved_tokens: 0 }),
  });
  
  const contextOverflowRule = rules.find(r => r.id === "rule_context_overflow");
  assert.ok(contextOverflowRule, "Should have context_overflow rule");
  
  const shouldTrigger = contextOverflowRule!.condition(result);
  assert.ok(shouldTrigger, "Context overflow rule should trigger when tokens exceed window");
  
  console.log("✓ getEnhancedRules returns valid enhanced rules with config access");
}

// --- Test: Context Overflow Detection ---

function testContextOverflowRule(): void {
  const configMap = new Map<string, ProbeConfig>();
  configMap.set("config-small", createMockConfig({ context_window: 4096 }));
  
  const rules = getEnhancedRules(configMap);
  
  // Case 1: Within context window
  const resultOk = createMockProbeResult({
    config_id: "config-small",
    telemetry: createMockTelemetry({ prompt_tokens: 2000, retrieved_tokens: 1000 }),
  });
  
  const eventsOk = evaluateRules(resultOk, rules);
  const hasContextOverflow = eventsOk.some(e => e.failure_mode === "context_overflow");
  assert.ok(!hasContextOverflow, "Should not trigger overflow when within window");
  
  // Case 2: Exceeds context window
  const resultOverflow = createMockProbeResult({
    config_id: "config-small",
    telemetry: createMockTelemetry({ prompt_tokens: 3000, retrieved_tokens: 2000 }),
  });
  
  const eventsOverflow = evaluateRules(resultOverflow, rules);
  const hasOverflow = eventsOverflow.some(e => e.failure_mode === "context_overflow");
  assert.ok(hasOverflow, "Should trigger overflow when exceeding window");
  
  const overflowEvent = eventsOverflow.find(e => e.failure_mode === "context_overflow");
  assert.strictEqual(overflowEvent?.severity, "HIGH", "Context overflow should be HIGH severity");
  
  console.log("✓ Context overflow rule works correctly");
}

// --- Test: Silent Truncation Risk ---

function testSilentTruncationRule(): void {
  const rules = getDefaultRules();
  
  // Case 1: Low context usage
  const resultLow = createMockProbeResult({ context_usage: 0.5 });
  const eventsLow = evaluateRules(resultLow, rules);
  const hasLowTruncation = eventsLow.some(e => e.failure_mode === "silent_truncation_risk");
  assert.ok(!hasLowTruncation, "Should not trigger at 50% usage");
  
  // Case 2: High context usage (>85%)
  const resultHigh = createMockProbeResult({ context_usage: 0.9 });
  const eventsHigh = evaluateRules(resultHigh, rules);
  const hasHighTruncation = eventsHigh.some(e => e.failure_mode === "silent_truncation_risk");
  assert.ok(hasHighTruncation, "Should trigger at 90% usage");
  
  const truncationEvent = eventsHigh.find(e => e.failure_mode === "silent_truncation_risk");
  assert.strictEqual(truncationEvent?.severity, "MED", "Silent truncation should be MED severity");
  
  console.log("✓ Silent truncation risk rule works correctly");
}

// --- Test: Latency Breach ---

function testLatencyBreachRule(): void {
  const rules = getDefaultRules();
  
  // Case 1: Within SLO (< 3000ms)
  const resultOk = createMockProbeResult({
    telemetry: createMockTelemetry({ latency_ms: 2000 }),
  });
  const eventsOk = evaluateRules(resultOk, rules);
  const hasLatencyOk = eventsOk.some(e => e.failure_mode === "latency_breach");
  assert.ok(!hasLatencyOk, "Should not trigger latency breach at 2000ms");
  
  // Case 2: Moderate breach (3000-6000ms)
  const resultMed = createMockProbeResult({
    telemetry: createMockTelemetry({ latency_ms: 4000 }),
  });
  const eventsMed = evaluateRules(resultMed, rules);
  const latencyMed = eventsMed.find(e => e.failure_mode === "latency_breach");
  assert.ok(latencyMed, "Should trigger latency breach at 4000ms");
  assert.strictEqual(latencyMed?.severity, "MED", "Should be MED severity for moderate breach");
  
  // Case 3: High breach (>6000ms)
  const resultHigh = createMockProbeResult({
    telemetry: createMockTelemetry({ latency_ms: 7000 }),
  });
  const eventsHigh = evaluateRules(resultHigh, rules);
  const latencyHigh = eventsHigh.find(e => e.failure_mode === "latency_breach");
  assert.ok(latencyHigh, "Should trigger latency breach at 7000ms");
  assert.strictEqual(latencyHigh?.severity, "HIGH", "Should be HIGH severity for severe breach");
  
  console.log("✓ Latency breach rule works correctly with dynamic severity");
}

// --- Test: Cost Runaway ---

function testCostRunawayRule(): void {
  const rules = getDefaultRules();
  
  // Case 1: Low cost
  const resultLow = createMockProbeResult({ estimated_cost: 0.001 });
  const eventsLow = evaluateRules(resultLow, rules);
  const hasCostLow = eventsLow.some(e => e.failure_mode === "cost_runaway");
  assert.ok(!hasCostLow, "Should not trigger at $0.001 per probe");
  
  // Case 2: High cost (>$0.1 per probe)
  const resultHigh = createMockProbeResult({ estimated_cost: 0.15 });
  const eventsHigh = evaluateRules(resultHigh, rules);
  const hasCostHigh = eventsHigh.some(e => e.failure_mode === "cost_runaway");
  assert.ok(hasCostHigh, "Should trigger at $0.15 per probe");
  
  const costEvent = eventsHigh.find(e => e.failure_mode === "cost_runaway");
  assert.strictEqual(costEvent?.severity, "HIGH", "Cost runaway should be HIGH severity");
  
  console.log("✓ Cost runaway rule works correctly");
}

// --- Test: Tool Timeout Risk ---

function testToolTimeoutRule(): void {
  const rules = getDefaultRules();
  
  // Case 1: No tool calls
  const resultNoTools = createMockProbeResult({
    telemetry: createMockTelemetry({ tool_calls: 0, tool_timeouts: 0 }),
  });
  const eventsNoTools = evaluateRules(resultNoTools, rules);
  const hasTimeoutNoTools = eventsNoTools.some(e => e.failure_mode === "tool_timeout_risk");
  assert.ok(!hasTimeoutNoTools, "Should not trigger with no tool calls");
  
  // Case 2: Tools with no timeouts
  const resultOk = createMockProbeResult({
    telemetry: createMockTelemetry({ tool_calls: 3, tool_timeouts: 0 }),
  });
  const eventsOk = evaluateRules(resultOk, rules);
  const hasTimeoutOk = eventsOk.some(e => e.failure_mode === "tool_timeout_risk");
  assert.ok(!hasTimeoutOk, "Should not trigger when tools succeed");
  
  // Case 3: Tools with timeouts
  const resultTimeout = createMockProbeResult({
    telemetry: createMockTelemetry({ tool_calls: 3, tool_timeouts: 1 }),
  });
  const eventsTimeout = evaluateRules(resultTimeout, rules);
  const hasTimeout = eventsTimeout.some(e => e.failure_mode === "tool_timeout_risk");
  assert.ok(hasTimeout, "Should trigger when tool timeouts occur");
  
  const timeoutEvent = eventsTimeout.find(e => e.failure_mode === "tool_timeout_risk");
  assert.strictEqual(timeoutEvent?.severity, "HIGH", "Tool timeout should be HIGH severity");
  
  console.log("✓ Tool timeout risk rule works correctly");
}

// --- Test: Retrieval Noise Risk ---

function testRetrievalNoiseRule(): void {
  const configMap = new Map<string, ProbeConfig>();
  configMap.set("config-low-k", createMockConfig({ top_k: 3 }));
  configMap.set("config-high-k", createMockConfig({ top_k: 15 }));
  
  const rules = getEnhancedRules(configMap);
  
  // Case 1: Low top_k
  const resultLow = createMockProbeResult({ config_id: "config-low-k" });
  const eventsLow = evaluateRules(resultLow, rules);
  const hasNoiseLow = eventsLow.some(e => e.failure_mode === "retrieval_noise_risk");
  assert.ok(!hasNoiseLow, "Should not trigger at top_k=3");
  
  // Case 2: High top_k (>8)
  const resultHigh = createMockProbeResult({ config_id: "config-high-k" });
  const eventsHigh = evaluateRules(resultHigh, rules);
  const hasNoiseHigh = eventsHigh.some(e => e.failure_mode === "retrieval_noise_risk");
  assert.ok(hasNoiseHigh, "Should trigger at top_k=15");
  
  const noiseEvent = eventsHigh.find(e => e.failure_mode === "retrieval_noise_risk");
  assert.strictEqual(noiseEvent?.severity, "MED", "Retrieval noise should be MED severity");
  
  console.log("✓ Retrieval noise risk rule works correctly");
}

// --- Test: evaluateAllRules ---

function testEvaluateAllRules(): void {
  const rules = getDefaultRules();
  
  const results = [
    createMockProbeResult({ prompt_id: "p_001", estimated_cost: 0.001 }),
    createMockProbeResult({ prompt_id: "p_002", estimated_cost: 0.15 }), // Cost runaway
    createMockProbeResult({ 
      prompt_id: "p_003", 
      context_usage: 0.9, // Silent truncation
      telemetry: createMockTelemetry({ latency_ms: 5000 }), // Latency breach
    }),
  ];
  
  const allEvents = evaluateAllRules(results, rules);
  
  assert.ok(allEvents.length >= 3, "Should detect multiple failures across results");
  
  const hasCostRunaway = allEvents.some(e => e.failure_mode === "cost_runaway");
  const hasTruncation = allEvents.some(e => e.failure_mode === "silent_truncation_risk");
  const hasLatency = allEvents.some(e => e.failure_mode === "latency_breach");
  
  assert.ok(hasCostRunaway, "Should detect cost runaway");
  assert.ok(hasTruncation, "Should detect silent truncation");
  assert.ok(hasLatency, "Should detect latency breach");
  
  console.log("✓ evaluateAllRules processes multiple results correctly");
}

// --- Run All Tests ---

function runAllTests(): void {
  console.log("\n🧪 Running rules-engine tests...\n");
  
  try {
    testGetDefaultRules();
    testGetEnhancedRules();
    testContextOverflowRule();
    testSilentTruncationRule();
    testLatencyBreachRule();
    testCostRunawayRule();
    testToolTimeoutRule();
    testRetrievalNoiseRule();
    testEvaluateAllRules();
    
    console.log("\n✅ All rules-engine tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

runAllTests();
