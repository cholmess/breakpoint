"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
  // Find the comparison for the selected configs
  const currentComparison = comparisons.find(
    (c) =>
      (c.config_a === selectedConfigA && c.config_b === selectedConfigB) ||
      (c.config_a === selectedConfigB && c.config_b === selectedConfigA)
  );

  // If we have a comparison, use it; otherwise show the first one or a default
  const pValue = currentComparison
    ? currentComparison.config_a === selectedConfigA
      ? currentComparison.p_a_safer
      : 1 - currentComparison.p_a_safer
    : comparisons.length > 0
    ? comparisons[0].p_a_safer
    : 0.5;

  const isIndeterminate = pValue === 0.5;
  const isSafe = pValue > 0.5;
  const displayValue = isRunning
    ? "..."
    : isIndeterminate
    ? "N/A"
    : `${(pValue * 100).toFixed(1)}%`;

  const configLabel = currentComparison
    ? currentComparison.config_a === selectedConfigA
      ? `P(${selectedConfigA} safer than ${selectedConfigB})`
      : `P(${selectedConfigB} safer than ${selectedConfigA})`
    : "Probability Comparison";

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
        <div className="text-center mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Pairwise Comparison
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            {configLabel}
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
            <div
              className={cn(
                "mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                isSafe
                  ? "bg-[#25924d]/10 text-[#25924d]"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isSafe ? "bg-[#25924d]" : "bg-destructive"
                )}
              />
              {isSafe ? "Safer" : "Higher Risk"}
            </div>
          )}
        </div>

        {/* Show all comparisons if there are multiple */}
        {comparisons.length > 1 && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
              All Comparisons
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {comparisons.map((comp, idx) => {
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
                      "flex items-center justify-between text-xs p-2 rounded",
                      isCurrent && "bg-primary/10 border border-primary/20",
                      !isCurrent && "bg-muted/30"
                    )}
                  >
                    <span className="font-mono text-[10px]">
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
