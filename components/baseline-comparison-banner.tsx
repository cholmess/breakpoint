"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useText } from "@/hooks/use-text";
import type { AnalysisData, ComparisonsData, Config, Baseline } from "@/types/dashboard";

function getComparisonSummary(
  comparisons: ComparisonsData,
  configA: Config,
  configB: Config,
  configALabel: string,
  configBLabel: string
): { label: string; pct: number } | null {
  const c = comparisons.comparisons.find(
    (x) =>
      (x.config_a === configA.id && x.config_b === configB.id) ||
      (x.config_a === configB.id && x.config_b === configA.id)
  );
  if (!c) return null;
  const pA = c.config_a === configA.id ? c.p_a_safer : 1 - c.p_a_safer;
  const pct = Math.round(pA * 100);
  const label = pA > 0.5 ? configALabel : configBLabel;
  const safePct = pA > 0.5 ? pct : 100 - pct;
  return { label, pct: safePct };
}

function getAvgFailureRate(analysis: AnalysisData, configA: Config, configB: Config): number {
  const a = analysis.configs[configA.id]?.phat ?? 0;
  const b = analysis.configs[configB.id]?.phat ?? 0;
  return (a + b) / 2;
}

interface BaselineComparisonBannerProps {
  current: {
    analysis: AnalysisData;
    comparisons: ComparisonsData;
    configA: Config;
    configB: Config;
  };
  baseline: Baseline;
  onClearBaseline: () => void;
}

export function BaselineComparisonBanner({
  current,
  baseline,
  onClearBaseline,
}: BaselineComparisonBannerProps) {
  const { t } = useText();
  const currentSummary = getComparisonSummary(
    current.comparisons,
    current.configA,
    current.configB,
    t("config_a"),
    t("config_b")
  );
  const baselineSummary = getComparisonSummary(
    baseline.comparisons,
    baseline.configA,
    baseline.configB,
    t("config_a"),
    t("config_b")
  );

  const currentAvg = getAvgFailureRate(current.analysis, current.configA, current.configB);
  const baselineAvg = getAvgFailureRate(baseline.analysis, baseline.configA, baseline.configB);

  const rateDeltaPct = (baselineAvg - currentAvg) * 100;
  const improved = rateDeltaPct > 0;
  const rateText =
    Math.abs(rateDeltaPct) < 0.5
      ? null
      : improved
        ? t("failure_rate_improved", { pct: rateDeltaPct.toFixed(1) })
        : t("failure_rate_increased", { pct: (-rateDeltaPct).toFixed(1) });

  const savedAt = baseline.savedAt ? new Date(baseline.savedAt).toLocaleDateString(undefined, { dateStyle: "short" }) : "";

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-foreground">{t("compare_to_baseline")}</span>
        {currentSummary && baselineSummary && (
          <span className="text-muted-foreground">
            Current run: <strong>{currentSummary.label} {currentSummary.pct}% {t("safer")}</strong>
            {" · "}
            Baseline: <strong>{baselineSummary.label} {baselineSummary.pct}% {t("safer")}</strong>
            {savedAt && ` (${t("saved")} ${savedAt})`}
          </span>
        )}
        {rateText && (
          <span className={improved ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
            {rateText}
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={onClearBaseline}
      >
        <X className="h-4 w-4 mr-1" />
        {t("clear_baseline")}
      </Button>
    </div>
  );
}
