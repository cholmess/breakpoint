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
import { bootstrapCI, bayesianBetaCI, compareConfigs } from "./statistics";

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
 */
export function modeDistributions(
  events: FailureEvent[],
  prompts: PromptRecord[]
): DistributionsOutput {
  const familyMap = buildPromptFamilyMap(prompts);
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
 */
export function runAnalysis(
  events: FailureEvent[],
  prompts: PromptRecord[]
): AnalysisOutput {
  const configIds = new Set<string>();
  for (const e of events) {
    configIds.add(e.config_id);
  }
  const totalTrials = prompts.length;
  const configs: Record<string, Stats> = {};

  for (const configId of configIds) {
    const stats = estimatePhat(events, configId, totalTrials);
    stats.ci_bootstrap = bootstrapCI(stats.k, stats.n);
    stats.ci_bayesian = bayesianBetaCI(stats.k, stats.n);
    configs[configId] = stats;
  }

  return { configs };
}

/**
 * Run pairwise comparisons: P(A safer than B) for each pair.
 */
export function runComparisons(statsList: Stats[]): ComparisonsOutput {
  const comparisons: { config_a: string; config_b: string; p_a_safer: number }[] = [];
  for (let i = 0; i < statsList.length; i++) {
    for (let j = i + 1; j < statsList.length; j++) {
      const a = statsList[i];
      const b = statsList[j];
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
