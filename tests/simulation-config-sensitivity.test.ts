/**
 * Verify that simulation failure rates change when config changes
 * (e.g. Config B with tools off + huge context should have lower failure rate).
 * Run: npx tsx tests/simulation-config-sensitivity.test.ts
 */

import * as assert from "assert";
import { setMode, setSeed, runAllProbes, loadPrompts } from "../src/lib/probe-runner";
import { getEnhancedRules, evaluateAllRules } from "../src/lib/rules-engine";
import {
  runAnalysis,
  computeTrialsPerConfig,
} from "../src/lib/analysis";
import type { ProbeConfig, PromptRecord } from "../src/types";

const PROMPTS_PATH = "data/prompts/prompt-suite.json";

function loadPromptsSlice(maxPrompts: number): PromptRecord[] {
  const full = loadPrompts(PROMPTS_PATH);
  return full.slice(0, maxPrompts);
}

async function runSimulation(
  configA: ProbeConfig,
  configB: ProbeConfig,
  prompts: PromptRecord[]
): Promise<{ phatA: number; phatB: number; kA: number; kB: number }> {
  setMode("simulate");
  setSeed(42);
  const configs = [configA, configB];
  const results = await runAllProbes(configs, prompts);
  const configMap = new Map(configs.map((c) => [c.id, c]));
  const rules = getEnhancedRules(configMap);
  const events = evaluateAllRules(results, rules);
  const trialsPerConfig = computeTrialsPerConfig(results);
  const analysis = runAnalysis(events, prompts, configs.map((c) => c.id), trialsPerConfig);
  const statsA = analysis.configs[configA.id];
  const statsB = analysis.configs[configB.id];
  assert.ok(statsA && statsB, "both configs should have stats");
  return {
    phatA: statsA.phat,
    phatB: statsB.phat,
    kA: statsA.k,
    kB: statsB.k,
  };
}

async function main(): Promise<void> {
  console.log("Simulation config-sensitivity test\n");

  const prompts = loadPromptsSlice(40);
  assert.ok(prompts.length >= 20, "need at least 20 prompts");

  const configA: ProbeConfig = {
    id: "config-a",
    model: "gpt-4",
    context_window: 8192,
    top_k: 10,
    chunk_size: 512,
    max_output_tokens: 2048,
    tools_enabled: true,
    temperature: 0.7,
    cost_per_1k_tokens: 0.03,
  };

  const configBNormal: ProbeConfig = {
    id: "config-b",
    model: "gpt-4",
    context_window: 16384,
    top_k: 4,
    chunk_size: 1024,
    max_output_tokens: 4096,
    tools_enabled: true,
    temperature: 0.5,
    cost_per_1k_tokens: 0.03,
  };

  const configBModified: ProbeConfig = {
    ...configBNormal,
    tools_enabled: false,
    context_window: 512 * 1024, // 512k – above CONTEXT_AT_RISK_MAX (256k)
  };

  const resultNormal = await runSimulation(configA, configBNormal, prompts);
  const resultModified = await runSimulation(configA, configBModified, prompts);

  console.log("B normal (tools on, 16k context):", resultNormal.phatB.toFixed(2), `(${resultNormal.kB}/${prompts.length})`);
  console.log("B modified (tools off, 512k context):", resultModified.phatB.toFixed(2), `(${resultModified.kB}/${prompts.length})`);

  assert.ok(
    resultModified.kB <= resultNormal.kB,
    "Modified B (tools off, huge context) should have fewer or equal failures than normal B"
  );
  assert.ok(
    resultModified.phatB < resultNormal.phatB || resultModified.kB < resultNormal.kB,
    "Modified B should have strictly lower failure rate or fewer failures"
  );

  console.log("\nConfig-sensitivity check passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
