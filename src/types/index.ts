/**
 * Shared type definitions for the Probabilistic Failure Simulator
 * Person A: Runner + Rules Engineer
 */

export interface ProbeConfig {
  id: string;
  model: string;
  context_window: number;
  top_k: number;
  chunk_size: number;
  max_output_tokens: number;
  tools_enabled: boolean;
  temperature: number; // 0 to 2
  cost_per_1k_tokens: number; // in dollars
}

export interface PromptRecord {
  id: string;
  family: string; // e.g., "short", "long_context", "tool_heavy", "doc_grounded"
  use_case: string; // e.g., "legal_qa", "code_generation", "data_analysis"
  prompt: string;
  expects_tools: boolean;
  expects_citations: boolean;
}

export interface TelemetryRecord {
  prompt_id: string;
  config_id: string;
  prompt_tokens: number;
  retrieved_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  tool_calls: number;
  tool_timeouts: number;
  timestamp: string; // ISO 8601
}

export type FailureMode =
  | "context_overflow"
  | "silent_truncation_risk"
  | "latency_breach"
  | "cost_runaway"
  | "tool_timeout_risk"
  | "retrieval_noise_risk";

export type Severity = "LOW" | "MED" | "HIGH";

export interface FailureEvent {
  prompt_id: string;
  config_id: string;
  failure_mode: FailureMode;
  severity: Severity;
  breaks_at: string; // Human-readable condition, e.g., "top_k>6 or context_usage>0.85"
  signal: Record<string, number>; // e.g., {"context_usage": 0.91}
  timestamp: string;
}

export interface Rule {
  id: string;
  name: string;
  condition: (result: ProbeResult) => boolean;
  severity: Severity | ((result: ProbeResult) => Severity);
  mode: FailureMode;
  breaksAt: (result: ProbeResult) => string;
  getSignal: (result: ProbeResult) => Record<string, number>;
}

export interface ProbeResult {
  prompt_id: string;
  config_id: string;
  telemetry: TelemetryRecord;
  // Computed metrics
  context_usage: number; // (prompt_tokens + retrieved_tokens) / context_window
  total_tokens: number; // prompt_tokens + retrieved_tokens + completion_tokens
  estimated_cost: number; // based on tokens and cost_per_1k_tokens
}

export interface BreakPoint {
  config_id: string;
  prompt_id: string;
  failure_mode: FailureMode;
  severity: Severity;
  timestamp: string;
  breaks_at: string;
}

export interface Timeline {
  configs: Record<string, BreakPoint[]>; // Grouped by config_id
  break_points: BreakPoint[]; // Ordered list of first HIGH severity failure per config
}

// Person B: Probability + Analytics
export interface Stats {
  config_id: string;
  k: number; // number of failures
  n: number; // total trials
  phat: number; // failure probability estimate (k/n)
  ci_bootstrap?: [number, number]; // [lower, upper] bootstrap CI
  ci_bayesian?: [number, number]; // [lower, upper] Bayesian CI
}

export interface AnalysisOutput {
  configs: Record<string, Stats>; // keyed by config_id
}

export interface ComparisonResult {
  config_a: string;
  config_b: string;
  p_a_safer: number; // P(A safer than B)
}

export interface ComparisonsOutput {
  comparisons: ComparisonResult[];
}

export interface DistributionEntry {
  failure_mode?: FailureMode; // optional for by_prompt_family entries
  family?: string;
  count: number;
  proportion: number;
}

export interface DistributionsOutput {
  by_failure_mode: Record<string, DistributionEntry>; // keyed by FailureMode
  by_prompt_family: Record<string, DistributionEntry>; // keyed by family
}
