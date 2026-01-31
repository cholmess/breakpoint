/**
 * API Route: Estimate Telemetry for Prompts
 * POST /api/estimate-telemetry
 * 
 * Request body:
 * {
 *   prompts: PromptRecord[];
 *   config: ProbeConfig;
 *   mode?: "estimate" | "validate"; // default "estimate"
 *   validationSampleSize?: number; // if using sampling
 * }
 * 
 * Response:
 * {
 *   telemetry: TelemetryRecord[];
 *   metadata: {
 *     mode: string;
 *     prompt_count: number;
 *     estimated_at: string;
 *   };
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  estimateTelemetry,
  estimateTelemetryWithSampling,
} from "../../../src/lib/telemetry-estimator";
import type { ProbeConfig, PromptRecord, TelemetryRecord } from "../../../src/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompts, config, mode = "estimate", validationSampleSize } = body;

    // Validate input
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { error: "prompts is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error: "config is required and must be an object" },
        { status: 400 }
      );
    }

    // Validate config has required fields
    const requiredFields = [
      "id",
      "model",
      "context_window",
      "max_output_tokens",
      "temperature",
      "tools_enabled",
    ];
    for (const field of requiredFields) {
      if (!(field in config)) {
        return NextResponse.json(
          { error: `config.${field} is required` },
          { status: 400 }
        );
      }
    }

    // Estimate telemetry
    let telemetry: TelemetryRecord[];
    let metadata: Record<string, any> = {
      mode,
      prompt_count: prompts.length,
      estimated_at: new Date().toISOString(),
    };

    if (mode === "validate" && validationSampleSize) {
      // Use sampling mode
      const result = await estimateTelemetryWithSampling(
        prompts as PromptRecord[],
        config as ProbeConfig,
        validationSampleSize
      );
      telemetry = result.estimated;
      metadata.validation_sample_size = validationSampleSize;
      metadata.validated_indices = result.validationIndices;
      metadata.validated_telemetry = result.validated;
    } else {
      // Standard estimation or full validation
      telemetry = await estimateTelemetry(
        prompts as PromptRecord[],
        config as ProbeConfig,
        mode
      );
    }

    return NextResponse.json({
      telemetry,
      metadata,
    });
  } catch (error) {
    console.error("Error estimating telemetry:", error);
    return NextResponse.json(
      {
        error: "Failed to estimate telemetry",
        message:
          error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}
