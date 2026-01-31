#!/usr/bin/env node
/**
 * CLI Entry Point for Person B Analysis
 * Loads failure events and prompts, runs probability layer, writes analysis.json, comparisons.json, distributions.json
 */

import * as fs from "fs";
import * as path from "path";
import { loadPrompts } from "../lib/probe-runner";
import {
  runAnalysis,
  runComparisons,
  runDistributions,
} from "../lib/analysis";
import type { FailureEvent } from "../types";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const FAILURE_EVENTS_PATHS = [
  path.join(process.cwd(), "output", "failure-events.json"),
  path.join(process.cwd(), "tests", "fixtures", "failure-events.json"),
];
const PROMPTS_PATHS_REL = [
  "data/prompts/prompt-suite.json",
  "data/prompts/suite.json",
];

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function writeOutput(filename: string, data: unknown): void {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`✓ Written: ${filePath}`);
}

function loadFailureEvents(): FailureEvent[] {
  for (const p of FAILURE_EVENTS_PATHS) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      const data = JSON.parse(content);
      const events = Array.isArray(data) ? data : (data.events ?? []);
      console.log(`   Loaded ${events.length} failure event(s) from ${path.relative(process.cwd(), p)}`);
      return events as FailureEvent[];
    }
  }
  console.error("No failure-events.json found. Run 'npm run probes' first or ensure tests/fixtures/failure-events.json exists.");
  process.exit(1);
}

function loadPromptsForAnalysis(): ReturnType<typeof loadPrompts> {
  for (const p of PROMPTS_PATHS_REL) {
    const fullPath = path.join(process.cwd(), p);
    if (fs.existsSync(fullPath)) {
      const prompts = loadPrompts(p);
      console.log(`   Loaded ${prompts.length} prompt(s) from ${p}`);
      return prompts;
    }
  }
  console.error("No prompt suite found at data/prompts/prompt-suite.json or data/prompts/suite.json");
  process.exit(1);
}

function main(): void {
  console.log("📊 Person B - Probability & Analytics Pipeline\n");

  try {
    console.log("📂 Loading inputs...");
    const events = loadFailureEvents();
    const prompts = loadPromptsForAnalysis();
    console.log("");

    if (events.length === 0) {
      console.log("No failure events; writing empty outputs.");
      writeOutput("analysis.json", { configs: {} });
      writeOutput("comparisons.json", { comparisons: [] });
      writeOutput("distributions.json", { by_failure_mode: {}, by_prompt_family: {} });
      console.log("\n✅ Done.");
      return;
    }

    console.log("🔬 Running analysis...");
    const analysisOutput = runAnalysis(events, prompts);
    const statsList = Object.values(analysisOutput.configs);
    const comparisonsOutput = runComparisons(statsList);
    const distributionsOutput = runDistributions(events, prompts);
    console.log("");

    console.log("💾 Writing outputs...");
    writeOutput("analysis.json", analysisOutput);
    writeOutput("comparisons.json", comparisonsOutput);
    writeOutput("distributions.json", distributionsOutput);

    console.log("\n✅ Pipeline completed successfully.\n");
    console.log("📁 Output files:");
    console.log("   - output/analysis.json");
    console.log("   - output/comparisons.json");
    console.log("   - output/distributions.json");
  } catch (err) {
    console.error("\n❌ Error:", err);
    if (err instanceof Error) {
      console.error("   Message:", err.message);
      console.error("   Stack:", err.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
