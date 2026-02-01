"use client";

import type { AnalysisData, ComparisonsData, Config } from "@/types/dashboard";

interface RecommendationBannerProps {
  analysisData: AnalysisData | null;
  comparisonsData: ComparisonsData | null;
  configA: Config;
  configB: Config;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return "High";
  if (confidence >= 0.5) return "Moderate";
  return "Low";
}

/**
 * Detailed recommendation banner: one-sentence recommendation plus key takeaways.
 */
export function RecommendationBanner({
  analysisData,
  comparisonsData,
  configA,
  configB,
}: RecommendationBannerProps) {
  const currentComparison = comparisonsData?.comparisons.find(
    (c) =>
      (c.config_a === configA.id && c.config_b === configB.id) ||
      (c.config_a === configB.id && c.config_b === configA.id)
  );

  const configAStats = analysisData?.configs[configA.id];
  const configBStats = analysisData?.configs[configB.id];

  const pValue =
    currentComparison != null
      ? currentComparison.config_a === configA.id
        ? currentComparison.p_a_safer
        : 1 - currentComparison.p_a_safer
      : null;

  const saferConfig = pValue != null && pValue > 0.5 ? configA : pValue != null && pValue < 0.5 ? configB : null;
  const confidence = pValue != null ? Math.abs(pValue - 0.5) * 2 : 0;
  const confidencePct = Math.round(confidence * 100);

  const hasCost = typeof configA.cost_per_1k_tokens === "number" && typeof configB.cost_per_1k_tokens === "number";
  const costNote =
    hasCost && saferConfig
      ? configA.cost_per_1k_tokens !== configB.cost_per_1k_tokens
        ? saferConfig === configA
          ? configA.cost_per_1k_tokens < configB.cost_per_1k_tokens
            ? " (and is cheaper)"
            : ""
          : configB.cost_per_1k_tokens < configA.cost_per_1k_tokens
            ? " (and is cheaper)"
            : ""
        : " (same cost)"
      : "";

  if (!currentComparison || !configAStats || !configBStats) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-center text-base text-muted-foreground">
        Run a simulation to see which configuration we recommend.
      </div>
    );
  }

  if (pValue === 0.5) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-center text-base text-muted-foreground">
        Both configurations are equally likely to be safer. Consider other factors like cost or latency.
      </div>
    );
  }

  const saferName = saferConfig === configA ? "Config A" : "Config B";
  const otherName = saferConfig === configA ? "Config B" : "Config A";
  const saferRate = saferConfig === configA ? configAStats.phat : configBStats.phat;
  const otherRate = saferConfig === configA ? configBStats.phat : configAStats.phat;
  const totalTests =
    ((configAStats?.n ?? 0) + (configBStats?.n ?? 0)) || (configAStats?.n ?? configBStats?.n ?? 0);
  const rateDiffPct = Math.abs((saferRate - otherRate) * 100);

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 overflow-hidden">
      {/* Main recommendation */}
      <div className="px-4 py-3 text-center border-b border-border/50">
        <p className="text-base font-medium leading-relaxed text-foreground">
          We recommend <strong>{saferName}</strong> for production — {confidencePct}% chance it&apos;s safer.{costNote}
        </p>
      </div>
      {/* Key details */}
      <div className="px-4 py-3 bg-card/50">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <div className="text-muted-foreground font-mono uppercase tracking-wider text-xs leading-tight">
              Failure rate comparison
            </div>
            <div className="mt-1 font-medium text-foreground leading-tight">
              {saferName} {(saferRate * 100).toFixed(1)}% vs {otherName} {(otherRate * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {rateDiffPct.toFixed(1)}% difference
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <div className="text-muted-foreground font-mono uppercase tracking-wider text-xs leading-tight">
              Confidence
            </div>
            <div className="mt-1 font-medium text-foreground leading-tight">
              {confidenceLabel(confidence)} ({confidencePct}%)
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Statistical strength of recommendation
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <div className="text-muted-foreground font-mono uppercase tracking-wider text-xs leading-tight">
              Sample size
            </div>
            <div className="mt-1 font-medium text-foreground leading-tight">
              {configAStats.n} + {configBStats.n} = {totalTests} tests
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Config A / Config B / total
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <div className="text-muted-foreground font-mono uppercase tracking-wider text-xs leading-tight">
              Failures observed
            </div>
            <div className="mt-1 font-medium text-foreground leading-tight">
              {configAStats.k} + {configBStats.k} = {configAStats.k + configBStats.k} total
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Config A / Config B
            </div>
          </div>
        </div>
        {(configAStats.low_sample_warning || configBStats.low_sample_warning) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 leading-relaxed">
            With fewer than 100 tests per config, consider running a full simulation for higher confidence.
          </p>
        )}
      </div>
    </div>
  );
}
