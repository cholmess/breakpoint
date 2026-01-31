/**
 * Person A: Unit tests for probe-runner
 * Tests config/prompt loading, probe execution, and mode switching
 * Run: npx tsx tests/probe-runner.test.ts
 */

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  loadConfigs,
  loadPrompts,
  loadDomainPrompts,
  setSeed,
  setMode,
  getMode,
  runProbe,
  runAllProbes,
  type ExecutionMode,
} from "../src/lib/probe-runner";
import { clearTelemetry } from "../src/lib/telemetry-logger";
import type { ProbeConfig, PromptRecord } from "../src/types";

// --- Test: Load Configs from Directory ---

function testLoadConfigs(): void {
  // Test loading from existing configs directory
  const configs = loadConfigs("configs");
  
  assert.ok(Array.isArray(configs), "Should return array");
  assert.ok(configs.length > 0, "Should load at least one config");
  
  // Verify config structure
  const config = configs[0];
  assert.ok(config.id, "Config should have id");
  assert.ok(config.model, "Config should have model");
  assert.ok(typeof config.temperature === "number", "Config should have temperature");
  assert.ok(typeof config.context_window === "number", "Config should have context_window");
  
  console.log(`✓ loadConfigs loaded ${configs.length} configs from directory`);
}

// --- Test: Load Configs - Directory Not Found ---

function testLoadConfigsNotFound(): void {
  try {
    loadConfigs("nonexistent-dir");
    assert.fail("Should throw error for nonexistent directory");
  } catch (error) {
    assert.ok(error instanceof Error, "Should throw Error");
    assert.ok(error.message.includes("not found"), "Error should mention not found");
  }
  
  console.log("✓ loadConfigs throws error for nonexistent directory");
}

// --- Test: Load Prompts from File ---

function testLoadPrompts(): void {
  // Test loading from existing suite file
  const prompts = loadPrompts("data/prompts/suite.json");
  
  assert.ok(Array.isArray(prompts), "Should return array");
  assert.ok(prompts.length > 0, "Should load at least one prompt");
  
  // Verify prompt structure
  const prompt = prompts[0];
  assert.ok(prompt.id, "Prompt should have id");
  assert.ok(prompt.prompt, "Prompt should have prompt text");
  assert.ok(prompt.family, "Prompt should have family");
  
  console.log(`✓ loadPrompts loaded ${prompts.length} prompts from file`);
}

// --- Test: Load Domain Prompts ---

function testLoadDomainPrompts(): void {
  // Note: suite.json is in simple array format, not domain suite format
  // This test verifies the function throws appropriate error
  try {
    loadDomainPrompts("data/prompts/suite.json");
    console.log("⚠ Skipping loadDomainPrompts test: suite.json is not in domain format");
  } catch (error) {
    // Expected - suite.json doesn't have suite_metadata format
    assert.ok(error instanceof Error, "Should throw error for non-domain format");
    console.log("✓ loadDomainPrompts validates domain suite format");
  }
}

// --- Test: Load Prompts - File Not Found ---

function testLoadPromptsNotFound(): void {
  try {
    loadPrompts("nonexistent-file.json");
    assert.fail("Should throw error for nonexistent file");
  } catch (error) {
    assert.ok(error instanceof Error, "Should throw Error");
    assert.ok(error.message.includes("not found"), "Error should mention not found");
  }
  
  console.log("✓ loadPrompts throws error for nonexistent file");
}

// --- Test: Execution Mode ---

function testExecutionMode(): void {
  // Default mode should be simulate
  setMode("simulate");
  assert.strictEqual(getMode(), "simulate", "Should start in simulate mode");
  
  // Switch to real mode
  setMode("real");
  assert.strictEqual(getMode(), "real", "Should switch to real mode");
  
  // Switch back to simulate
  setMode("simulate");
  assert.strictEqual(getMode(), "simulate", "Should switch back to simulate mode");
  
  console.log("✓ setMode and getMode work correctly");
}

// --- Test: Deterministic Seed ---

async function testDeterministicSeed(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  
  // Load test data
  const configs = loadConfigs("configs");
  const prompts = loadPrompts("data/prompts/suite.json");
  
  if (configs.length === 0 || prompts.length === 0) {
    console.log("⚠ Skipping seed test: no configs or prompts available");
    return;
  }
  
  // Run with seed 42
  setSeed(42);
  const result1 = await runProbe(configs[0], prompts[0]);
  
  // Run again with same seed
  setSeed(42);
  const result2 = await runProbe(configs[0], prompts[0]);
  
  // Results should be identical
  assert.strictEqual(
    result1.telemetry.latency_ms,
    result2.telemetry.latency_ms,
    "Latency should be identical with same seed"
  );
  assert.strictEqual(
    result1.telemetry.completion_tokens,
    result2.telemetry.completion_tokens,
    "Completion tokens should be identical with same seed"
  );
  
  console.log("✓ setSeed produces deterministic results");
}

