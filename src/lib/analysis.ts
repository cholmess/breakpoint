/**
 * Person B: Analysis layer
 * modeDistributions, runAnalysis, runComparisons, runDistributions
 */

import type {
  FailureEvent,
  FailureMode,
  Stats,
  AnalysisOutput,
  ComparisonsOutput,
  DistributionsOutput,
  DistributionEntry,
  PromptRecord,
} from "../types";
import { estimatePhat } from "./probability";
import { bootstrapCI, bayesianBetaCI, wilsonScoreCI, compareConfigs } from "./statistics";

/**
 * Build prompt_id -> family map from prompts.
 */
function buildPromptFamilyMap(prompts: PromptRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of prompts) {
    map.set(p.id, p.family);
  }
  return map;
}

/**
 * Distributions by failure mode and by prompt family.
 * Edge case: empty events → returns empty by_failure_mode and by_prompt_family.
 */
export function modeDistributions(
  events: FailureEvent[],
  prompts: PromptRecord[]
): DistributionsOutput {
  if (!events || events.length === 0) {
    return { by_failure_mode: {}, by_prompt_family: {} };
  }
  const familyMap = buildPromptFamilyMap(prompts ?? []);
  const byMode: Record<string, { count: number }> = {};
  const byFamily: Record<string, { count: number }> = {};
  const total = events.length;

  for (const e of events) {
    byMode[e.failure_mode] = (byMode[e.failure_mode] ?? { count: 0 });
    byMode[e.failure_mode].count += 1;

    const family = familyMap.get(e.prompt_id) ?? "unknown";
    byFamily[family] = (byFamily[family] ?? { count: 0 });
    byFamily[family].count += 1;
  }

  const byFailureMode: Record<string, DistributionEntry> = {};
  for (const [mode, { count }] of Object.entries(byMode)) {
    byFailureMode[mode] = {
      failure_mode: mode as FailureMode,
      count,
      proportion: total === 0 ? 0 : count / total,
    };
  }

  const byPromptFamily: Record<string, DistributionEntry> = {};
  for (const [family, { count }] of Object.entries(byFamily)) {
    byPromptFamily[family] = {
      family,
      count,
      proportion: total === 0 ? 0 : count / total,
    };
  }

  return {
    by_failure_mode: byFailureMode,
    by_prompt_family: byPromptFamily,
  };
}

/**
 * Run full analysis: per-config stats with bootstrap and Bayesian CIs.
 *
 * When the caller knows the full set of configs that were run (e.g. run-simulation with
 * configA and configB), they MUST pass allConfigIds. Otherwise configs with zero failures
 * will be omitted (we only infer config IDs from events, so configs with no events
 * never appear). Passing allConfigIds ensures "0% error rate" is shown correctly for
 * configs that had no failures rather than omitting them.
 *
 * totalTrials is set from prompts.length; it must match the number of probes run per
 * config (e.g. the filtered prompt list used in the run). Edge case: empty events →
 * all configs get k=0; empty prompts → totalTrials=0, n per config = max(0,k).
 */
export function runAnalysis(
  events: FailureEvent[],
  prompts: PromptRecord[],
  allConfigIds?: string[]
): AnalysisOutput {
  // Prefer explicit config set so configs with 0 failures are included
  const configIds = allConfigIds && allConfigIds.length > 0
    ? new Set(allConfigIds)
    : new Set<string>(events?.map(e => e.config_id) || []);

  if (configIds.size === 0) {
    return { configs: {} };
  }

  const totalTrials = Array.isArray(prompts) ? prompts.length : 0;
  const configs: Record<string, Stats> = {};

  for (const configId of configIds) {
    const stats = estimatePhat(events || [], configId, totalTrials);
    stats.ci_bootstrap = bootstrapCI(stats.k, stats.n);
    stats.ci_bayesian = bayesianBetaCI(stats.k, stats.n);
    stats.ci_wilson = wilsonScoreCI(stats.k, stats.n); // deterministic; width varies with k,n
    configs[configId] = stats;
  }

  return { configs };
}

/**
 * Run pairwise comparisons: P(A safer than B) for each pair.
 * Edge case: empty or single config → returns { comparisons: [] }.
 */
export function runComparisons(statsList: Stats[]): ComparisonsOutput {
  const list = Array.isArray(statsList) ? statsList : [];
  const comparisons: { config_a: string; config_b: string; p_a_safer: number }[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const { pASafer } = compareConfigs(a, b);
      comparisons.push({
        config_a: a.config_id,
        config_b: b.config_id,
        p_a_safer: pASafer,
      });
    }
  }
  return { comparisons };
}

/**
 * Run distributions: by failure mode and by prompt family.
 */
export function runDistributions(
  events: FailureEvent[],
  prompts: PromptRecord[]
): DistributionsOutput {
  return modeDistributions(events, prompts);
}
