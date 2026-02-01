"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useText } from "@/hooks/use-text";
import type { Comparison } from "@/types/dashboard";

interface ProbabilityCardProps {
  comparisons: Comparison[];
  selectedConfigA?: string;
  selectedConfigB?: string;
  isRunning: boolean;
}

export function ProbabilityCard({
  comparisons,
  selectedConfigA,
  selectedConfigB,
  isRunning,
}: ProbabilityCardProps) {
  const { t } = useText();
  // Filter comparisons to only show those involving the selected configs
  const filteredComparisons = comparisons.filter(
    (c) =>
      (c.config_a === selectedConfigA || c.config_b === selectedConfigA) &&
      (c.config_a === selectedConfigB || c.config_b === selectedConfigB)
  );
  
  // Find the comparison for the selected configs
  const currentComparison = filteredComparisons.find(
    (c) =>
      (c.config_a === selectedConfigA && c.config_b === selectedConfigB) ||
      (c.config_a === selectedConfigB && c.config_b === selectedConfigA)
  );

  // pRaw = P(selectedConfigA is safer than selectedConfigB)
  const pRaw = currentComparison
    ? currentComparison.config_a === selectedConfigA
      ? currentComparison.p_a_safer
      : 1 - currentComparison.p_a_safer
    : filteredComparisons.length > 0
    ? filteredComparisons[0].p_a_safer
    : 0.5;

  const isIndeterminate = pRaw === 0.5;
  // Always show confidence in the *safer* choice: high % = safer, never "0% + Higher Risk"
  const isSaferA = pRaw > 0.5;
  const confidenceInSafer = isSaferA ? pRaw : 1 - pRaw; // P(safer config is safer)
  const displayValue = isRunning
    ? "..."
    : isIndeterminate
    ? "N/A"
    : `${(confidenceInSafer * 100).toFixed(1)}%`;
  const isSafe = true; // "safe" here means "we're showing the safer choice" (green)

  return (
    <Card
      className={cn(
        "py-6 border-2 transition-colors duration-500 glass-card",
        isIndeterminate
          ? "border-muted/50"
          : isSafe
          ? "border-[#25924d]/50"
          : "border-destructive/50"
      )}
    >
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3 leading-relaxed">
            {t("which_config_safer")}
          </div>
          <div
            className={cn(
              "text-5xl font-bold font-mono tabular-nums transition-colors",
              isRunning && "animate-pulse",
              isIndeterminate
                ? "text-muted-foreground"
                : isSafe
                ? "text-[#25924d] neon-text-subtle"
                : "text-destructive"
            )}
          >
            {displayValue}
          </div>
          {!isIndeterminate && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium leading-relaxed bg-[#25924d]/10 text-[#25924d]">
              <span className="h-2 w-2 rounded-full bg-[#25924d]" />
              {isSaferA
                ? `${selectedConfigA || t("config_a")} ${t("is_safer_choice")}`
                : `${selectedConfigB || t("config_b")} ${t("is_safer_choice")}`}
            </div>
          )}
          <div className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto px-2">
            {isIndeterminate
              ? t("both_similar_reliability")
              : t("confidence_bayesian", {
                  name: isSaferA ? (selectedConfigA || t("config_a")) : (selectedConfigB || t("config_b")),
                })}
          </div>
        </div>

        {/* Show all comparisons if there are multiple */}
        {filteredComparisons.length > 1 && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3 leading-relaxed">
              {t("all_comparisons")}
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {filteredComparisons.map((comp, idx) => {
                const isCurrent =
                  (comp.config_a === selectedConfigA &&
                    comp.config_b === selectedConfigB) ||
                  (comp.config_a === selectedConfigB &&
                    comp.config_b === selectedConfigA);
                const isIndet = comp.p_a_safer === 0.5;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between text-sm p-2 rounded leading-relaxed",
                      isCurrent && "bg-primary/10 border border-primary/20",
                      !isCurrent && "bg-muted/30"
                    )}
                  >
                    <span className="font-mono text-sm">
                      {comp.config_a} vs {comp.config_b}
                    </span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        isIndet
                          ? "text-muted-foreground"
                          : comp.p_a_safer > 0.5
                          ? "text-[#25924d]"
                          : "text-destructive"
                      )}
                    >
                      {isIndet
                        ? "N/A"
                        : `${(comp.p_a_safer * 100).toFixed(1)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
