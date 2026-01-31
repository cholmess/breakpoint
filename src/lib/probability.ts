/**
 * Person B: Probability layer
 * estimatePhat - failure probability per config
 */

import type { FailureEvent, Stats } from "../types";

/**
 * Count unique prompt runs that produced at least one failure for the given config.
 * Each (prompt_id, config_id) pair is one trial; if any event exists for that pair, it's a failure.
 */
function countFailures(events: FailureEvent[], configId: string): number {
  const failedPrompts = new Set<string>();
  for (const e of events) {
    if (e.config_id === configId) {
      failedPrompts.add(e.prompt_id);
    }
  }
  return failedPrompts.size;
}

/**
 * Estimate failure probability p̂ for a config: k failures out of n trials.
 *
 * totalTrials must be the actual number of probes run for this config (e.g. prompts.length
 * when each prompt was run once per config). If it is wrong (e.g. filtered vs full list),
 * p̂ will be incorrect and configs may show misleading 0% when they had no failures.
 *
 * Edge cases: empty events → k=0; totalTrials=0 or negative → n=max(0,k), phat=0 when n=0.
 * k is clamped to n so that phat never exceeds 1 (guards against duplicate events or bad data).
 *
 * @param events - failure events from probe run
 * @param configId - config to compute for
 * @param totalTrials - total number of probe runs for this config (must match actual runs)
 */
export function estimatePhat(
  events: FailureEvent[],
  configId: string,
  totalTrials: number
): Stats {
  const rawK = countFailures(events, configId);
  const safeN = Math.max(0, typeof totalTrials === "number" ? totalTrials : 0);
  const n = Math.max(safeN, rawK); // n at least as large as k
  const k = Math.min(rawK, n); // clamp k <= n so phat is never > 1
  const phat = n === 0 ? 0 : k / n;
  return {
    config_id: configId,
    k,
    n,
    phat,
  };
}
