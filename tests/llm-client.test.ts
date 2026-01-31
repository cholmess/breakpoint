/**
 * Person A: Unit tests for llm-client
 * Tests provider inference logic
 * Run: npx tsx tests/llm-client.test.ts
 */

import * as assert from "assert";
import { inferProvider, type ProviderType } from "../src/lib/llm-client";
import type { ProbeConfig } from "../src/types";

// --- Mock Data Helpers ---

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

// --- Test: Explicit Provider (Highest Priority) ---

function testExplicitProvider(): void {
  const configOpenAI = createMockConfig({ 
    model: "gemini-1.5-flash", 
    provider: "openai" // Explicit provider overrides model name
  });
  assert.strictEqual(inferProvider(configOpenAI), "openai", "Explicit provider should take precedence");
  
  const configGemini = createMockConfig({ 
    model: "gpt-4o", 
    provider: "gemini" 
  });
  assert.strictEqual(inferProvider(configGemini), "gemini", "Explicit provider should override GPT model");
  
  const configManus = createMockConfig({ 
    model: "gpt-4", 
    provider: "manus" 
  });
  assert.strictEqual(inferProvider(configManus), "manus", "Explicit provider should work for manus");
  
  console.log("✓ inferProvider respects explicit provider field");
}

// --- Test: OpenAI Model Detection ---

function testOpenAIModels(): void {
  const gpt4o = createMockConfig({ model: "gpt-4o" });
  assert.strictEqual(inferProvider(gpt4o), "openai", "Should detect gpt-4o as OpenAI");
  
  const gpt4oMini = createMockConfig({ model: "gpt-4o-mini" });
  assert.strictEqual(inferProvider(gpt4oMini), "openai", "Should detect gpt-4o-mini as OpenAI");
  
  const gpt4Turbo = createMockConfig({ model: "gpt-4-turbo" });
  assert.strictEqual(inferProvider(gpt4Turbo), "openai", "Should detect gpt-4-turbo as OpenAI");
  
  const gpt35 = createMockConfig({ model: "gpt-3.5-turbo" });
  assert.strictEqual(inferProvider(gpt35), "openai", "Should detect gpt-3.5-turbo as OpenAI");
  
  const o1 = createMockConfig({ model: "o1-preview" });
  assert.strictEqual(inferProvider(o1), "openai", "Should detect o1-preview as OpenAI");
  
  const o1Mini = createMockConfig({ model: "o1-mini" });
  assert.strictEqual(inferProvider(o1Mini), "openai", "Should detect o1-mini as OpenAI");
  
  console.log("✓ inferProvider correctly identifies OpenAI models");
}

// --- Test: Gemini Model Detection ---

function testGeminiModels(): void {
  const flash = createMockConfig({ model: "gemini-1.5-flash" });
  assert.strictEqual(inferProvider(flash), "gemini", "Should detect gemini-1.5-flash as Gemini");
  
  const pro = createMockConfig({ model: "gemini-1.5-pro" });
  assert.strictEqual(inferProvider(pro), "gemini", "Should detect gemini-1.5-pro as Gemini");
  
  const exp = createMockConfig({ model: "gemini-2.0-flash-exp" });
  assert.strictEqual(inferProvider(exp), "gemini", "Should detect gemini-2.0-flash-exp as Gemini");
  
  console.log("✓ inferProvider correctly identifies Gemini models");
}

// --- Test: Manus Model Detection ---

function testManusModels(): void {
  const manusModel = createMockConfig({ model: "manus-v1" });
  assert.strictEqual(inferProvider(manusModel), "manus", "Should detect manus-v1 as Manus");
  
  const manusBeta = createMockConfig({ model: "manus-beta" });
  assert.strictEqual(inferProvider(manusBeta), "manus", "Should detect manus-beta as Manus");
  
  console.log("✓ inferProvider correctly identifies Manus models");
}

// --- Test: Case Insensitivity ---

function testCaseInsensitivity(): void {
  const upperGPT = createMockConfig({ model: "GPT-4O" });
  assert.strictEqual(inferProvider(upperGPT), "openai", "Should detect uppercase GPT-4O");
  
  const mixedGemini = createMockConfig({ model: "Gemini-1.5-Flash" });
  assert.strictEqual(inferProvider(mixedGemini), "gemini", "Should detect mixed case Gemini");
  
  const upperManus = createMockConfig({ model: "MANUS-V1" });
  assert.strictEqual(inferProvider(upperManus), "manus", "Should detect uppercase Manus");
  
  console.log("✓ inferProvider is case insensitive");
}

// --- Test: Unknown Model Throws (No Silent Default) ---

