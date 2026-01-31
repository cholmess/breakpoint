/**
 * Person A: Unit tests for telemetry-logger
 * Tests logging, reading, and clearing telemetry
 * Run: npx tsx tests/telemetry-logger.test.ts
 */

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  logTelemetry,
  logTelemetryBatch,
  getTelemetryLog,
  clearTelemetry,
  getTelemetryCache,
} from "../src/lib/telemetry-logger";
import type { TelemetryRecord } from "../src/types";

const TEST_OUTPUT_DIR = path.join(process.cwd(), "output");
const TEST_LOG_PATH = path.join(TEST_OUTPUT_DIR, "telemetry.log");

// --- Mock Data Helpers ---

function createMockTelemetry(overrides: Partial<TelemetryRecord> = {}): TelemetryRecord {
  return {
    prompt_id: "p_001",
    config_id: "config-test",
    prompt_tokens: 100,
    retrieved_tokens: 0,
    completion_tokens: 50,
    latency_ms: 1000,
    tool_calls: 0,
    tool_timeouts: 0,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// --- Test: Clear and Setup ---

function testClearTelemetry(): void {
  clearTelemetry();
  
  // Verify log file is deleted
  assert.ok(!fs.existsSync(TEST_LOG_PATH), "Log file should be deleted");
  
  // Verify cache is empty
  const cache = getTelemetryCache();
  assert.strictEqual(cache.length, 0, "Cache should be empty after clear");
  
  console.log("✓ clearTelemetry removes log file and clears cache");
}

// --- Test: Log Single Record ---

function testLogTelemetry(): void {
  clearTelemetry();
  
  const record = createMockTelemetry({ prompt_id: "p_001", config_id: "config-a" });
  logTelemetry(record);
  
  // Verify file exists
  assert.ok(fs.existsSync(TEST_LOG_PATH), "Log file should be created");
  
  // Verify file content
  const content = fs.readFileSync(TEST_LOG_PATH, "utf-8");
  const lines = content.trim().split("\n");
  assert.strictEqual(lines.length, 1, "Should have 1 line");
  
  const parsed = JSON.parse(lines[0]);
  assert.strictEqual(parsed.prompt_id, "p_001", "Should match prompt_id");
  assert.strictEqual(parsed.config_id, "config-a", "Should match config_id");
  
  // Verify cache
  const cache = getTelemetryCache();
  assert.strictEqual(cache.length, 1, "Cache should have 1 record");
  assert.strictEqual(cache[0].prompt_id, "p_001", "Cache should match logged record");
  
  console.log("✓ logTelemetry writes single record correctly");
}

// --- Test: Log Multiple Records ---

function testLogMultipleRecords(): void {
  clearTelemetry();
  
  const record1 = createMockTelemetry({ prompt_id: "p_001", config_id: "config-a" });
  const record2 = createMockTelemetry({ prompt_id: "p_002", config_id: "config-b" });
  const record3 = createMockTelemetry({ prompt_id: "p_003", config_id: "config-c" });
  
  logTelemetry(record1);
  logTelemetry(record2);
  logTelemetry(record3);
  
  // Verify file content
  const content = fs.readFileSync(TEST_LOG_PATH, "utf-8");
  const lines = content.trim().split("\n");
  assert.strictEqual(lines.length, 3, "Should have 3 lines");
  
  // Verify each line is valid JSON
  const parsed = lines.map(line => JSON.parse(line));
  assert.strictEqual(parsed[0].prompt_id, "p_001");
  assert.strictEqual(parsed[1].prompt_id, "p_002");
  assert.strictEqual(parsed[2].prompt_id, "p_003");
  
  // Verify cache
  const cache = getTelemetryCache();
  assert.strictEqual(cache.length, 3, "Cache should have 3 records");
  
  console.log("✓ logTelemetry appends multiple records correctly");
}

// --- Test: Batch Logging ---

function testLogTelemetryBatch(): void {
  clearTelemetry();
  
  const records = [
    createMockTelemetry({ prompt_id: "p_001", config_id: "config-a" }),
    createMockTelemetry({ prompt_id: "p_002", config_id: "config-b" }),
    createMockTelemetry({ prompt_id: "p_003", config_id: "config-c" }),
  ];
  
  logTelemetryBatch(records);
  
  // Verify file content
  const content = fs.readFileSync(TEST_LOG_PATH, "utf-8");
  const lines = content.trim().split("\n");
  assert.strictEqual(lines.length, 3, "Should have 3 lines from batch");
  
  // Verify cache
  const cache = getTelemetryCache();
  assert.strictEqual(cache.length, 3, "Cache should have 3 records from batch");
  
  console.log("✓ logTelemetryBatch writes multiple records in one call");
}

// --- Test: Get Telemetry Log ---

function testGetTelemetryLog(): void {
  clearTelemetry();
  
  const records = [
    createMockTelemetry({ prompt_id: "p_001", latency_ms: 1000 }),
    createMockTelemetry({ prompt_id: "p_002", latency_ms: 2000 }),
    createMockTelemetry({ prompt_id: "p_003", latency_ms: 3000 }),
  ];
  
  logTelemetryBatch(records);
  
  // Read back from log
  const retrieved = getTelemetryLog();
  
  assert.strictEqual(retrieved.length, 3, "Should retrieve 3 records");
  assert.strictEqual(retrieved[0].prompt_id, "p_001");
  assert.strictEqual(retrieved[0].latency_ms, 1000);
  assert.strictEqual(retrieved[1].prompt_id, "p_002");
  assert.strictEqual(retrieved[2].prompt_id, "p_003");
  
  console.log("✓ getTelemetryLog reads records from file correctly");
}

// --- Test: Get Telemetry Log (Empty) ---

function testGetTelemetryLogEmpty(): void {
  clearTelemetry();
  
  const retrieved = getTelemetryLog();
  
  assert.strictEqual(retrieved.length, 0, "Should return empty array when no log exists");
  
  console.log("✓ getTelemetryLog handles missing file gracefully");
}

// --- Test: JSONL Format ---

function testJSONLFormat(): void {
  clearTelemetry();
  
  const records = [
    createMockTelemetry({ prompt_id: "p_001" }),
    createMockTelemetry({ prompt_id: "p_002" }),
  ];
  
  logTelemetryBatch(records);
  
  // Verify JSONL format (each line is valid JSON)
  const content = fs.readFileSync(TEST_LOG_PATH, "utf-8");
  const lines = content.trim().split("\n");
  
  for (const line of lines) {
    assert.ok(line.trim(), "Line should not be empty");
    assert.doesNotThrow(() => JSON.parse(line), "Each line should be valid JSON");
  }
  
  console.log("✓ Telemetry log uses correct JSONL format");
}

// --- Test: Mixed Logging (Single + Batch) ---

function testMixedLogging(): void {
  clearTelemetry();
  
  // Log single record
  logTelemetry(createMockTelemetry({ prompt_id: "p_001" }));
  
  // Log batch
  logTelemetryBatch([
    createMockTelemetry({ prompt_id: "p_002" }),
    createMockTelemetry({ prompt_id: "p_003" }),
  ]);
  
  // Log another single record
  logTelemetry(createMockTelemetry({ prompt_id: "p_004" }));
  
  // Verify all records
  const retrieved = getTelemetryLog();
  assert.strictEqual(retrieved.length, 4, "Should have 4 records total");
  assert.strictEqual(retrieved[0].prompt_id, "p_001");
  assert.strictEqual(retrieved[1].prompt_id, "p_002");
  assert.strictEqual(retrieved[2].prompt_id, "p_003");
  assert.strictEqual(retrieved[3].prompt_id, "p_004");
  
  // Verify cache
  const cache = getTelemetryCache();
  assert.strictEqual(cache.length, 4, "Cache should have all 4 records");
  
  console.log("✓ Mixed single and batch logging works correctly");
}

// --- Test: Cache Persistence Across Operations ---

function testCachePersistence(): void {
  clearTelemetry();
  
  logTelemetry(createMockTelemetry({ prompt_id: "p_001" }));
  
  let cache = getTelemetryCache();
  assert.strictEqual(cache.length, 1, "Cache should have 1 record");
  
  logTelemetry(createMockTelemetry({ prompt_id: "p_002" }));
  
  cache = getTelemetryCache();
  assert.strictEqual(cache.length, 2, "Cache should have 2 records after second log");
  
  // Cache should not be affected by reading from file
  getTelemetryLog();
  cache = getTelemetryCache();
  assert.strictEqual(cache.length, 2, "Cache should remain unchanged after reading log");
  
  console.log("✓ Cache persists correctly across operations");
}

// --- Test: Cache is Immutable (Returns Copy) ---

function testCacheImmutability(): void {
  clearTelemetry();
  
  logTelemetry(createMockTelemetry({ prompt_id: "p_001" }));
  
  const cache1 = getTelemetryCache();
  cache1.push(createMockTelemetry({ prompt_id: "p_999" })); // Modify copy
  
  const cache2 = getTelemetryCache();
  assert.strictEqual(cache2.length, 1, "Original cache should not be affected");
  assert.strictEqual(cache2[0].prompt_id, "p_001", "Original cache should have correct data");
  
  console.log("✓ getTelemetryCache returns immutable copy");
}

// --- Test: Large Batch Performance ---

function testLargeBatch(): void {
  clearTelemetry();
  
  const largeRecords = Array.from({ length: 100 }, (_, i) =>
    createMockTelemetry({ prompt_id: `p_${String(i).padStart(3, "0")}` })
  );
  
  logTelemetryBatch(largeRecords);
  
  const retrieved = getTelemetryLog();
  assert.strictEqual(retrieved.length, 100, "Should handle 100 records");
  assert.strictEqual(retrieved[0].prompt_id, "p_000");
  assert.strictEqual(retrieved[99].prompt_id, "p_099");
  
  console.log("✓ Batch logging handles large sets efficiently");
}

// --- Run All Tests ---

function runAllTests(): void {
  console.log("\n🧪 Running telemetry-logger tests...\n");
  
  try {
    testClearTelemetry();
    testLogTelemetry();
    testLogMultipleRecords();
    testLogTelemetryBatch();
    testGetTelemetryLog();
    testGetTelemetryLogEmpty();
    testJSONLFormat();
    testMixedLogging();
    testCachePersistence();
    testCacheImmutability();
    testLargeBatch();
    
    // Clean up after tests
    clearTelemetry();
    
    console.log("\n✅ All telemetry-logger tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    
    // Clean up on failure
    clearTelemetry();
    
    process.exit(1);
  }
}

runAllTests();
