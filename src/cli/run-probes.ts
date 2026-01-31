#!/usr/bin/env node
/**
 * CLI Entry Point for Probe Runner
 * Orchestrates the full pipeline: load configs/prompts, run probes, evaluate rules, build timeline
 */

// Load environment variables from .env file
import { config } from "dotenv";
config();

import * as fs from "fs";
import * as path from "path";
import {
  loadConfigs,
  loadPrompts,
  runAllProbes,
  setSeed,
  setMode,
  type ExecutionMode,
} from "../lib/probe-runner";
import {
  getEnhancedRules,
  evaluateAllRules,
} from "../lib/rules-engine";
import { buildBreakFirstTimeline } from "../lib/timeline";
import { clearTelemetry } from "../lib/telemetry-logger";
import type { ProbeConfig, FailureEvent } from "../types";
import { inferProvider } from "../lib/llm-client";

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
 * Parse command line arguments
 */
function parseArgs(): { mode: ExecutionMode; seed: number; promptsPath?: string } {
  const args = process.argv.slice(2);
  let mode: ExecutionMode = "simulate";
  let seed = 42;
  let promptsPath: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode" && i + 1 < args.length) {
      const modeArg = args[i + 1];
      if (modeArg !== "simulate" && modeArg !== "real") {
        console.error(`Invalid mode: ${modeArg}. Must be "simulate" or "real"`);
        process.exit(1);
      }
      mode = modeArg;
    } else if (args[i] === "--seed" && i + 1 < args.length) {
      seed = parseInt(args[i + 1], 10);
      if (isNaN(seed)) {
        console.error(`Invalid seed: ${args[i + 1]}. Must be a number`);
        process.exit(1);
      }
    } else if ((args[i] === "--prompts" || args[i] === "-p") && i + 1 < args.length) {
      promptsPath = args[i + 1];
    }
  }
  
  // Check environment variables as fallback
  if (process.env.MODE) {
    const envMode = process.env.MODE;
    if (envMode === "simulate" || envMode === "real") {
      mode = envMode;
    }
  }
  
  if (process.env.SEED) {
    const envSeed = parseInt(process.env.SEED, 10);
    if (!isNaN(envSeed)) {
      seed = envSeed;
    }
  }
  
  return { mode, seed, promptsPath };
}

/**
 * Main execution function
 */
async function main() {
  console.log("🚀 Starting Probabilistic Failure Simulator - Person A Pipeline\n");

  try {
    // Parse arguments
    const { mode, seed, promptsPath } = parseArgs();
    
    // Set execution mode
    setMode(mode);
    console.log(`🎯 Mode: ${mode.toUpperCase()}`);
    
    if (mode === "real") {
      console.log("   ⚠️  Real API calls will be made to LLM providers");
      // Validate API keys for required providers (check after configs load)
    } else {
      console.log("   Using simulated telemetry (no API calls)");
    }
    
    // Set deterministic seed for reproducibility (simulation mode only)
    setSeed(seed);
    console.log(`📌 Seed: ${seed}\n`);

    // Clear previous telemetry
    clearTelemetry();
    console.log("🧹 Cleared previous telemetry\n");

    // Load configs and prompts
    console.log("📂 Loading configurations and prompts...");
    const configs = loadConfigs("configs");
    const promptsFile = promptsPath || "data/prompts/suite.json";
    const prompts = loadPrompts(promptsFile);
    console.log(`   Loaded ${configs.length} config(s): ${configs.map((c) => c.id).join(", ")}`);
    console.log(`   Loaded ${prompts.length} prompt(s) from ${promptsFile}\n`);

    // Validate API keys for real mode
    if (mode === "real") {
      const providers = new Set(configs.map((c) => inferProvider(c)));
      const missing: string[] = [];
      if (providers.has("openai") && !process.env.OPENAI_API_KEY) {
        missing.push("OPENAI_API_KEY (for OpenAI models)");
      }
      if (providers.has("gemini") && !process.env.GEMINI_API_KEY_CH && !process.env.GEMINI_API_KEY) {
        missing.push("GEMINI_API_KEY_CH or GEMINI_API_KEY (for Gemini models)");
      }
      if (providers.has("manus") && !process.env.MANUS_API_KEY_CH && !process.env.MANUS_API_KEY) {
        missing.push("MANUS_API_KEY_CH or MANUS_API_KEY (for Manus models)");
      }
      if (missing.length > 0) {
        console.error("\n❌ Error: Missing API keys for real mode");
        console.error(`   Required: ${missing.join(", ")}`);
        console.error("   Add keys to .env file (see .env.example)");
        process.exit(1);
      }
    }

    // Create config map for enhanced rules
    const configMap = new Map<string, ProbeConfig>();
    for (const config of configs) {
      configMap.set(config.id, config);
    }

    // Run all probes (async now)
    console.log("🔬 Running probes...");
    const results = await runAllProbes(configs, prompts);
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
    
    console.log("\n💡 Usage:");
    console.log(`   Simulate: npm run probes -- --mode simulate`);
    console.log(`   Real API: npm run probes -- --mode real`);

  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly (ESM pattern)
// In ESM, we check if this file is the entry point
// When run via tsx, this will be true when executed directly
main();
