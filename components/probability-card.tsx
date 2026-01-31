"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProbabilityCardProps {
  probability: number;
  isRunning: boolean;
}

export function ProbabilityCard({
  probability,
  isRunning,
}: ProbabilityCardProps) {
  const isSafe = probability >= 50;
  const displayValue = isRunning ? "..." : `${probability.toFixed(1)}%`;

  return (
    <Card
      className={cn(
        "py-6 border-2 transition-colors duration-500",
        isSafe ? "border-emerald/50 bg-emerald-light/30" : "border-destructive/50 bg-destructive/5"
      )}
    >
      <CardContent className="p-6 text-center">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Probability Comparison
        </div>
        <div className="text-xs text-muted-foreground mb-4">
          P(Config B is safer than A)
        </div>
        <div
          className={cn(
            "text-5xl font-bold font-mono tabular-nums transition-colors",
            isRunning && "animate-pulse",
            isSafe ? "text-emerald" : "text-destructive"
          )}
        >
          {displayValue}
        </div>
        <div
          className={cn(
            "mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
            isSafe
              ? "bg-emerald/10 text-emerald"
              : "bg-destructive/10 text-destructive"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isSafe ? "bg-emerald" : "bg-destructive"
            )}
          />
          {isSafe ? "Safe Zone" : "Failure Risk"}
        </div>
      </CardContent>
    </Card>
  );
}
