/**
 * API Route: Check which API keys are set (for Real API mode)
 * GET /api/check-api-keys
 *
 * Returns booleans indicating which provider keys exist in .env.
 * Does not expose key values. Used by the UI to warn before running Real API.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const openai = Boolean(
    process.env.OPENAI_API_KEY?.trim()
  );
  const gemini = Boolean(
    process.env.GEMINI_API_KEY_CH?.trim() || process.env.GEMINI_API_KEY?.trim()
  );
  const manus = Boolean(
    process.env.MANUS_API_KEY_CH?.trim() || process.env.MANUS_API_KEY?.trim()
  );

  return NextResponse.json({
    openai,
    gemini,
    manus,
    hint: "Copy .env.example to .env in the project root and add keys for the providers your configs use.",
  });
}
