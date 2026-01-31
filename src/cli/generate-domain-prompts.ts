#!/usr/bin/env node
/**
 * CLI Tool: Generate Domain-Specific Prompts
 * 
 * Usage:
 *   npm run generate-prompts -- --use-case "customer support chatbot" --count 100
 *   npm run generate-prompts -- --use-case "legal document analysis" --count 150 --output data/prompts/legal.json
 *   npm run generate-prompts -- --use-case "code review" --count 50 --telemetry estimate --complexity complex
 */

// Load environment variables from .env file
import { config } from "dotenv";
config();

import * as fs from "fs";
import * as path from "path";
import {
  generateDomainPromptsWithRetry,
  type GenerationOptions,
  type PromptDistribution,
} from "../lib/prompt-generator";
import {
  estimateTelemetry,
  estimateTelemetryWithSampling,
} from "../lib/telemetry-estimator";
import { loadConfigs } from "../lib/probe-runner";
import type { PromptRecord, ProbeConfig } from "../types";

interface CliOptions {
  useCase: string;
  count: number;
  output?: string;
  telemetry?: "estimate" | "validate" | "none";
  complexity?: "simple" | "moderate" | "complex";
  shortRatio?: number;
  toolRatio?: number;
  docRatio?: number;
  model?: string;
  config?: string; // Config file to use for telemetry estimation
  validationSampleSize?: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--use-case":
      case "-u":
        if (nextArg) {
          options.useCase = nextArg;
          i++;
        }
        break;
      case "--count":
      case "-c":
        if (nextArg) {
          options.count = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--output":
      case "-o":
        if (nextArg) {
          options.output = nextArg;
          i++;
        }
        break;
      case "--telemetry":
      case "-t":
        if (nextArg && ["estimate", "validate", "none"].includes(nextArg)) {
          options.telemetry = nextArg as "estimate" | "validate" | "none";
          i++;
        }
        break;
      case "--complexity":
        if (
          nextArg &&
          ["simple", "moderate", "complex"].includes(nextArg)
        ) {
          options.complexity = nextArg as "simple" | "moderate" | "complex";
          i++;
        }
        break;
      case "--short-ratio":
        if (nextArg) {
          options.shortRatio = parseFloat(nextArg);
          i++;
        }
        break;
      case "--tool-ratio":
        if (nextArg) {
          options.toolRatio = parseFloat(nextArg);
          i++;
        }
        break;
      case "--doc-ratio":
        if (nextArg) {
          options.docRatio = parseFloat(nextArg);
          i++;
        }
        break;
      case "--model":
        if (nextArg) {
          options.model = nextArg;
          i++;
        }
        break;
      case "--config":
        if (nextArg) {
          options.config = nextArg;
          i++;
        }
        break;
      case "--validation-sample-size":
        if (nextArg) {
          options.validationSampleSize = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return options as CliOptions;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Generate Domain-Specific Prompts

Usage:
  npm run generate-prompts -- [options]

Required:
  --use-case, -u <string>     Use case description (e.g., "customer support chatbot")
  --count, -c <number>        Number of prompts to generate (1-200)

Optional:
  --output, -o <path>          Output file path (default: data/prompts/<use-case>.json)
  --telemetry, -t <mode>      Telemetry mode: estimate, validate, or none (default: none)
  --complexity <level>        Complexity level: simple, moderate, complex (default: moderate)
  --short-ratio <0-1>         Ratio of short prompts (default: 0.4)
  --tool-ratio <0-1>          Ratio of tool-heavy prompts (default: 0.3)
  --doc-ratio <0-1>           Ratio of doc-grounded prompts (default: 0.4)
  --model <string>            OpenAI model to use (default: gpt-4o)
  --config <path>             Config file for telemetry estimation (required if --telemetry)
  --validation-sample-size    Number of prompts to validate with real API (default: 10)
  --help, -h                  Show this help message

Examples:
  npm run generate-prompts -- -u "customer support" -c 100
  npm run generate-prompts -- -u "legal analysis" -c 150 -o data/prompts/legal.json -t estimate
  npm run generate-prompts -- -u "code review" -c 50 --complexity complex --config configs/config-a.json
`);
}

/**
 * Load config from file
 */
function loadConfigFromFile(configPath: string): ProbeConfig {
  const fullPath = path.isAbsolute(configPath)
    ? configPath
    : path.join(process.cwd(), configPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Config file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const config = JSON.parse(content) as ProbeConfig;

  if (!config.id || !config.model) {
    throw new Error("Invalid config file: missing required fields");
  }

  return config;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const options = parseArgs();

  // Validate required options
  if (!options.useCase) {
    console.error("Error: --use-case is required");
    printHelp();
    process.exit(1);
  }

  if (!options.count || options.count < 1 || options.count > 200) {
    console.error("Error: --count must be between 1 and 200");
    printHelp();
    process.exit(1);
  }

  // Set defaults
  const telemetryMode = options.telemetry || "none";
  const complexity = options.complexity || "moderate";
  const outputPath =
    options.output ||
    path.join(
      process.cwd(),
      "data",
      "prompts",
      `${options.useCase.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`
    );

  try {
    console.log(`\n🚀 Generating ${options.count} prompts for: "${options.useCase}"`);
    console.log(`   Complexity: ${complexity}`);
    console.log(`   Telemetry: ${telemetryMode}`);

    // Build generation options
    const distribution: PromptDistribution = {};
    if (options.shortRatio !== undefined) distribution.short_ratio = options.shortRatio;
    if (options.toolRatio !== undefined) distribution.tool_heavy_ratio = options.toolRatio;
    if (options.docRatio !== undefined) distribution.doc_grounded_ratio = options.docRatio;

    const generationOptions: GenerationOptions = {
      distribution: Object.keys(distribution).length > 0 ? distribution : undefined,
      complexity,
      model: options.model,
    };

    // Generate prompts
    console.log("\n📝 Generating prompts...");
    const prompts = await generateDomainPromptsWithRetry(
      options.useCase,
      options.count,
      generationOptions
    );
    console.log(`✓ Generated ${prompts.length} prompts`);

    // Estimate telemetry if requested
    let telemetryData: any[] | undefined;
    if (telemetryMode !== "none") {
      if (!options.config) {
        console.error(
          "Error: --config is required when using --telemetry"
        );
        process.exit(1);
      }

      console.log("\n📊 Estimating telemetry...");
      const config = loadConfigFromFile(options.config);

      if (telemetryMode === "validate" && options.validationSampleSize) {
        const result = await estimateTelemetryWithSampling(
          prompts,
          config,
          options.validationSampleSize
        );
        telemetryData = result.estimated;
        console.log(
          `✓ Estimated telemetry for all prompts, validated ${result.validated.length} samples`
        );
      } else {
        telemetryData = await estimateTelemetry(prompts, config, telemetryMode);
        console.log(`✓ Estimated telemetry for ${telemetryData.length} prompts`);
      }
    }

    // Prepare output data
    const outputData: any = {
      suite_metadata: {
        use_case_description: options.useCase,
        generated_at: new Date().toISOString(),
        generation_method: "ai_openai",
        prompt_count: prompts.length,
        complexity,
        telemetry_method: telemetryMode === "none" ? "none" : telemetryMode,
      },
      prompts,
    };

    if (telemetryData) {
      outputData.telemetry = telemetryData;
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output file
    fs.writeFileSync(
      outputPath,
      JSON.stringify(outputData, null, 2),
      "utf-8"
    );
    console.log(`\n✓ Saved to: ${outputPath}`);

    // Print summary
    console.log("\n📊 Summary:");
    console.log(`   Total prompts: ${prompts.length}`);
    
    const familyCounts: Record<string, number> = {};
    prompts.forEach((p) => {
      familyCounts[p.family] = (familyCounts[p.family] || 0) + 1;
    });
    console.log("   Family distribution:");
    Object.entries(familyCounts).forEach(([family, count]) => {
      console.log(`     ${family}: ${count} (${((count / prompts.length) * 100).toFixed(1)}%)`);
    });

    if (telemetryData) {
      const avgTokens = telemetryData.reduce(
        (sum, t) => sum + t.prompt_tokens + t.completion_tokens,
        0
      ) / telemetryData.length;
      const avgLatency = telemetryData.reduce(
        (sum, t) => sum + t.latency_ms,
        0
      ) / telemetryData.length;
      console.log(`\n   Average tokens: ${Math.round(avgTokens)}`);
      console.log(`   Average latency: ${Math.round(avgLatency)}ms`);
    }

    console.log("\n✅ Done!\n");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if executed directly (ESM pattern)
// In ESM, we check if this file is the entry point
// When run via tsx, this will be true when executed directly
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