// --- Test: Run Single Probe (Simulate Mode) ---

async function testRunProbe(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  setSeed(42);
  
  const configs = loadConfigs("configs");
  const prompts = loadPrompts("data/prompts/suite.json");
  
  if (configs.length === 0 || prompts.length === 0) {
    console.log("⚠ Skipping runProbe test: no configs or prompts available");
    return;
  }
  
  const result = await runProbe(configs[0], prompts[0]);
  
  // Verify result structure
  assert.ok(result.prompt_id, "Result should have prompt_id");
  assert.ok(result.config_id, "Result should have config_id");
  assert.ok(result.telemetry, "Result should have telemetry");
  assert.ok(typeof result.context_usage === "number", "Result should have context_usage");
  assert.ok(typeof result.total_tokens === "number", "Result should have total_tokens");
  assert.ok(typeof result.estimated_cost === "number", "Result should have estimated_cost");
  
  // Verify telemetry structure
  assert.ok(result.telemetry.prompt_tokens >= 0, "Should have prompt_tokens");
  assert.ok(result.telemetry.completion_tokens >= 0, "Should have completion_tokens");
  assert.ok(result.telemetry.latency_ms > 0, "Should have positive latency");
  
  // Verify context usage is between 0 and 1
  assert.ok(result.context_usage >= 0, "Context usage should be >= 0");
  assert.ok(result.context_usage <= 1, "Context usage should be <= 1");
  
  console.log("✓ runProbe generates valid probe result");
}

// --- Test: Run All Probes ---

async function testRunAllProbes(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  setSeed(42);
  
  const configs = loadConfigs("configs");
  const prompts = loadPrompts("data/prompts/suite.json");
  
  if (configs.length === 0 || prompts.length === 0) {
    console.log("⚠ Skipping runAllProbes test: no configs or prompts available");
    return;
  }
  
  // Use subset for faster testing
  const testConfigs = configs.slice(0, 2);
  const testPrompts = prompts.slice(0, 5);
  
  const results = await runAllProbes(testConfigs, testPrompts);
  
  const expectedCount = testConfigs.length * testPrompts.length;
  assert.strictEqual(results.length, expectedCount, `Should run ${expectedCount} probes`);
  
  // Verify all combinations are present
  for (const config of testConfigs) {
    for (const prompt of testPrompts) {
      const found = results.some(
        r => r.config_id === config.id && r.prompt_id === prompt.id
      );
      assert.ok(found, `Should have result for ${config.id} × ${prompt.id}`);
    }
  }
  
  console.log(`✓ runAllProbes executed ${results.length} probes correctly`);
}

// --- Test: Telemetry Generation - Short Prompts ---

async function testTelemetryGenerationShort(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  setSeed(42);
  
  const configs = loadConfigs("configs");
  
  if (configs.length === 0) {
    console.log("⚠ Skipping short prompt test: no configs available");
    return;
  }
  
  const shortPrompt: PromptRecord = {
    id: "test_short",
    family: "short",
    use_case: "test",
    prompt: "Brief question?",
    expects_tools: false,
    expects_citations: false,
  };
  
  const result = await runProbe(configs[0], shortPrompt);
  
  // Short prompts should have modest token counts
  assert.ok(result.telemetry.completion_tokens < 500, "Short prompt should have < 500 completion tokens");
  
  console.log("✓ Telemetry generation handles short prompts");
}

// --- Test: Telemetry Generation - Tool-Heavy Prompts ---

async function testTelemetryGenerationToolHeavy(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  setSeed(42);
  
  const configs = loadConfigs("configs");
  
  if (configs.length === 0) {
    console.log("⚠ Skipping tool-heavy test: no configs available");
    return;
  }
  
  // Find a config with tools enabled
  const toolConfig = configs.find(c => c.tools_enabled);
  
  if (!toolConfig) {
    console.log("⚠ Skipping tool-heavy test: no configs with tools_enabled");
    return;
  }
  
  const toolPrompt: PromptRecord = {
    id: "test_tools",
    family: "tool_heavy",
    use_case: "test",
    prompt: "Use tools to complete this task",
    expects_tools: true,
    expects_citations: false,
  };
  
  const result = await runProbe(toolConfig, toolPrompt);
  
  // Tool-heavy prompts with tools_enabled should potentially have tool calls
  // (Note: randomness means not guaranteed, but structure should be valid)
  assert.ok(result.telemetry.tool_calls >= 0, "Should have tool_calls field");
  assert.ok(result.telemetry.tool_timeouts >= 0, "Should have tool_timeouts field");
  
  console.log("✓ Telemetry generation handles tool-heavy prompts");
}

