/**
 * API Route: Generate Domain-Specific Prompts
 * POST /api/generate-prompts
 * 
 * Request body:
 * {
 *   useCase: string;
 *   count: number; // 1-200
 *   options?: {
 *     distribution?: {
 *       short_ratio?: number;
 *       tool_heavy_ratio?: number;
 *       doc_grounded_ratio?: number;
 *     };
 *     complexity?: "simple" | "moderate" | "complex";
 *     model?: string;
 *   };
 * }
 * 
 * Response:
 * {
 *   prompts: PromptRecord[];
 *   metadata: {
 *     use_case: string;
 *     count: number;
 *     generated_at: string;
 *   };
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateDomainPromptsWithRetry,
  type GenerationOptions,
} from "../../../src/lib/prompt-generator";
import type { PromptRecord } from "../../../src/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { useCase, count, options } = body;

    // Validate input
    if (!useCase || typeof useCase !== "string" || useCase.trim().length === 0) {
      return NextResponse.json(
        { error: "useCase is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!count || typeof count !== "number" || count < 1 || count > 200) {
      return NextResponse.json(
        { error: "count must be a number between 1 and 200" },
        { status: 400 }
      );
    }

    // Generate prompts
    const generationOptions: GenerationOptions = options || {};
    const prompts = await generateDomainPromptsWithRetry(
      useCase.trim(),
      count,
      generationOptions
    );

    return NextResponse.json({
      prompts,
      metadata: {
        use_case: useCase.trim(),
        count: prompts.length,
        generated_at: new Date().toISOString(),
        generation_method: "ai_openai",
        model: generationOptions.model || "gpt-4o",
      },
    });
  } catch (error) {
    console.error("Error generating prompts:", error);
    return NextResponse.json(
      {
        error: "Failed to generate prompts",
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
