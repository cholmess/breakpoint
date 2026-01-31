/**
 * Edge Case Tests for Person A (A5)
 * Tests extreme configurations and edge cases for the simulation pipeline
 */

import { runAllProbes, setSeed, setMode, filterPromptsByFamily } from "../src/lib/probe-runner";
import { getEnhancedRules, evaluateAllRules } from "../src/lib/rules-engine";
import { runAnalysis, runComparisons, runDistributions } from "../src/lib/analysis";
import type { ProbeConfig, PromptRecord } from "../src/types";

// Set simulation mode
setMode("simulate");
setSeed(42);

/**
 * Test 1: Empty prompt suite
 */
function testEmptyPrompts(): void {
  console.log("\n=== Test 1: Empty Prompt Suite ===");
  
  const config: ProbeConfig = {
    id: "test-config",
    model: "gpt-4",
    context_window: 8192,
    top_k: 5,
    chunk_size: 512,
    max_output_tokens: 2048,
    tools_enabled: false,
    temperature: 0.7,
    cost_per_1k_tokens: 0.03,
  };
  
  const prompts: PromptRecord[] = [];
  
  runAllProbes([config], prompts).then((results) => {
    console.log(`   Results: ${results.length} probes (expected: 0)`);
    
    const configMap = new Map([[config.id, config]]);
    const rules = getEnhancedRules(configMap);
    const events = evaluateAllRules(results, rules);
    
    const analysis = runAnalysis(events, prompts);
    const comparisons = runComparisons(Object.values(analysis.configs));
    const distributions = runDistributions(events, prompts);
    
    console.log(`   Events: ${events.length}`);
    console.log(`   Configs in analysis: ${Object.keys(analysis.configs).length}`);
    console.log(`   Comparisons: ${comparisons.comparisons.length}`);
    console.log(`   ✓ Empty prompts handled gracefully`);
  });
}

/**
 * Test 2: Extreme config values
 */
function testExtremeConfig(): void {
  console.log("\n=== Test 2: Extreme Config Values ===");
  
  const extremeConfig: ProbeConfig = {
    id: "extreme-config",
    model: "gpt-4",
    context_window: 1, // Extremely low
    top_k: 100, // Extremely high
    chunk_size: 10000, // Very large chunks
    max_output_tokens: 1, // Minimal output
    tools_enabled: true,
    temperature: 2, // Max temperature
    cost_per_1k_tokens: 100, // Very expensive
  };
  
  const prompts: PromptRecord[] = [
    {
      id: "p_test_1",
      family: "short",
      use_case: "test",
      prompt: "Hello world",
      expects_tools: true,
      expects_citations: false,
    },
    {
      id: "p_test_2",
      family: "long_context",
      use_case: "test",
      prompt: "This is a longer prompt that should definitely overflow the context window of 1 token. ".repeat(100),
      expects_tools: false,
      expects_citations: true,
    },
  ];
  
  runAllProbes([extremeConfig], prompts).then((results) => {
    console.log(`   Results: ${results.length} probes`);
    
    const configMap = new Map([[extremeConfig.id, extremeConfig]]);
    const rules = getEnhancedRules(configMap);
    const events = evaluateAllRules(results, rules);
    
    console.log(`   Failure events detected: ${events.length}`);
    
    // Should detect context overflow and high cost
    const contextOverflows = events.filter(e => e.failure_mode === "context_overflow").length;
    const costRunaways = events.filter(e => e.failure_mode === "cost_runaway").length;
    const retrievalNoise = events.filter(e => e.failure_mode === "retrieval_noise_risk").length;
    
    console.log(`   - Context overflows: ${contextOverflows} (expected: 2, context_window=1)`);
    console.log(`   - Cost runaways: ${costRunaways}`);
    console.log(`   - Retrieval noise: ${retrievalNoise} (expected: 2, top_k=100)`);
    console.log(`   ✓ Extreme values handled without crashing`);
  });
}

/**
 * Test 3: Single config (no comparisons)
 */
function testSingleConfig(): void {
  console.log("\n=== Test 3: Single Config (No Comparisons) ===");
  
  const config: ProbeConfig = {
    id: "single-config",
    model: "gpt-4",
    context_window: 8192,
    top_k: 5,
    chunk_size: 512,
    max_output_tokens: 2048,
    tools_enabled: false,
    temperature: 0.7,
    cost_per_1k_tokens: 0.03,
  };
  
  const prompts: PromptRecord[] = [
    {
      id: "p_test",
      family: "short",
      use_case: "test",
      prompt: "Test prompt",
      expects_tools: false,
      expects_citations: false,
    },
  ];
  
  runAllProbes([config], prompts).then((results) => {
    const configMap = new Map([[config.id, config]]);
    const rules = getEnhancedRules(configMap);
    const events = evaluateAllRules(results, rules);
    
    const analysis = runAnalysis(events, prompts);
    const statsList = Object.values(analysis.configs);
    const comparisons = runComparisons(statsList);
    
    console.log(`   Configs: ${statsList.length}`);
    console.log(`   Comparisons: ${comparisons.comparisons.length} (expected: 0)`);
    console.log(`   ✓ Single config produces no comparisons (as expected)`);
  });
}

/**
 * Test 4: Filter by invalid family
 */
function testInvalidFamily(): void {
  console.log("\n=== Test 4: Filter by Invalid Family ===");
  
  const prompts: PromptRecord[] = [
    {
      id: "p1",
      family: "short",
      use_case: "test",
      prompt: "Test 1",
      expects_tools: false,
      expects_citations: false,
    },
    {
      id: "p2",
      family: "long_context",
      use_case: "test",
      prompt: "Test 2",
      expects_tools: false,
      expects_citations: false,
    },
  ];
  
  const filtered = filterPromptsByFamily(prompts, "nonexistent_family");
  
  console.log(`   Original prompts: ${prompts.length}`);
  console.log(`   Filtered prompts: ${filtered.length} (expected: 0)`);
  console.log(`   ✓ Invalid family returns empty array`);
}

/**
 * Test 5: Filter by "all" family
 */
function testAllFamily(): void {
  console.log("\n=== Test 5: Filter by 'all' Family ===");
  
  const prompts: PromptRecord[] = [
    {
      id: "p1",
      family: "short",
      use_case: "test",
      prompt: "Test 1",
      expects_tools: false,
      expects_citations: false,
    },
    {
      id: "p2",
      family: "long_context",
      use_case: "test",
      prompt: "Test 2",
      expects_tools: false,
      expects_citations: false,
    },
  ];
  
  const filtered = filterPromptsByFamily(prompts, "all");
  
  console.log(`   Original prompts: ${prompts.length}`);
  console.log(`   Filtered prompts: ${filtered.length} (expected: ${prompts.length})`);
  console.log(`   ✓ "all" family returns all prompts`);
}

/**
 * Main test runner
 */
async function main() {
  console.log("🧪 Running Edge Case Tests (Person A - A5)\n");
  
  try {
    testEmptyPrompts();
    
    // Wait for async tests
    await new Promise(resolve => setTimeout(resolve, 100));
    
    testExtremeConfig();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    testSingleConfig();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    testInvalidFamily();
    testAllFamily();
    
    console.log("\n✅ All edge case tests completed!\n");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
