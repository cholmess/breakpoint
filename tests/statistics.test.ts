/**
 * Person B: Unit tests for probability and statistics layer
 * Run: npx tsx tests/statistics.test.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as assert from "assert";
import { estimatePhat } from "../src/lib/probability";
import {
  bootstrapCI,
  bayesianBetaCI,
  compareConfigs,
  setStatsSeed,
} from "../src/lib/statistics";
import {
  runAnalysis,
  runComparisons,
  runDistributions,
  modeDistributions,
} from "../src/lib/analysis";
import type { FailureEvent, PromptRecord } from "../src/types";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "failure-events.json");

function loadFixture(): FailureEvent[] {
  const content = fs.readFileSync(FIXTURE_PATH, "utf-8");
  return JSON.parse(content) as FailureEvent[];
}

// Mock prompts use the same 8 families as data/prompts/prompt-suite.json:
// short_plain, short_tool_heavy, short_doc_grounded, short_tool_and_doc,
// long_plain, long_tool_heavy, long_doc_grounded, long_tool_and_doc
function mockPrompts(): PromptRecord[] {
  return [
    { id: "p_001", family: "short_plain", use_case: "general_qa", prompt: "?", expects_tools: false, expects_citations: false },
    { id: "p_002", family: "long_plain", use_case: "legal_qa", prompt: "?", expects_tools: false, expects_citations: false },
    { id: "p_003", family: "short_tool_heavy", use_case: "code_help", prompt: "?", expects_tools: true, expects_citations: false },
    { id: "p_004", family: "short_doc_grounded", use_case: "doc_qa", prompt: "?", expects_tools: false, expects_citations: true },
    { id: "p_005", family: "short_plain", use_case: "summarization", prompt: "?", expects_tools: false, expects_citations: false },
    { id: "p_006", family: "long_plain", use_case: "research", prompt: "?", expects_tools: false, expects_citations: false },
  ];
}

// --- estimatePhat ---
function testEstimatePhat(): void {
  const events = loadFixture();
  const n = mockPrompts().length;

  const statsA = estimatePhat(events, "A", n);
  assert.strictEqual(statsA.config_id, "A");
  assert.strictEqual(statsA.n, n);
  assert.ok(statsA.k >= 0 && statsA.k <= n);
  assert.ok(statsA.phat >= 0 && statsA.phat <= 1);
  assert.strictEqual(statsA.phat, statsA.k / statsA.n);

  const statsB = estimatePhat(events, "B", n);
  assert.strictEqual(statsB.config_id, "B");

  const emptyStats = estimatePhat([], "A", 10);
  assert.strictEqual(emptyStats.k, 0);
  assert.strictEqual(emptyStats.n, 10);
  assert.strictEqual(emptyStats.phat, 0);

  const zeroTrials = estimatePhat([], "A", 0);
  assert.strictEqual(zeroTrials.k, 0);
  assert.strictEqual(zeroTrials.n, 0);
  assert.strictEqual(zeroTrials.phat, 0);

  const negTrials = estimatePhat([], "A", -5);
  assert.strictEqual(negTrials.k, 0);
  assert.strictEqual(negTrials.n, 0);
  assert.strictEqual(negTrials.phat, 0);

  const allFail = estimatePhat(events, "A", 3);
  assert.ok(allFail.k <= 3);

  // E1: config with no events still gets k=0, n=totalTrials, phat=0
  const noFailuresConfig = estimatePhat([], "config-no-failures", 100);
  assert.strictEqual(noFailuresConfig.k, 0);
  assert.strictEqual(noFailuresConfig.n, 100);
  assert.strictEqual(noFailuresConfig.phat, 0);

  // E1: k is clamped to n so phat never exceeds 1 (guards against bad data)
  const badDataEvents: FailureEvent[] = [
    { prompt_id: "p1", config_id: "C", failure_mode: "latency_breach", severity: "MED", breaks_at: "", signal: {}, timestamp: "" },
    { prompt_id: "p2", config_id: "C", failure_mode: "latency_breach", severity: "MED", breaks_at: "", signal: {}, timestamp: "" },
  ];
  const statsN2 = estimatePhat(badDataEvents, "C", 2);
  assert.ok(statsN2.k <= statsN2.n);
  assert.ok(statsN2.phat >= 0 && statsN2.phat <= 1);

  console.log("  estimatePhat: ok");
}

// --- bootstrapCI ---
function testBootstrapCI(): void {
  setStatsSeed(42);
  const [lo, hi] = bootstrapCI(5, 100);
  assert.ok(lo >= 0 && lo <= 1);
  assert.ok(hi >= 0 && hi <= 1);
  assert.ok(lo <= hi);

  const [lo0, hi0] = bootstrapCI(0, 100);
  assert.ok(lo0 >= 0 && hi0 <= 1);

  const [lo1, hi1] = bootstrapCI(100, 100);
  assert.strictEqual(lo1, 1);
  assert.strictEqual(hi1, 1);

  const [loN1, hiN1] = bootstrapCI(0, 1);
  assert.ok(loN1 <= hiN1);

  const [loEmpty, hiEmpty] = bootstrapCI(0, 0);
  assert.strictEqual(loEmpty, 0);
  assert.strictEqual(hiEmpty, 0);

  const [loKgtN, hiKgtN] = bootstrapCI(15, 10);
  assert.ok(loKgtN >= 0 && hiKgtN <= 1 && loKgtN <= hiKgtN, "k>n clamped");

  // Custom alpha: 90% CI (alpha=0.1) should be narrower than 95% CI (alpha=0.05)
  const [lo95, hi95] = bootstrapCI(5, 100);
  const [lo90, hi90] = bootstrapCI(5, 100, 0.1);
  assert.ok(hi90 - lo90 <= hi95 - lo95 + 1e-10, "90% CI should be narrower than or equal to 95% CI");
  assert.ok(lo90 >= 0 && hi90 <= 1 && lo90 <= hi90, "90% CI bounds valid");

  console.log("  bootstrapCI: ok");
}

// --- bayesianBetaCI ---
function testBayesianBetaCI(): void {
  setStatsSeed(42);
  const [lo, hi] = bayesianBetaCI(5, 100);
  assert.ok(lo >= 0 && lo <= 1);
  assert.ok(hi >= 0 && hi <= 1);
  assert.ok(lo <= hi);

  const [lo0, hi0] = bayesianBetaCI(0, 100);
  assert.ok(lo0 >= 0 && hi0 <= 1);

  const [loAll, hiAll] = bayesianBetaCI(100, 100);
  assert.ok(loAll >= 0.9 && hiAll <= 1);

  const [loEmpty, hiEmpty] = bayesianBetaCI(0, 0);
  assert.strictEqual(loEmpty, 0);
  assert.strictEqual(hiEmpty, 0);

  const [loKgtN, hiKgtN] = bayesianBetaCI(12, 10);
  assert.ok(loKgtN >= 0 && hiKgtN <= 1 && loKgtN <= hiKgtN, "k>n clamped");

  // Custom alpha: 90% CI (alpha=0.1) should be narrower than 95% CI (alpha=0.05)
  const [lo95, hi95] = bayesianBetaCI(5, 100);
  const [lo90, hi90] = bayesianBetaCI(5, 100, 0.1);
  assert.ok(hi90 - lo90 <= hi95 - lo95 + 1e-10, "90% CI should be narrower than or equal to 95% CI");
  assert.ok(lo90 >= 0 && hi90 <= 1 && lo90 <= hi90, "90% CI bounds valid");

  console.log("  bayesianBetaCI: ok");
}

// --- compareConfigs ---
function testCompareConfigs(): void {
  setStatsSeed(42);
  const a = { config_id: "A", k: 2, n: 10, phat: 0.2 };
  const b = { config_id: "B", k: 8, n: 10, phat: 0.8 };
  const { pASafer } = compareConfigs(a, b);
  assert.ok(pASafer >= 0 && pASafer <= 1);
  assert.ok(pASafer > 0.5, "A should be safer than B");

  const { pASafer: pEqual } = compareConfigs(a, a);
  assert.ok(Math.abs(pEqual - 0.5) < 0.1);

  const c = { config_id: "C", k: 0, n: 10, phat: 0 };
  const { pASafer: pCSafer } = compareConfigs(c, a);
  assert.ok(pCSafer > 0.5);

  const noData = { config_id: "X", k: 0, n: 0, phat: 0 };
  const { pASafer: pIndet } = compareConfigs(noData, a);
  assert.strictEqual(pIndet, 0.5, "n=0 returns indeterminate 0.5");
  console.log("  compareConfigs: ok");
}

// --- modeDistributions ---
function testModeDistributions(): void {
  const events = loadFixture();
  const prompts = mockPrompts();
  const out = modeDistributions(events, prompts);
  assert.ok(typeof out.by_failure_mode === "object");
  assert.ok(typeof out.by_prompt_family === "object");
  let modeSum = 0;
  for (const entry of Object.values(out.by_failure_mode)) {
    assert.ok(entry.count >= 0);
    assert.ok(entry.proportion >= 0 && entry.proportion <= 1);
    modeSum += entry.count;
  }
  assert.strictEqual(modeSum, events.length);

  const emptyOut = modeDistributions([], mockPrompts());
  assert.deepStrictEqual(emptyOut.by_failure_mode, {});
  assert.deepStrictEqual(emptyOut.by_prompt_family, {});
  console.log("  modeDistributions: ok");
}

// --- Integration: full pipeline ---
function testIntegration(): void {
  const events = loadFixture();
  const prompts = mockPrompts();

  const analysisOutput = runAnalysis(events, prompts);
  assert.ok(Object.keys(analysisOutput.configs).length >= 1);
  for (const stats of Object.values(analysisOutput.configs)) {
    assert.ok(stats.ci_bootstrap);
    assert.ok(stats.ci_bayesian);
    assert.strictEqual(stats.ci_bootstrap!.length, 2);
    assert.strictEqual(stats.ci_bayesian!.length, 2);
  }

  const statsList = Object.values(analysisOutput.configs);
  const comparisonsOutput = runComparisons(statsList);
  assert.ok(Array.isArray(comparisonsOutput.comparisons));
  if (statsList.length >= 2) {
    assert.ok(comparisonsOutput.comparisons.length >= 1);
  }

  const distributionsOutput = runDistributions(events, prompts);
  assert.ok(Object.keys(distributionsOutput.by_failure_mode).length >= 1);
  assert.ok(Object.keys(distributionsOutput.by_prompt_family).length >= 1);

  const emptyAnalysis = runAnalysis([], prompts);
  assert.deepStrictEqual(emptyAnalysis.configs, {});

  // E1: when allConfigIds is passed, configs with 0 failures are included
  const analysisWithZeroFailureConfigs = runAnalysis(events, prompts, ["A", "B", "config-zero-failures"]);
  assert.ok("A" in analysisWithZeroFailureConfigs.configs);
  assert.ok("B" in analysisWithZeroFailureConfigs.configs);
  assert.ok("config-zero-failures" in analysisWithZeroFailureConfigs.configs);
  const zeroFailStats = analysisWithZeroFailureConfigs.configs["config-zero-failures"];
  assert.strictEqual(zeroFailStats.k, 0);
  assert.strictEqual(zeroFailStats.n, prompts.length);
  assert.strictEqual(zeroFailStats.phat, 0);

  const emptyDist = runDistributions([], prompts);
  assert.deepStrictEqual(emptyDist.by_failure_mode, {});
  assert.deepStrictEqual(emptyDist.by_prompt_family, {});
  const emptyComp = runComparisons([]);
  assert.deepStrictEqual(emptyComp.comparisons, []);
  assert.deepStrictEqual(runComparisons(statsList.slice(0, 1)).comparisons, []);

  console.log("  integration: ok");
}

function run(): void {
  console.log("Person B statistics tests\n");
  testEstimatePhat();
  testBootstrapCI();
  testBayesianBetaCI();
  testCompareConfigs();
  testModeDistributions();
  testIntegration();
  console.log("\nAll tests passed.");
}

run();
