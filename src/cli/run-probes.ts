#!/usr/bin/env node
/**
 * CLI Entry Point for Probe Runner
 * Orchestrates the full pipeline: load configs/prompts, run probes, evaluate rules, build timeline
 */

import * as fs from "fs";
import * as path from "path";
import {
  loadConfigs,
  loadPrompts,
  runAllProbes,
  setSeed,
} from "../lib/probe-runner";
import {
  getEnhancedRules,
  evaluateAllRules,
} from "../lib/rules-engine";
import { buildBreakFirstTimeline } from "../lib/timeline";
import { clearTelemetry } from "../lib/telemetry-logger";
import type { ProbeConfig, FailureEvent } from "../types";

const OUTPUT_DIR = path.join(process.cwd(), "output");

/**
 * Ensure output directory exists
 */
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Write JSON file to output directory
 */
function writeOutput(filename: string, data: any): void {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`✓ Written: ${filePath}`);
}

/**
 * Main execution function
 */
async function main() {
  console.log("🚀 Starting Probabilistic Failure Simulator - Person A Pipeline\n");

  try {
    // Set deterministic seed for reproducibility
    const seed = process.env.SEED ? parseInt(process.env.SEED, 10) : 42;
    setSeed(seed);
    console.log(`📌 Using seed: ${seed}\n`);

    // Clear previous telemetry
    clearTelemetry();
    console.log("🧹 Cleared previous telemetry\n");

    // Load configs and prompts
    console.log("📂 Loading configurations and prompts...");
    const configs = loadConfigs("configs");
    const prompts = loadPrompts("data/prompts/suite.json");
    console.log(`   Loaded ${configs.length} config(s): ${configs.map((c) => c.id).join(", ")}`);
    console.log(`   Loaded ${prompts.length} prompt(s)\n`);

    // Create config map for enhanced rules
    const configMap = new Map<string, ProbeConfig>();
    for (const config of configs) {
      configMap.set(config.id, config);
    }

    // Run all probes
    console.log("🔬 Running probes...");
    const results = runAllProbes(configs, prompts);
    console.log(`   Completed ${results.length} probe(s)\n`);

    // Evaluate rules
    console.log("⚖️  Evaluating rules...");
    const rules = getEnhancedRules(configMap);
    const failureEvents = evaluateAllRules(results, rules);
    console.log(`   Detected ${failureEvents.length} failure event(s)\n`);

    // Build break-first timeline
    console.log("📊 Building break-first timeline...");
    const timeline = buildBreakFirstTimeline(failureEvents);
    console.log(`   Identified ${timeline.break_points.length} break point(s)\n`);

    // Write outputs
    console.log("💾 Writing outputs...");
    writeOutput("failure-events.json", failureEvents);
    writeOutput("break-first-timeline.json", timeline);

    // Summary
    console.log("\n✅ Pipeline completed successfully!\n");
    console.log("📈 Summary:");
    console.log(`   - Total probes: ${results.length}`);
    console.log(`   - Failure events: ${failureEvents.length}`);
    console.log(`   - Configs analyzed: ${configs.length}`);
    console.log(`   - Break points: ${timeline.break_points.length}`);

    // Show break points
    if (timeline.break_points.length > 0) {
      console.log("\n🔴 Break Points:");
      for (const bp of timeline.break_points) {
        console.log(
          `   - ${bp.config_id}: ${bp.failure_mode} (${bp.severity}) at prompt ${bp.prompt_id}`
        );
      }
    }

    console.log("\n📁 Output files:");
    console.log(`   - output/telemetry.log`);
    console.log(`   - output/failure-events.json`);
    console.log(`   - output/break-first-timeline.json`);

  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
