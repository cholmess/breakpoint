"use client";

import type { AnalysisData, ComparisonsData, Config } from "@/types/dashboard";

interface RecommendationBannerProps {
  analysisData: AnalysisData | null;
  comparisonsData: ComparisonsData | null;
  configA: Config;
  configB: Config;
}

/**
 * One-sentence recommendation derived from the same logic as ResultsSummary.
 * Shows: "We recommend Config B for production — 87% chance it's safer."
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

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 text-center">
      <p className="text-base font-medium leading-relaxed text-foreground">
        We recommend <strong>{saferName}</strong> for production — {confidencePct}% chance it&apos;s safer.{costNote}
      </p>
    </div>
  );
}
