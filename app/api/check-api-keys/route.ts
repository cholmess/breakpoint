/**
 * API Route: Check which API keys are set (for Real API mode)
 * GET /api/check-api-keys
 *
 * Returns booleans indicating which provider keys exist in env.
 * Does not expose key values. Used by the UI to warn before running Real API.
 */

import { NextResponse } from "next/server";

const isVercel =
  typeof process.env.VERCEL === "string" && process.env.VERCEL === "1";

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

  const hint = isVercel
    ? "Add the API keys in Vercel: Project → Settings → Environment Variables (OPENAI_API_KEY, GEMINI_API_KEY or GEMINI_API_KEY_CH, MANUS_API_KEY or MANUS_API_KEY_CH as needed). Then redeploy."
    : "Copy .env.example to .env in the project root and add keys for the providers your configs use. See SETUP.md.";

  return NextResponse.json({
    openai,
    gemini,
    manus,
    hint,
  });
}
