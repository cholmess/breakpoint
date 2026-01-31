/**
 * Person A: Unit tests for timeline
 * Tests buildBreakFirstTimeline and break point detection
 * Run: npx tsx tests/timeline.test.ts
 */

import * as assert from "assert";
import { buildBreakFirstTimeline } from "../src/lib/timeline";
import type { FailureEvent } from "../src/types";

// --- Mock Data Helpers ---

function createMockFailureEvent(overrides: Partial<FailureEvent> = {}): FailureEvent {
  return {
    prompt_id: "p_001",
    config_id: "config-test",
    failure_mode: "latency_breach",
    severity: "MED",
    breaks_at: "latency_ms > 3000ms",
    signal: { latency_ms: 4000 },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// --- Test: Empty Events ---

function testEmptyEvents(): void {
  const timeline = buildBreakFirstTimeline([]);
  
  assert.strictEqual(timeline.break_points.length, 0, "Should have no break points for empty events");
  assert.strictEqual(Object.keys(timeline.configs).length, 0, "Should have no configs");
  
  console.log("✓ buildBreakFirstTimeline handles empty events");
}

// --- Test: Single Config, Single Failure ---

function testSingleConfigSingleFailure(): void {
  const events = [
    createMockFailureEvent({
      prompt_id: "p_005",
      config_id: "config-a",
      failure_mode: "cost_runaway",
      severity: "HIGH",
    }),
  ];
  
  const timeline = buildBreakFirstTimeline(events);
  
  assert.strictEqual(timeline.break_points.length, 1, "Should have 1 break point");
  assert.strictEqual(Object.keys(timeline.configs).length, 1, "Should have 1 config");
  
  const breakPoint = timeline.break_points[0];
  assert.strictEqual(breakPoint.config_id, "config-a", "Break point should match config");
  assert.strictEqual(breakPoint.prompt_id, "p_005", "Break point should match prompt");
  assert.strictEqual(breakPoint.failure_mode, "cost_runaway", "Break point should match failure mode");
  assert.strictEqual(breakPoint.severity, "HIGH", "Break point should match severity");
  
  console.log("✓ buildBreakFirstTimeline handles single config single failure");
}

// --- Test: Multiple Configs, Break First Detection ---

function testMultipleConfigsBreakFirst(): void {
  const events = [
    // config-a: MED severity at p_002, HIGH severity at p_005
    createMockFailureEvent({
      prompt_id: "p_002",
      config_id: "config-a",
      failure_mode: "latency_breach",
      severity: "MED",
    }),
    createMockFailureEvent({
      prompt_id: "p_005",
      config_id: "config-a",
      failure_mode: "cost_runaway",
      severity: "HIGH",
    }),
    
    // config-b: HIGH severity at p_008
    createMockFailureEvent({
      prompt_id: "p_008",
      config_id: "config-b",
      failure_mode: "context_overflow",
      severity: "HIGH",
    }),
  ];
  
  const timeline = buildBreakFirstTimeline(events);
  
  assert.strictEqual(timeline.break_points.length, 2, "Should have 2 break points (one per config)");
  assert.strictEqual(Object.keys(timeline.configs).length, 2, "Should track 2 configs");
  
  // Check config-a break point (first HIGH severity failure)
  const breakA = timeline.break_points.find(bp => bp.config_id === "config-a");
  assert.ok(breakA, "Should have break point for config-a");
  assert.strictEqual(breakA?.prompt_id, "p_005", "Config-a should break at p_005 (first HIGH failure)");
  assert.strictEqual(breakA?.failure_mode, "cost_runaway", "Should capture first HIGH failure mode");
  assert.strictEqual(breakA?.severity, "HIGH", "Break point should be HIGH severity");
  
  // Check config-b break point
  const breakB = timeline.break_points.find(bp => bp.config_id === "config-b");
  assert.ok(breakB, "Should have break point for config-b");
  assert.strictEqual(breakB?.prompt_id, "p_008", "Config-b should break at p_008");
  
  console.log("✓ buildBreakFirstTimeline detects first HIGH severity failure per config");
}

// --- Test: Same Prompt Multiple Failures ---

function testSamePromptMultipleFailures(): void {
  const events = [
    createMockFailureEvent({
      prompt_id: "p_003",
      config_id: "config-a",
      failure_mode: "latency_breach",
      severity: "MED",
    }),
    createMockFailureEvent({
      prompt_id: "p_003",
      config_id: "config-a",
      failure_mode: "cost_runaway",
      severity: "HIGH",
    }),
    createMockFailureEvent({
      prompt_id: "p_003",
      config_id: "config-a",
      failure_mode: "context_overflow",
      severity: "HIGH",
    }),
  ];
  
  const timeline = buildBreakFirstTimeline(events);
  
  assert.strictEqual(timeline.break_points.length, 1, "Should have 1 break point");
  
  const breakPoint = timeline.break_points[0];
  assert.strictEqual(breakPoint.prompt_id, "p_003", "Should break at p_003");
  
  // Should capture first failure mode (or highest severity, depending on implementation)
  assert.ok(breakPoint.failure_mode, "Should have a failure mode");
  
  console.log("✓ buildBreakFirstTimeline handles multiple failures at same prompt");
}

// --- Test: Severity Priority ---

function testSeverityPriority(): void {
  const events = [
    // config-a: MED then HIGH
    createMockFailureEvent({
      prompt_id: "p_002",
      config_id: "config-a",
      failure_mode: "silent_truncation_risk",
      severity: "MED",
    }),
    createMockFailureEvent({
      prompt_id: "p_005",
      config_id: "config-a",
      failure_mode: "cost_runaway",
      severity: "HIGH",
    }),
    
    // config-b: HIGH immediately
    createMockFailureEvent({
      prompt_id: "p_001",
      config_id: "config-b",
      failure_mode: "context_overflow",
      severity: "HIGH",
    }),
  ];
  
  const timeline = buildBreakFirstTimeline(events);
  
  assert.strictEqual(timeline.break_points.length, 2, "Should have 2 break points");
  
  // Both configs should break at their FIRST HIGH severity failure
  const breakA = timeline.break_points.find(bp => bp.config_id === "config-a");
  const breakB = timeline.break_points.find(bp => bp.config_id === "config-b");
  
  assert.ok(breakA, "Should have break point for config-a");
  assert.ok(breakB, "Should have break point for config-b");
  
  // Verify first HIGH severity is chosen
  assert.strictEqual(breakA?.prompt_id, "p_005", "Config-a should break at first HIGH (p_005)");
  assert.strictEqual(breakA?.severity, "HIGH", "Break point should be HIGH severity");
  assert.strictEqual(breakB?.prompt_id, "p_001", "Config-b should break at first HIGH (p_001)");
  assert.strictEqual(breakB?.severity, "HIGH", "Break point should be HIGH severity");
  
  console.log("✓ buildBreakFirstTimeline prioritizes first HIGH severity failure");
}

// --- Test: Multiple Configs Different Break Points ---

function testMultipleConfigsDifferentBreakPoints(): void {
  const events = [
    // config-a breaks at p_010 (first HIGH)
    createMockFailureEvent({ 
      prompt_id: "p_010", 
      config_id: "config-a", 
      severity: "HIGH",
      failure_mode: "context_overflow"
    }),
    
    // config-b breaks at p_005 (first HIGH)
    createMockFailureEvent({ 
      prompt_id: "p_005", 
      config_id: "config-b", 
      severity: "HIGH",
      failure_mode: "cost_runaway"
    }),
    
    // config-c breaks at p_015 (first HIGH)
    createMockFailureEvent({ 
      prompt_id: "p_015", 
      config_id: "config-c", 
      severity: "HIGH",
      failure_mode: "latency_breach"
    }),
    
    // config-b has another HIGH failure later (should not change break point)
    createMockFailureEvent({ 
      prompt_id: "p_020", 
      config_id: "config-b", 
      severity: "HIGH",
      failure_mode: "tool_timeout_risk"
    }),
  ];
  
  const timeline = buildBreakFirstTimeline(events);
  
  assert.strictEqual(timeline.break_points.length, 3, "Should have 3 break points (one per config)");
  assert.strictEqual(Object.keys(timeline.configs).length, 3, "Should track 3 configs");
  
  // Verify config-b's break point is at first HIGH (p_005), not the later one (p_020)
  const breakB = timeline.break_points.find(bp => bp.config_id === "config-b");
  assert.ok(breakB, "Should have break point for config-b");
  assert.strictEqual(breakB?.prompt_id, "p_005", "Config-b should break at p_005 (first HIGH), not p_020");
  
  console.log("✓ buildBreakFirstTimeline tracks multiple configs with different break points");
}

// --- Test: Timeline Structure ---

function testTimelineStructure(): void {
  const events = [
    createMockFailureEvent({ prompt_id: "p_001", config_id: "config-a", failure_mode: "latency_breach", severity: "HIGH" }),
    createMockFailureEvent({ prompt_id: "p_002", config_id: "config-a", failure_mode: "cost_runaway", severity: "MED" }),
    createMockFailureEvent({ prompt_id: "p_003", config_id: "config-b", failure_mode: "context_overflow", severity: "HIGH" }),
  ];
  
  const timeline = buildBreakFirstTimeline(events);
  
  const configIds = Object.keys(timeline.configs);
  assert.strictEqual(configIds.length, 2, "Should track unique configs");
  assert.ok(configIds.includes("config-a"), "Should include config-a");
  assert.ok(configIds.includes("config-b"), "Should include config-b");
  
  // Verify configs Record structure
  assert.ok(Array.isArray(timeline.configs["config-a"]), "Config-a should have array of break points");
  assert.ok(Array.isArray(timeline.configs["config-b"]), "Config-b should have array of break points");
  
  console.log("✓ buildBreakFirstTimeline has correct structure");
}

// --- Test: Type Structure ---

function testTypeStructure(): void {
  const timeline = buildBreakFirstTimeline([]);
  
  assert.ok(Array.isArray(timeline.break_points), "break_points should be an array");
  assert.ok(typeof timeline.configs === "object", "configs should be an object");
  assert.ok(!Array.isArray(timeline.configs), "configs should not be an array");
  
  console.log("✓ buildBreakFirstTimeline returns correct type structure");
}

// --- Run All Tests ---

function runAllTests(): void {
  console.log("\n🧪 Running timeline tests...\n");
  
  try {
    testEmptyEvents();
    testSingleConfigSingleFailure();
    testMultipleConfigsBreakFirst();
    testSamePromptMultipleFailures();
    testSeverityPriority();
    testMultipleConfigsDifferentBreakPoints();
    testTimelineStructure();
    testTypeStructure();
    
    console.log("\n✅ All timeline tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

runAllTests();