// --- Test: Telemetry Generation - Doc Grounded ---

async function testTelemetryGenerationDocGrounded(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  setSeed(42);
  
  const configs = loadConfigs("configs");
  
  if (configs.length === 0) {
    console.log("⚠ Skipping doc grounded test: no configs available");
    return;
  }
  
  const docPrompt: PromptRecord = {
    id: "test_doc",
    family: "doc_grounded",
    use_case: "test",
    prompt: "Answer based on retrieved documents",
    expects_tools: false,
    expects_citations: true,
  };
  
  const result = await runProbe(configs[0], docPrompt);
  
  // Doc grounded prompts should have retrieved tokens
  assert.ok(result.telemetry.retrieved_tokens > 0, "Doc grounded should have retrieved_tokens > 0");
  
  console.log("✓ Telemetry generation handles doc_grounded prompts with retrieval");
}

// --- Test: Cost Estimation ---

async function testCostEstimation(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  setSeed(42);
  
  const configs = loadConfigs("configs");
  const prompts = loadPrompts("data/prompts/suite.json");
  
  if (configs.length === 0 || prompts.length === 0) {
    console.log("⚠ Skipping cost test: no configs or prompts available");
    return;
  }
  
  const result = await runProbe(configs[0], prompts[0]);
  
  // Cost should be calculated based on total tokens
  const expectedCost =
    (result.total_tokens / 1000) * configs[0].cost_per_1k_tokens;
  
  assert.strictEqual(
    result.estimated_cost.toFixed(6),
    expectedCost.toFixed(6),
    "Cost should match calculation"
  );
  
  console.log("✓ Cost estimation is calculated correctly");
}

// --- Test: Context Usage Calculation ---

async function testContextUsageCalculation(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  setSeed(42);
  
  const configs = loadConfigs("configs");
  const prompts = loadPrompts("data/prompts/suite.json");
  
  if (configs.length === 0 || prompts.length === 0) {
    console.log("⚠ Skipping context usage test: no configs or prompts available");
    return;
  }
  
  const result = await runProbe(configs[0], prompts[0]);
  
  // Context usage should be input tokens / context window
  const totalInputTokens =
    result.telemetry.prompt_tokens + result.telemetry.retrieved_tokens;
  const expectedUsage = totalInputTokens / configs[0].context_window;
  
  assert.strictEqual(
    result.context_usage.toFixed(6),
    expectedUsage.toFixed(6),
    "Context usage should match calculation"
  );
  
  console.log("✓ Context usage is calculated correctly");
}

// --- Test: Probe Result Completeness ---

async function testProbeResultCompleteness(): Promise<void> {
  clearTelemetry();
  setMode("simulate");
  setSeed(42);
  
  const configs = loadConfigs("configs");
  const prompts = loadPrompts("data/prompts/suite.json");
  
  if (configs.length === 0 || prompts.length === 0) {
    console.log("⚠ Skipping completeness test: no configs or prompts available");
    return;
  }
  
  const result = await runProbe(configs[0], prompts[0]);
  
  // Verify all required fields are present
  const requiredFields = [
    "prompt_id",
    "config_id",
    "telemetry",
    "context_usage",
    "total_tokens",
    "estimated_cost",
  ];
  
  for (const field of requiredFields) {
    assert.ok(field in result, `Result should have ${field}`);
  }
  
  // Verify telemetry has all required fields
  const requiredTelemetryFields = [
    "prompt_id",
    "config_id",
    "prompt_tokens",
    "retrieved_tokens",
    "completion_tokens",
    "latency_ms",
    "tool_calls",
    "tool_timeouts",
    "timestamp",
  ];
  
  for (const field of requiredTelemetryFields) {
    assert.ok(field in result.telemetry, `Telemetry should have ${field}`);
  }
  
  console.log("✓ Probe result has all required fields");
}

// --- Run All Tests ---

async function runAllTests(): Promise<void> {
  console.log("\n🧪 Running probe-runner tests...\n");
  
  try {
    testLoadConfigs();
    testLoadConfigsNotFound();
    testLoadPrompts();
    testLoadDomainPrompts();
    testLoadPromptsNotFound();
    testExecutionMode();
    await testDeterministicSeed();
    await testRunProbe();
    await testRunAllProbes();
    await testTelemetryGenerationShort();
    await testTelemetryGenerationToolHeavy();
    await testTelemetryGenerationDocGrounded();
    await testCostEstimation();
    await testContextUsageCalculation();
    await testProbeResultCompleteness();
    
    // Clean up
    clearTelemetry();
    
    console.log("\n✅ All probe-runner tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    
    // Clean up on failure
    clearTelemetry();
    
    process.exit(1);
  }
}

runAllTests();
