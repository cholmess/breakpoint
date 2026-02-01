/**
 * Central text dictionary for technical vs plain-language mode.
 * Keys are used by useText() hook; plain mode focuses on outcomes and risk for non-technical users.
 */

export type TextKey = keyof typeof TEXT_DICTIONARY;

export const TEXT_DICTIONARY = {
  // —— App & header ——
  app_subtitle: {
    technical: "AI Observability Tool",
    plain: "Compare AI setups in simple terms",
  },
  plain_language_toggle: {
    technical: "Plain language",
    plain: "Plain language",
  },
  take_a_tour: {
    technical: "Take a tour",
    plain: "Take a tour",
  },
  help: {
    technical: "Help! 🦥",
    plain: "Help! 🦥",
  },

  // —— Config form labels ——
  label_model: {
    technical: "Model",
    plain: "AI Model",
  },
  label_temperature: {
    technical: "Temperature",
    plain: "Creativity Level",
  },
  label_top_k: {
    technical: "Top-K",
    plain: "Search Results Limit",
  },
  label_context_window: {
    technical: "Context Window",
    plain: "Memory Limit",
  },
  label_chunk_size: {
    technical: "Chunk Size",
    plain: "Text Segment Size",
  },
  label_max_output: {
    technical: "Max Output",
    plain: "Response Length Limit",
  },
  label_tools: {
    technical: "Tools",
    plain: "Extra Features",
  },
  label_cost_per_1k: {
    technical: "Cost/1K",
    plain: "Price per 1,000 words",
  },
  tools_enabled: {
    technical: "Enabled",
    plain: "On",
  },
  tools_disabled: {
    technical: "Disabled",
    plain: "Off",
  },

  // —— Run mode ——
  run_mode: {
    technical: "Run Mode",
    plain: "How to run",
  },
  simulate: {
    technical: "Simulate",
    plain: "Simulate",
  },
  real_api: {
    technical: "Real API",
    plain: "Real API",
  },
  quick_prompts: {
    technical: "Quick (20 prompts)",
    plain: "Quick (20 tests)",
  },
  full_prompts: {
    technical: "Full (200 prompts)",
    plain: "Full (200 tests)",
  },
  run_simulation: {
    technical: "Run Simulation",
    plain: "Run comparison",
  },
  stop_simulation: {
    technical: "Stop Simulation",
    plain: "Stop",
  },

  // —— Results summary ——
  results_summary_title: {
    technical: "Results Summary",
    plain: "Results Summary",
  },
  why_this_matters: {
    technical: "Why This Matters",
    plain: "Why This Matters",
  },
  config_a_failure_rate: {
    technical: "Config A Failure Rate",
    plain: "Option A: How often it failed",
  },
  config_b_failure_rate: {
    technical: "Config B Failure Rate",
    plain: "Option B: How often it failed",
  },
  failures_out_of_tests: {
    technical: "failures out of",
    plain: "problems in",
  },
  tests: {
    technical: "tests",
    plain: "tests",
  },

  // —— Probability card ——
  which_config_safer: {
    technical: "Which Configuration is Safer?",
    plain: "Which Option is More Reliable?",
  },
  is_safer_choice: {
    technical: "is the safer choice",
    plain: "is the more reliable choice",
  },
  both_similar_reliability: {
    technical: "Both configurations show similar reliability. Consider other factors like cost or speed.",
    plain: "Both options perform about the same. Consider cost or speed when choosing.",
  },
  confidence_bayesian: {
    technical: "Confidence that {name} has a lower failure rate than the other (Bayesian comparison).",
    plain: "How sure we are that {name} fails less often than the other, based on our tests.",
  },
  all_comparisons: {
    technical: "All Comparisons",
    plain: "All comparisons",
  },

  // —— Confidence band chart ——
  failure_rate_comparison: {
    technical: "Failure Rate Comparison",
    plain: "How Often Each Option Failed",
  },
  failure_rate_chart_desc: {
    technical: "Shows how often each configuration fails, with uncertainty ranges. Lower is better.",
    plain: "Shows how often each option had problems. Lower is better. The band shows how certain we are.",
  },
  failure_rate_with_ci: {
    technical: "Failure Rate with Confidence Intervals",
    plain: "Problem Rate with Uncertainty Range",
  },
  failure_rate_pct: {
    technical: "Failure Rate (%)",
    plain: "Problems Found (%)",
  },
  failure_rate_phat: {
    technical: "Failure Rate (p̂)",
    plain: "Observed rate",
  },
  ci_95: {
    technical: "95% CI",
    plain: "Uncertainty range",
  },
  no_analysis_data: {
    technical: "No analysis data available",
    plain: "No data yet. Run a comparison first.",
  },
  tooltip_failure_rate: {
    technical: "Failure Rate:",
    plain: "Problem rate:",
  },
  tooltip_ci: {
    technical: "CI:",
    plain: "Uncertainty:",
  },
  tooltip_events: {
    technical: "Events:",
    plain: "Problems / tests:",
  },

  // —— Failure breakdown ——
  failure_mode_breakdown: {
    technical: "Failure Mode Breakdown",
    plain: "What Went Wrong",
  },
  what_went_wrong: {
    technical: "What Went Wrong?",
    plain: "What Went Wrong?",
  },
  failure_breakdown_desc: {
    technical: "Breakdown of specific issues detected during testing, sorted by severity.",
    plain: "Types of problems we found, from most to least serious.",
  },
  no_failure_events: {
    technical: "No failure events detected",
    plain: "No problems detected",
  },
  high: {
    technical: "high",
    plain: "serious",
  },
  medium: {
    technical: "medium",
    plain: "moderate",
  },

  // —— Break-first timeline ——
  break_first_timeline: {
    technical: "Break-first timeline",
    plain: "When each option first had a serious problem",
  },
  no_break_points: {
    technical: "No break points in this run. Run a simulation to see when each config first hit a high-severity failure.",
    plain: "No serious problems in this run. Run a comparison to see when each option first ran into trouble.",
  },
  break_point_explainer: {
    technical: 'A "break point" is the first HIGH severity failure per config. It indicates when that configuration would first fail in a production-like scenario.',
    plain: 'A "break point" is the first serious problem we saw for each option. It shows when that option would first run into trouble.',
  },
  what_this_shows: {
    technical: "What this shows",
    plain: "What this shows",
  },
  when_first_high: {
    technical: "When each config first hit a HIGH severity failure, in chronological order. The first row is the config that \"broke\" first in the run.",
    plain: "When each option first had a serious problem, in order. The first row is the one that ran into trouble first.",
  },
  first_high_severity_at: {
    technical: "First high-severity failure at prompt",
    plain: "First serious problem at test",
  },
  breaks_at: {
    technical: "Breaks at:",
    plain: "Happened at:",
  },
  total_failure_events: {
    technical: "Total failure events in this run",
    plain: "Total problems in this run",
  },
  break_point: {
    technical: "Break point",
    plain: "First serious problem",
  },
  of_to_break: {
    technical: "of {total} to break",
    plain: "of {total} to have a serious problem",
  },

  // —— Distribution charts ——
  failure_mode_distribution: {
    technical: "Failure Mode Distribution",
    plain: "Types of Problems",
  },
  failure_mode_dist_desc: {
    technical: "Which types of problems occurred most often during testing.",
    plain: "Which kinds of problems showed up most often.",
  },
  prompt_family_distribution: {
    technical: "Prompt Family Distribution",
    plain: "Which Kinds of Prompts Had Problems",
  },
  prompt_family_dist_desc: {
    technical: "Which types of prompts triggered the most failures.",
    plain: "Which types of prompts caused the most problems.",
  },
  no_failure_data: {
    technical: "No failure data available",
    plain: "No problem data yet",
  },
  no_prompt_family_data: {
    technical: "No prompt family data available",
    plain: "No prompt type data yet",
  },
  count: {
    technical: "Count",
    plain: "Count",
  },
  proportion: {
    technical: "Proportion",
    plain: "Share",
  },

  // —— Failure hotspot matrix ——
  failure_hotspot_matrix: {
    technical: "Failure Hotspot Matrix",
    plain: "Where Problems Show Up Most",
  },
  hotspot_matrix_desc: {
    technical: "Cross-tabulation of failure modes × prompt families",
    plain: "Which problem types appear with which prompt types",
  },
  no_failures_detected: {
    technical: "No failures detected",
    plain: "No problems detected",
  },

  // —— Recommendation banner ——
  run_to_see_recommendation: {
    technical: "Run a simulation to see which configuration we recommend and why.",
    plain: "Run a comparison to see which option we recommend and why.",
  },
  both_equally_likely: {
    technical: "Both configurations are equally likely to be safer. Consider other factors like cost or latency.",
    plain: "Both options are about equally reliable. Consider cost or speed when choosing.",
  },
  we_recommend_for_production: {
    technical: "We recommend",
    plain: "We recommend",
  },
  for_production: {
    technical: "for production.",
    plain: "for real use.",
  },
  why_we_recommend: {
    technical: "Why we recommend",
    plain: "Why we recommend",
  },
  what_this_means: {
    technical: "What this means",
    plain: "What to do",
  },
  confidence_high: {
    technical: "high",
    plain: "high",
  },
  confidence_moderate: {
    technical: "moderate",
    plain: "moderate",
  },
  confidence_low: {
    technical: "low",
    plain: "low",
  },
  cheaper_per_1k: {
    technical: "is also cheaper per 1k tokens, so it's a better choice on both reliability and cost.",
    plain: "also costs less per 1,000 words, so it's better on both reliability and cost.",
  },
  same_cost_1k: {
    technical: "Both configs have the same cost per 1k tokens, so the recommendation is based purely on reliability.",
    plain: "Both options cost the same per 1,000 words, so we're recommending based only on reliability.",
  },
  use_for_production_if_satisfied: {
    technical: "Use {name} for production if you're satisfied with this sample. For higher confidence, run a full simulation (200 prompts) before committing.",
    plain: "Use {name} if you're happy with this sample. For more confidence, run a full comparison (200 tests) before deciding.",
  },
  use_in_production_reliability: {
    technical: "Use {name} in production for better reliability. The {rateDiff}% lower failure rate and {confidence}% confidence support this choice.",
    plain: "Use {name} for better reliability. It failed {rateDiff}% less often in our tests, and we're {confidence}% confident it's the better choice.",
  },

  // —— Baseline comparison ——
  compare_to_baseline: {
    technical: "Compare to baseline",
    plain: "Compare to saved snapshot",
  },
  safer: {
    technical: "safer",
    plain: "more reliable",
  },
  clear_baseline: {
    technical: "Clear baseline",
    plain: "Clear saved snapshot",
  },
  failure_rate_improved: {
    technical: "Failure rate improved by {pct}% vs baseline.",
    plain: "Fewer problems than the saved snapshot ({pct}% improvement).",
  },
  failure_rate_increased: {
    technical: "Failure rate increased by {pct}% vs baseline.",
    plain: "More problems than the saved snapshot ({pct}% worse).",
  },
  saved: {
    technical: "saved",
    plain: "saved",
  },

  // —— Page states ——
  loading_analysis: {
    technical: "Loading analysis data...",
    plain: "Loading results...",
  },
  finalizing_results: {
    technical: "Finalizing results...",
    plain: "Finishing up...",
  },
  running_simulation: {
    technical: "Running simulation...",
    plain: "Running comparison...",
  },
  processing: {
    technical: "(processing...)",
    plain: "(finishing...)",
  },
  no_comparisons_yet: {
    technical: "No comparisons yet. Run a simulation to see results.",
    plain: "No results yet. Run a comparison to see which option is better.",
  },
  configure_then_run: {
    technical: "Configure Config A and Config B, then click \"Run Simulation\".",
    plain: "Set up Option A and Option B, then click \"Run comparison\".",
  },
  configs_changed: {
    technical: "Configs have changed since the last run.",
    plain: "Options have changed since the last run.",
  },
  run_for_current_config: {
    technical: "Run a simulation to see results for your current configuration.",
    plain: "Run a comparison to see results for your current setup.",
  },
  please_check_config: {
    technical: "Please check your configuration and try again.",
    plain: "Please check your settings and try again.",
  },
  save_as_baseline: {
    technical: "Save as baseline",
    plain: "Save as snapshot",
  },
  export_report: {
    technical: "Export report",
    plain: "Export report",
  },
  cost_tolerance: {
    technical: "Cost tolerance:",
    plain: "Cost tolerance:",
  },
  latency_tolerance: {
    technical: "Latency tolerance:",
    plain: "Response time tolerance:",
  },
  fewer_cost_runaway: {
    technical: "Fewer cost_runaway at higher ×.",
    plain: "Stricter cost limit at higher ×.",
  },
  fewer_latency_breach: {
    technical: "Fewer latency_breach at higher ×.",
    plain: "Stricter response time limit at higher ×.",
  },
  config_a: {
    technical: "Config A",
    plain: "Option A",
  },
  config_b: {
    technical: "Config B",
    plain: "Option B",
  },
  config_label: {
    technical: "Config",
    plain: "Option",
  },

  // —— Results summary (dynamic) ——
  run_simulation_to_see: {
    technical: "Run a simulation to see which configuration performs better.",
    plain: "Run a comparison to see which option performs better.",
  },
  both_similar_failure_rates: {
    technical: "Both configurations show similar failure rates. Consider other factors like cost or latency.",
    plain: "Both options perform about the same. Consider cost or speed when choosing.",
  },
  summary_significantly_more_reliable: {
    technical: "{saferName} is significantly more reliable, with {saferRate}% failure rate compared to {otherName}'s {otherRate}%.",
    plain: "{saferName} is clearly more reliable: it failed {saferRate}% of the time vs {otherName}'s {otherRate}%.",
  },
  summary_appears_more_reliable: {
    technical: "{saferName} appears more reliable ({saferRate}% vs {otherRate}% failure rate), though the difference is moderate.",
    plain: "{saferName} looks more reliable ({saferRate}% vs {otherRate}% failure rate), but the difference is modest.",
  },
  summary_quite_similar: {
    technical: "The configurations are quite similar. {saferName} has a slightly lower failure rate ({saferRate}% vs {otherRate}%).",
    plain: "The options are close. {saferName} failed a bit less often ({saferRate}% vs {otherRate}%).",
  },
  no_analysis_data_yet: {
    technical: "No analysis data available yet.",
    plain: "No results yet. Run a comparison first.",
  },
  reason_rate_difference: {
    technical: "There's a {rateDiff}% difference in failure rates between the two configurations.",
    plain: "One option failed {rateDiff}% more often than the other.",
  },
  reason_low_sample: {
    technical: "With fewer than 100 tests, low failure rates may not be statistically significant. Consider running more prompts for higher confidence.",
    plain: "We ran fewer than 100 tests, so the numbers may not be fully reliable. Run a full comparison (200 tests) for more confidence.",
  },
  reason_most_common_issue: {
    technical: "The most common issue detected is {modeName}, affecting {count} out of {total} failure events.",
    plain: "The most common problem was {modeName}, in {count} of {total} problem events.",
  },
  reason_overall_rate: {
    technical: "Overall, {rate}% of test runs encountered at least one failure.",
    plain: "Overall, {rate}% of test runs had at least one problem.",
  },
  reason_no_failures: {
    technical: "No failures were detected in this simulation - both configurations performed well!",
    plain: "No problems were found - both options did well!",
  },
  reason_key_differences: {
    technical: "Key differences between configurations: {diffs}. These settings can impact reliability.",
    plain: "Main differences: {diffs}. These can affect how reliable each option is.",
  },
  reason_analysis_complete: {
    technical: "Analysis complete. Review the detailed charts below for more insights.",
    plain: "Review the charts below for more detail.",
  },

  // —— PDF report only ——
  report_subtitle: {
    technical: "AI Observability · Configuration Comparison Report",
    plain: "Simple comparison report — which option is more reliable",
  },
  recommendation: {
    technical: "Recommendation",
    plain: "Recommendation",
  },
  we_recommend_for_production_pdf: {
    technical: "We recommend {name} for production.",
    plain: "We recommend {name} for real use.",
  },
  no_clear_recommendation: {
    technical: "No clear recommendation from this run.",
    plain: "No clear recommendation from this run.",
  },
  why_recommend_this_config: {
    technical: "Why we recommend this configuration:",
    plain: "Why we recommend this option:",
  },
  what_this_means_colon: {
    technical: "What this means:",
    plain: "What to do:",
  },
  executive_summary: {
    technical: "Executive summary",
    plain: "Summary",
  },
  confidence_that_safer: {
    technical: "that {name} is safer for production",
    plain: "that {name} is the better choice",
  },
  reliability_metrics: {
    technical: "Reliability metrics",
    plain: "How often each option had problems",
  },
  table_configuration: {
    technical: "Configuration",
    plain: "Option",
  },
  table_failure_rate: {
    technical: "Failure rate",
    plain: "Problem rate",
  },
  table_failures: {
    technical: "Failures",
    plain: "Problems",
  },
  table_tests: {
    technical: "Tests",
    plain: "Tests",
  },
  note_low_sample: {
    technical: "Note: Fewer than 100 tests per config; consider a full run for higher confidence.",
    plain: "Note: We ran fewer than 100 tests; run a full comparison for more confidence.",
  },
  configurations_compared: {
    technical: "Configurations compared",
    plain: "Options compared",
  },
  table_parameter: {
    technical: "Parameter",
    plain: "Setting",
  },
  broke_at_prompt: {
    technical: "broke at prompt",
    plain: "had a serious problem at test",
  },
  failure_mode_breakdown_section: {
    technical: "Failure mode breakdown",
    plain: "What went wrong",
  },
  no_failure_events_run: {
    technical: "No failure events in this run.",
    plain: "No problems in this run.",
  },
  prompt_family_distribution_section: {
    technical: "Prompt family distribution",
    plain: "Which prompt types had problems",
  },
  no_prompt_family_data_run: {
    technical: "No prompt family data.",
    plain: "No prompt type data.",
  },
  failure_hotspots_section: {
    technical: "Failure hotspots (prompt family × failure mode)",
    plain: "Where problems showed up most",
  },
  table_prompt_family: {
    technical: "Prompt family",
    plain: "Prompt type",
  },
  table_failure_mode: {
    technical: "Failure mode",
    plain: "Problem type",
  },
} as const;

