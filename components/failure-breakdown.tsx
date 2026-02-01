"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useText } from "@/hooks/use-text";
import type { DistributionsData } from "@/types/dashboard";
import type { FailureMode } from "@/types/dashboard";

interface FailureBreakdownProps {
  byFailureMode: DistributionsData["by_failure_mode"];
}

// Map failure modes to severity
const getFailureModeSeverity = (mode: FailureMode): "high" | "medium" => {
  const highSeverityModes: FailureMode[] = [
    "context_overflow",
    "cost_runaway",
    "tool_timeout_risk",
  ];
  return highSeverityModes.includes(mode) ? "high" : "medium";
};

export function FailureBreakdown({
  byFailureMode,
}: FailureBreakdownProps) {
  const { t, getFailureModeLabel, getFailureModeDescription } = useText();
  const failureEntries = Object.values(byFailureMode)
    .map((entry) => ({
      mode: entry.failure_mode as FailureMode,
      count: entry.count,
      proportion: entry.proportion,
      severity: getFailureModeSeverity(entry.failure_mode as FailureMode),
    }))
    .sort((a, b) => {
      // Sort by severity first (high before medium), then by count
      if (a.severity !== b.severity) {
        return a.severity === "high" ? -1 : 1;
      }
      return b.count - a.count;
    });

  if (failureEntries.length === 0) {
    return (
      <Card className="py-3 glass-card">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("what_went_wrong")}
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            {t("failure_breakdown_desc")}
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-base text-muted-foreground text-center py-4 leading-relaxed">
            {t("no_failure_events")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-3 glass-card">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle leading-tight">
          {t("failure_mode_breakdown")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Failure Items */}
        <div className="space-y-2">
          {failureEntries.map((item, index) => (
            <div
              key={`failure-${index}-${item.mode}`}
              className={cn(
                "flex items-start gap-3 p-2 rounded-md border",
                item.severity === "high" &&
                  "border-destructive/30 bg-destructive/5",
                item.severity === "medium" &&
                  "border-amber-400/30 bg-amber-400/5"
              )}
            >
              <div
                className={cn(
                  "shrink-0 mt-0.5 h-2 w-2 rounded-full",
                  item.severity === "high" && "bg-destructive",
                  item.severity === "medium" && "bg-amber-400"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium leading-relaxed">
                    {getFailureModeLabel(item.mode)}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-mono uppercase px-2 py-1 rounded leading-relaxed",
                      item.severity === "high" &&
                        "bg-destructive/10 text-destructive",
                      item.severity === "medium" &&
                        "bg-amber-400/10 text-amber-600"
                    )}
                  >
                    {t(item.severity === "high" ? "high" : "medium")}
                  </span>
                  <span className="text-sm text-white ml-auto leading-relaxed">
                    {item.count} event{item.count !== 1 ? "s" : ""} ({(item.proportion * 100).toFixed(1)}%)
                  </span>
                </div>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  {getFailureModeDescription(item.mode, item.count, item.proportion)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
