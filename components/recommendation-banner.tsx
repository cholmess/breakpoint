"use client";

import type { AnalysisData, ComparisonsData, DistributionsData, Config } from "@/types/dashboard";

interface RecommendationBannerProps {
  analysisData: AnalysisData | null;
  comparisonsData: ComparisonsData | null;
  distributionsData?: DistributionsData | null;
  configA: Config;
  configB: Config;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.5) return "moderate";
  return "low";
}

function formatFailureMode(mode: string): string {
  return mode
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Recommendation banner that explains the why and what: recommends a config
 * and explains why (evidence) and what it means (what to do).
 */
export function RecommendationBanner({
  analysisData,
  comparisonsData,
  distributionsData = null,
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
  const cheaperIsSafer =
    hasCost &&
    saferConfig &&
    (saferConfig === configA ? configA.cost_per_1k_tokens < configB.cost_per_1k_tokens : configB.cost_per_1k_tokens < configA.cost_per_1k_tokens);
  const sameCost = hasCost && configA.cost_per_1k_tokens === configB.cost_per_1k_tokens;

  const byMode = distributionsData?.by_failure_mode ?? {};
  const mostCommon = Object.values(byMode)
    .filter((e) => e.failure_mode != null)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
  const totalFailures = Object.values(byMode).reduce((sum, e) => sum + (e.count ?? 0), 0);

  if (!currentComparison || !configAStats || !configBStats) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-center text-base text-muted-foreground">
        Run a simulation to see which configuration we recommend and why.
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
  const rateDiffPct = Math.abs((saferRate - otherRate) * 100);
  const lowSample = configAStats.low_sample_warning || configBStats.low_sample_warning;

  // Build "why" paragraphs
  const whyParts: string[] = [];
  whyParts.push(
    `We recommend ${saferName} because it had a lower failure rate in this run: ${(saferRate * 100).toFixed(1)}% versus ${otherName}'s ${(otherRate * 100).toFixed(1)}%.`
  );
  whyParts.push(
    `Our analysis gives a ${confidenceLabel(confidence)} confidence (${confidencePct}%) that ${saferName} is the safer choice for production.`
  );
  if (mostCommon && totalFailures > 0) {
    const modeName = formatFailureMode(mostCommon.failure_mode as string);
    whyParts.push(
      `The most common issue in this run was ${modeName} (${mostCommon.count ?? 0} of ${totalFailures} failure events); ${saferName} handled the workload better overall.`
    );
  }
  if (cheaperIsSafer) {
    whyParts.push(`${saferName} is also cheaper per 1k tokens, so it's a better choice on both reliability and cost.`);
  } else if (sameCost) {
    whyParts.push("Both configs have the same cost per 1k tokens, so the recommendation is based purely on reliability.");
  }

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 overflow-hidden">
      {/* What we recommend */}
      <div className="px-4 py-3 border-b border-border/50">
        <p className="text-base font-semibold leading-relaxed text-foreground">
          We recommend <strong>{saferName}</strong> for production.
        </p>
      </div>

      {/* Why we recommend it */}
      <div className="px-4 py-3 bg-card/50 space-y-3">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Why we recommend {saferName}
        </p>
        <ul className="space-y-2 text-sm text-foreground leading-relaxed list-none">
          {whyParts.map((text, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary shrink-0 mt-0.5">•</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {/* What it means / what to do */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
            What this means
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {lowSample ? (
              <>
                Use {saferName} for production if you're satisfied with this sample. For higher confidence, run a full simulation (200 prompts) before committing.
              </>
            ) : (
              <>
                Use {saferName} in production for better reliability. The {rateDiffPct.toFixed(1)}% lower failure rate and {confidencePct}% confidence support this choice.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