// —— Failure mode display names (for titles/labels) ——
export const FAILURE_MODE_NAMES: Record<
  string,
  { technical: string; plain: string }
> = {
  context_overflow: {
    technical: "Context Overflow",
    plain: "Too Much Input",
  },
  silent_truncation_risk: {
    technical: "Silent Truncation Risk",
    plain: "Content May Be Cut Off",
  },
  latency_breach: {
    technical: "Latency Breach",
    plain: "Slow Response",
  },
  cost_runaway: {
    technical: "Cost Runaway",
    plain: "Unexpectedly High Costs",
  },
  tool_timeout_risk: {
    technical: "Tool Timeout Risk",
    plain: "Feature Timed Out",
  },
  retrieval_noise_risk: {
    technical: "Retrieval Noise Risk",
    plain: "Search Results Too Broad",
  },
};

/**
 * Get failure mode description with optional count/proportion. Used in failure-breakdown and report.
 */
export function getFailureModeDescription(
  mode: string,
  count: number,
  proportion: number,
  isPlainLanguage: boolean
): string {
  const pct = (proportion * 100).toFixed(1);
  const events = `${count} event${count !== 1 ? "s" : ""}`;
  const ofFailures = `(${pct}% of failures)`;

  const descriptions: Record<
    string,
    { technical: string; plain: string }
  > = {
    context_overflow: {
      technical: `Detected in ${events} ${ofFailures}. Input tokens exceed context window limit, causing truncation.`,
      plain: `Found in ${events} ${ofFailures}. The AI received more text than it could hold, so some was cut off.`,
    },
    silent_truncation_risk: {
      technical: `Detected in ${events} ${ofFailures}. Context usage exceeds 85% threshold, risking silent truncation.`,
      plain: `Found in ${events} ${ofFailures}. The AI was close to its limit, so content might have been cut off without warning.`,
    },
    latency_breach: {
      technical: `Detected in ${events} ${ofFailures}. Response latency exceeds 15000ms (15s) threshold.`,
      plain: `Found in ${events} ${ofFailures}. The response took longer than 15 seconds to arrive.`,
    },
    cost_runaway: {
      technical: `Detected in ${events} ${ofFailures}. Estimated cost exceeds configured budget threshold.`,
      plain: `Found in ${events} ${ofFailures}. The estimated cost went over the limit you set.`,
    },
    tool_timeout_risk: {
      technical: `Detected in ${events} ${ofFailures}. Tool calls present with timeout events detected.`,
      plain: `Found in ${events} ${ofFailures}. A feature the AI tried to use took too long and timed out.`,
    },
    retrieval_noise_risk: {
      technical: `Detected in ${events} ${ofFailures}. Top-K retrieval value exceeds 8, increasing noise risk.`,
      plain: `Found in ${events} ${ofFailures}. Too many search results were considered, which can reduce accuracy.`,
    },
  };

  const d = descriptions[mode];
  if (d) return isPlainLanguage ? d.plain : d.technical;
  return isPlainLanguage
    ? `Found in ${events}.`
    : `Detected in ${events}.`;
}

/**
 * Format failure mode for display (title case from snake_case), then apply technical/plain.
 */
export function getFailureModeLabel(mode: string, isPlainLanguage: boolean): string {
  const entry = FAILURE_MODE_NAMES[mode];
  if (entry) return isPlainLanguage ? entry.plain : entry.technical;
  return mode
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
