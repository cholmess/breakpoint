// Type definitions matching JSON_SCHEMAS.md

// From analysis.json
export interface ConfigStats {
  config_id: string;
  k: number;
  n: number;
  phat: number;
  ci_bootstrap?: [number, number];
  ci_bayesian?: [number, number];
  ci_wilson?: [number, number]; // Wilson score 95% CI (deterministic, width varies with k,n)
  /** True when n < 100 and phat < 1%, or n < 30; show low-sample / uncertain estimate note in UI. */
  low_sample_warning?: boolean;
}

export interface AnalysisData {
  configs: {
    [configId: string]: ConfigStats;
  };
}

// From comparisons.json
export interface Comparison {
  config_a: string;
  config_b: string;
  p_a_safer: number;
}

export interface ComparisonsData {
  comparisons: Comparison[];
}

// From distributions.json
export interface DistributionEntry {
  failure_mode?: string;
  family?: string;
  count: number;
  proportion: number;
}

export interface HotspotEntry {
  failure_mode: string;
  family: string;
  count: number;
}

export interface DistributionsData {
  by_failure_mode: {
    [key: string]: DistributionEntry & { failure_mode: string };
  };
  by_prompt_family: {
    [key: string]: DistributionEntry & { family: string };
  };
  hotspot_matrix?: HotspotEntry[];
}

// Config file structure
export interface Config {
  id: string;
  model: string;
  context_window: number;
  top_k: number;
  chunk_size: number;
  max_output_tokens: number;
  tools_enabled: boolean;
  temperature: number;
  cost_per_1k_tokens: number;
}

// Failure mode enum
export type FailureMode = 
  | 'context_overflow'
  | 'silent_truncation_risk'
  | 'latency_breach'
  | 'cost_runaway'
  | 'tool_timeout_risk'
  | 'retrieval_noise_risk';

// Break-first timeline (from run-simulation API)
export interface BreakPoint {
  config_id: string;
  prompt_id: string;
  failure_mode: string;
  severity: string;
  timestamp: string;
  breaks_at?: string;
}

export interface Timeline {
  configs: Record<string, BreakPoint[]>;
  break_points: BreakPoint[];
}

/** Snapshot of a run saved as baseline (localStorage). */
export interface Baseline {
  analysis: AnalysisData;
  comparisons: ComparisonsData;
  distributions: DistributionsData;
  configA: Config;
  configB: Config;
  timeline?: Timeline | null;
  savedAt: string; // ISO date
}


