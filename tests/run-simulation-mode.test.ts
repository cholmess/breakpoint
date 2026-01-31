/**
 * Verification test for C1: Run Simulation API mode parameter
 * Ensures setMode/getMode work and the route passes mode from the request body.
 * Run from project root: npx tsx tests/run-simulation-mode.test.ts
 *
 * Note: Step 2 runs the full pipeline once (simulate, no mode in body) so it may take 20–60s.
 */

import { setMode, getMode } from "../src/lib/probe-runner";
import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

const configA = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "configs/config-a.json"), "utf-8")
);
const configB = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "configs/config-b.json"), "utf-8")
);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  console.log("🧪 Run Simulation mode verification (C1)\n");

  // 1. Probe-runner setMode/getMode plumbing (fast)
  console.log("1. Testing setMode/getMode in probe-runner...");
  setMode("simulate");
  assert(getMode() === "simulate", "Expected getMode() === 'simulate' after setMode('simulate')");
  setMode("real");
  assert(getMode() === "real", "Expected getMode() === 'real' after setMode('real')");
  setMode("simulate");
  console.log("   ✓ setMode/getMode work correctly\n");

  // 2. Route passes mode from request body (runs full pipeline once)
  console.log("2. Testing route uses mode from body (running one simulate pipeline, may take 20–60s)...");
  const { POST } = await import("../app/api/run-simulation/route");

  const reqWithMode = new NextRequest("http://localhost:3000/api/run-simulation", {
    method: "POST",
    body: JSON.stringify({ configA, configB, mode: "real" }),
    headers: { "Content-Type": "application/json" },
  });
  await POST(reqWithMode);
  assert(getMode() === "real", "After POST with mode: 'real', getMode() should be 'real'");
  console.log("   ✓ Route sets mode to 'real' when mode: 'real' in body\n");

  const reqDefault = new NextRequest("http://localhost:3000/api/run-simulation", {
    method: "POST",
    body: JSON.stringify({ configA, configB }),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(reqDefault);
  assert(getMode() === "simulate", "When mode omitted, default should be 'simulate'");
  assert(res.status === 200, "POST with default mode should return 200");
  console.log("   ✓ Route defaults to 'simulate' when mode omitted and returns 200\n");

  console.log("✅ All mode verification checks passed.\n");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
