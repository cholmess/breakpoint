/**
 * Telemetry Logger
 * Logs probe telemetry to output/telemetry.log as JSONL (when filesystem is writable).
 * On Vercel/serverless, only in-memory cache is used to avoid ENOENT on output/.
 */

import * as fs from "fs";
import * as path from "path";
import type { TelemetryRecord } from "../types";

const TELEMETRY_LOG_PATH = path.join(process.cwd(), "output", "telemetry.log");
const OUTPUT_DIR = path.join(process.cwd(), "output");

/** True when running on Vercel or in a read-only env (no output/ directory). */
const isServerless =
  typeof process.env.VERCEL === "string" && process.env.VERCEL === "1";

// In-memory cache for batch writes (always used; file is optional)
let telemetryCache: TelemetryRecord[] = [];

/**
 * Ensure output directory exists (no-op on serverless)
 */
function ensureOutputDir(): void {
  if (isServerless) return;
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Log a telemetry record to the log file (and always to in-memory cache)
 * On serverless, only the cache is updated.
 */
export function logTelemetry(record: TelemetryRecord): void {
  telemetryCache.push(record);
  if (isServerless) return;
  try {
    ensureOutputDir();
    const line = JSON.stringify(record) + "\n";
    fs.appendFileSync(TELEMETRY_LOG_PATH, line, "utf-8");
  } catch {
    // Ignore write errors (e.g. read-only filesystem)
  }
}

/**
 * Log multiple telemetry records in batch
 */
export function logTelemetryBatch(records: TelemetryRecord[]): void {
  telemetryCache.push(...records);
  if (isServerless) return;
  try {
    ensureOutputDir();
    const lines = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
    fs.appendFileSync(TELEMETRY_LOG_PATH, lines, "utf-8");
  } catch {
    // Ignore write errors
  }
}

/**
 * Get all telemetry records (from file when available, else from cache)
 */
export function getTelemetryLog(): TelemetryRecord[] {
  if (telemetryCache.length > 0) return [...telemetryCache];
  if (isServerless) return [];
  if (!fs.existsSync(TELEMETRY_LOG_PATH)) return [];
  try {
    const content = fs.readFileSync(TELEMETRY_LOG_PATH, "utf-8");
    const lines = content.trim().split("\n").filter((line) => line.trim());
    return lines.map((line) => JSON.parse(line) as TelemetryRecord);
  } catch {
    return [];
  }
}

/**
 * Clear the telemetry log file and cache
 */
export function clearTelemetry(): void {
  telemetryCache = [];
  if (isServerless) return;
  try {
    if (fs.existsSync(TELEMETRY_LOG_PATH)) {
      fs.unlinkSync(TELEMETRY_LOG_PATH);
    }
  } catch {
    // Ignore
  }
}

/**
 * Get the in-memory cache (useful for recent records)
 */
export function getTelemetryCache(): TelemetryRecord[] {
  return [...telemetryCache];
}
