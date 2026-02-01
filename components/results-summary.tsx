"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, AlertCircle, CheckCircle2 } from "lucide-react";
import { useText } from "@/hooks/use-text";
import type { AnalysisData, ComparisonsData, DistributionsData, Config } from "@/types/dashboard";

interface ResultsSummaryProps {
  analysisData: AnalysisData | null;
  comparisonsData: ComparisonsData | null;
  distributionsData: DistributionsData | null;
  configA: Config;
  configB: Config;
}

export function ResultsSummary({
  analysisData,
  comparisonsData,
  distributionsData,
  configA,
  configB,
}: ResultsSummaryProps) {
  const { t, getFailureModeLabel } = useText();
  // Find the comparison for the selected configs
  const currentComparison = comparisonsData?.comparisons.find(
    (c) =>
      (c.config_a === configA.id && c.config_b === configB.id) ||
      (c.config_a === configB.id && c.config_b === configA.id)
  );

  // Get failure rates for each config
  const configAStats = analysisData?.configs[configA.id];
  const configBStats = analysisData?.configs[configB.id];

  // Calculate which config is safer
  const pValue = currentComparison
    ? currentComparison.config_a === configA.id
      ? currentComparison.p_a_safer
      : 1 - currentComparison.p_a_safer
    : null;

  const saferConfig = pValue !== null && pValue > 0.5 ? configA : pValue !== null && pValue < 0.5 ? configB : null;
  const confidence = pValue !== null ? Math.abs(pValue - 0.5) * 2 : 0; // Convert to 0-1 scale

  // Get total failures
  const totalFailures = distributionsData?.by_failure_mode
    ? Object.values(distributionsData.by_failure_mode).reduce((sum, entry) => sum + (entry.count || 0), 0)
    : 0;

  // Get most common failure mode
  const mostCommonFailure = distributionsData?.by_failure_mode
    ? Object.values(distributionsData.by_failure_mode).sort((a, b) => (b.count || 0) - (a.count || 0))[0]
    : null;

  // Generate simple summary
  const getSummary = (): string => {
    if (!currentComparison || !configAStats || !configBStats) {
      return t("run_simulation_to_see");
    }

    if (pValue === 0.5) {
      return t("both_similar_failure_rates");
    }

    const saferName = saferConfig === configA ? t("config_a") : t("config_b");
    const otherName = saferConfig === configA ? t("config_b") : t("config_a");
    const saferRatePct = (saferConfig === configA ? configAStats.phat : configBStats.phat) * 100;
    const otherRatePct = (saferConfig === configA ? configBStats.phat : configAStats.phat) * 100;
    const saferRateStr = saferRatePct.toFixed(1);
    const otherRateStr = otherRatePct.toFixed(1);

    if (confidence > 0.7) {
      return t("summary_significantly_more_reliable", {
        saferName,
        otherName,
        saferRate: saferRateStr,
        otherRate: otherRateStr,
      });
    } else if (confidence > 0.5) {
      return t("summary_appears_more_reliable", {
        saferName,
        saferRate: saferRateStr,
        otherRate: otherRateStr,
      });
    } else {
      return t("summary_quite_similar", {
        saferName,
        saferRate: saferRateStr,
        otherRate: otherRateStr,
      });
    }
  };

  // Generate reasoning
  const getReasoning = (): string[] => {
    const reasons: string[] = [];

    if (!configAStats || !configBStats) {
      return [t("no_analysis_data_yet")];
    }

    const rateDiff = Math.abs((configAStats.phat - configBStats.phat) * 100);
    if (rateDiff > 5) {
      reasons.push(t("reason_rate_difference", { rateDiff: rateDiff.toFixed(1) }));
    }

    const lowSample = configAStats.low_sample_warning || configBStats.low_sample_warning;
    if (lowSample) {
      reasons.push(t("reason_low_sample"));
    }

    if (mostCommonFailure && mostCommonFailure.failure_mode) {
      const modeName = getFailureModeLabel(mostCommonFailure.failure_mode as string);
      reasons.push(
        t("reason_most_common_issue", {
          modeName,
          count: String(mostCommonFailure.count || 0),
          total: String(totalFailures),
        })
      );
    }

    if (totalFailures > 0) {
      const totalTrials = configAStats.n || configBStats.n || 0;
      const overallRate = totalTrials > 0 ? ((totalFailures / totalTrials) * 100).toFixed(1) : "0";
      reasons.push(t("reason_overall_rate", { rate: overallRate }));
    } else {
      reasons.push(t("reason_no_failures"));
    }

    const differences: string[] = [];
    if (configA.context_window !== configB.context_window) {
      differences.push(`${t("label_context_window")} (${configA.context_window} vs ${configB.context_window})`);
    }
    if (configA.tools_enabled !== configB.tools_enabled) {
      differences.push(`${t("label_tools")} ${configA.tools_enabled ? t("tools_enabled") : t("tools_disabled")} vs ${configB.tools_enabled ? t("tools_enabled") : t("tools_disabled")}`);
    }
    if (configA.top_k !== configB.top_k) {
      differences.push(`${t("label_top_k")} (${configA.top_k} vs ${configB.top_k})`);
    }

    if (differences.length > 0) {
      reasons.push(t("reason_key_differences", { diffs: differences.join(", ") }));
    }

    return reasons.length > 0 ? reasons : [t("reason_analysis_complete")];
  };

  const summary = getSummary();
  const reasoning = getReasoning();
  const hasFailures = totalFailures > 0;

  return (
    <Card className="py-3 glass-card border-2 border-primary/20">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle flex items-center gap-2 leading-tight">
          <Lightbulb className="h-4 w-4" />
          {t("results_summary_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-4">
        {/* Main Summary */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            {hasFailures ? (
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-[#25924d] mt-0.5 shrink-0" />
            )}
            <p className="text-base leading-relaxed text-foreground">
              {summary}
            </p>
          </div>
        </div>

        {/* Reasoning Section */}
        {reasoning.length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3 leading-relaxed">
              {t("why_this_matters")}
            </div>
            <ul className="space-y-2">
              {reasoning.map((reason, idx) => (
                <li key={idx} className="text-base text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="text-primary mt-1 shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Stats */}
        {configAStats && configBStats && (
          <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground leading-relaxed">
                {t("config_a_failure_rate")}
              </div>
              <div className="text-2xl font-bold font-mono text-[#95ccf9] leading-tight">
                {(configAStats.phat * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                {configAStats.k} {t("failures_out_of_tests")} {configAStats.n} {t("tests")}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground leading-relaxed">
                {t("config_b_failure_rate")}
              </div>
              <div className="text-2xl font-bold font-mono text-[#25924d] leading-tight">
                {(configBStats.phat * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                {configBStats.k} {t("failures_out_of_tests")} {configBStats.n} {t("tests")}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

