/**
 * Telemetry Logger
 * Logs probe telemetry to output/telemetry.log as JSONL
 */

import * as fs from "fs";
import * as path from "path";
import type { TelemetryRecord } from "../types";

const TELEMETRY_LOG_PATH = path.join(process.cwd(), "output", "telemetry.log");
const OUTPUT_DIR = path.join(process.cwd(), "output");

// In-memory cache for batch writes
let telemetryCache: TelemetryRecord[] = [];

/**
 * Ensure output directory exists
 */
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Log a telemetry record to the log file
 * Appends as JSONL (one JSON object per line)
 */
export function logTelemetry(record: TelemetryRecord): void {
  ensureOutputDir();
  
  // Add to cache
  telemetryCache.push(record);
  
  // Append to file as JSONL
  const line = JSON.stringify(record) + "\n";
  fs.appendFileSync(TELEMETRY_LOG_PATH, line, "utf-8");
}

/**
 * Log multiple telemetry records in batch
 */
export function logTelemetryBatch(records: TelemetryRecord[]): void {
  ensureOutputDir();
  
  telemetryCache.push(...records);
  
  const lines = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.appendFileSync(TELEMETRY_LOG_PATH, lines, "utf-8");
}

/**
 * Get all telemetry records from the log file
 */
export function getTelemetryLog(): TelemetryRecord[] {
  if (!fs.existsSync(TELEMETRY_LOG_PATH)) {
    return [];
  }
  
  const content = fs.readFileSync(TELEMETRY_LOG_PATH, "utf-8");
  const lines = content.trim().split("\n").filter((line) => line.trim());
  
  return lines.map((line) => JSON.parse(line) as TelemetryRecord);
}

/**
 * Clear the telemetry log file and cache
 */
export function clearTelemetry(): void {
  telemetryCache = [];
  if (fs.existsSync(TELEMETRY_LOG_PATH)) {
    fs.unlinkSync(TELEMETRY_LOG_PATH);
  }
}

/**
 * Get the in-memory cache (useful for recent records)
 */
export function getTelemetryCache(): TelemetryRecord[] {
  return [...telemetryCache];
}
