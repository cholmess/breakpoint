/**
 * GET /api/available-models
 *
 * Returns only models for providers that have API keys configured.
 * Aligns with inferProvider in llm-client: gpt-* and o1-* map to openai,
 * gemini-* to gemini, manus-* to manus. Claude is not supported.
 */

import { NextResponse } from "next/server";

const MODELS_BY_PROVIDER: Record<
  string,
  { value: string; label: string }[]
> = {
  openai: [
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    { value: "o1-mini", label: "O1 Mini" },
    { value: "o1", label: "O1" },
  ],
  gemini: [
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { value: "gemini-pro", label: "Gemini Pro" },
  ],
  manus: [
    { value: "manus-1.6", label: "Manus 1.6" },
    { value: "manus-1.6-lite", label: "Manus 1.6 Lite" },
    { value: "manus-1.6-max", label: "Manus 1.6 Max" },
  ],
};

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function hasGeminiKey(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY_CH || process.env.GEMINI_API_KEY
  );
}

function hasManusKey(): boolean {
  return Boolean(
    process.env.MANUS_API_KEY_CH || process.env.MANUS_API_KEY
  );
}

export async function GET() {
  const models: { value: string; label: string }[] = [];

  if (hasOpenAIKey()) {
    models.push(...MODELS_BY_PROVIDER.openai);
  }
  if (hasGeminiKey()) {
    models.push(...MODELS_BY_PROVIDER.gemini);
  }
  if (hasManusKey()) {
    models.push(...MODELS_BY_PROVIDER.manus);
  }

  // If no keys are set (e.g. simulate-only), return all so the UI still works
  if (models.length === 0) {
    models.push(
      ...MODELS_BY_PROVIDER.openai,
      ...MODELS_BY_PROVIDER.gemini,
      ...MODELS_BY_PROVIDER.manus
    );
  }

  return NextResponse.json({ models });
}
