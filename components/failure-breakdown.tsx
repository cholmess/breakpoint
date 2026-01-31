"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FailureItem {
  mode: string;
  severity: "high" | "medium" | "low";
  description: string;
}

interface FailureBreakdownProps {
  failures: FailureItem[];
  reasoning: string;
}

export function FailureBreakdown({
  failures,
  reasoning,
}: FailureBreakdownProps) {
  return (
    <Card className="py-3">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Failure Mode Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Failure Items */}
        <div className="space-y-2">
          {failures.map((item, index) => (
            <div
              key={`failure-${index}-${item.mode}`}
              className={cn(
                "flex items-start gap-3 p-2 rounded-md border",
                item.severity === "high" &&
                  "border-destructive/30 bg-destructive/5",
                item.severity === "medium" &&
                  "border-amber-400/30 bg-amber-400/5",
                item.severity === "low" && "border-emerald/30 bg-emerald-light/30"
              )}
            >
              <div
                className={cn(
                  "shrink-0 mt-0.5 h-2 w-2 rounded-full",
                  item.severity === "high" && "bg-destructive",
                  item.severity === "medium" && "bg-amber-400",
                  item.severity === "low" && "bg-emerald"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{item.mode}</span>
                  <span
                    className={cn(
                      "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded",
                      item.severity === "high" &&
                        "bg-destructive/10 text-destructive",
                      item.severity === "medium" &&
                        "bg-amber-400/10 text-amber-600",
                      item.severity === "low" && "bg-emerald/10 text-emerald"
                    )}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Reasoning Output */}
        <div className="pt-3 border-t border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Reasoning Output
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            {reasoning}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
