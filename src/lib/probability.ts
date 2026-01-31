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
 * Edge cases: empty events → k=0; totalTrials=0 or negative → n=max(0,k), phat=0 when n=0.
 * @param events - failure events from probe run
 * @param configId - config to compute for
 * @param totalTrials - total number of probe runs for this config (e.g. prompts.length)
 */
export function estimatePhat(
  events: FailureEvent[],
  configId: string,
  totalTrials: number
): Stats {
  const k = countFailures(events, configId);
  const safeN = Math.max(0, typeof totalTrials === "number" ? totalTrials : 0);
  const n = Math.max(safeN, k); // n at least as large as k
  const phat = n === 0 ? 0 : k / n;
  return {
    config_id: configId,
    k,
    n,
    phat,
  };
}