function testUnknownModelThrows(): void {
  const unknownModel = createMockConfig({ model: "unknown-model-123" });
  assert.throws(
    () => inferProvider(unknownModel),
    /Unknown model provider/,
    "Should throw for unknown model"
  );
  
  const emptyModel = createMockConfig({ model: "" });
  assert.throws(
    () => inferProvider(emptyModel),
    /Unknown model provider/,
    "Should throw for empty model"
  );
  
  const undefinedModel = createMockConfig({ model: undefined });
  assert.throws(
    () => inferProvider(undefinedModel),
    /Unknown model provider/,
    "Should throw for undefined model"
  );
  
  console.log("✓ inferProvider throws for unknown models (no silent default)");
}

// --- Test: Edge Cases ---

function testEdgeCases(): void {
  // Model name contains but doesn't start with prefix -> unknown, should throw
  const containsGPT = createMockConfig({ model: "my-gpt-4-model" });
  assert.throws(() => inferProvider(containsGPT), /Unknown model provider/, "Should throw if 'gpt-' not at start");
  
  // Similar prefixes (no dash) -> unknown, should throw
  const gpt = createMockConfig({ model: "gpt" });
  assert.throws(() => inferProvider(gpt), /Unknown model provider/, "Should throw for 'gpt' without dash");
  
  const gemini = createMockConfig({ model: "gemini" });
  assert.throws(() => inferProvider(gemini), /Unknown model provider/, "Should throw for 'gemini' without dash");
  
  // Whitespace -> doesn't match gpt- prefix, should throw
  const whitespace = createMockConfig({ model: "  gpt-4o  " });
  assert.throws(() => inferProvider(whitespace), /Unknown model provider/, "Whitespace should not match (no trim)");
  
  console.log("✓ inferProvider handles edge cases correctly (throws for unknown)");
}

// --- Test: Provider Type Values ---

function testProviderTypeValues(): void {
  const openaiConfig = createMockConfig({ model: "gpt-4o" });
  const provider: ProviderType = inferProvider(openaiConfig);
  
  // Verify it's one of the valid provider types
  const validProviders: ProviderType[] = ["openai", "gemini", "manus"];
  assert.ok(validProviders.includes(provider), "Provider should be one of the valid types");
  
  console.log("✓ inferProvider returns valid ProviderType");
}

// --- Test: Multiple Config Scenarios ---

function testMultipleConfigScenarios(): void {
  const configs = [
    { config: createMockConfig({ id: "a", model: "gpt-4o" }), expected: "openai" as ProviderType },
    { config: createMockConfig({ id: "b", model: "gemini-1.5-flash" }), expected: "gemini" as ProviderType },
    { config: createMockConfig({ id: "c", model: "manus-v1" }), expected: "manus" as ProviderType },
    { config: createMockConfig({ id: "d", model: "o1-mini" }), expected: "openai" as ProviderType },
  ];
  
  for (const { config, expected } of configs) {
    const result = inferProvider(config);
    assert.strictEqual(
      result,
      expected,
      `Config ${config.id} with model ${config.model} should infer ${expected}`
    );
  }
  
  // Unknown model should throw
  const unknownConfig = createMockConfig({ id: "e", model: "unknown" });
  assert.throws(() => inferProvider(unknownConfig), /Unknown model provider/, "Unknown model should throw");
  
  console.log("✓ inferProvider handles multiple config scenarios correctly");
}

// --- Test: Provider Override Consistency ---

function testProviderOverrideConsistency(): void {
  // Verify that explicit provider always wins, regardless of model name
  const providers: ProviderType[] = ["openai", "gemini", "manus"];
  const models = ["gpt-4o", "gemini-1.5-flash", "manus-v1", "unknown-model"];
  
  for (const explicitProvider of providers) {
    for (const model of models) {
      const config = createMockConfig({ model, provider: explicitProvider });
      const inferred = inferProvider(config);
      assert.strictEqual(
        inferred,
        explicitProvider,
        `Explicit provider ${explicitProvider} should override model ${model}`
      );
    }
  }
  
  console.log("✓ Explicit provider consistently overrides model inference");
}

// --- Run All Tests ---

function runAllTests(): void {
  console.log("\n🧪 Running llm-client tests...\n");
  
  try {
    testExplicitProvider();
    testOpenAIModels();
    testGeminiModels();
    testManusModels();
    testCaseInsensitivity();
    testUnknownModelThrows();
    testEdgeCases();
    testProviderTypeValues();
    testMultipleConfigScenarios();
    testProviderOverrideConsistency();
    
    console.log("\n✅ All llm-client tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

runAllTests();
