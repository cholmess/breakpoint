"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

// Format failure mode name for display
const formatFailureMode = (mode: string): string => {
  return mode
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Get description for failure mode
const getFailureModeDescription = (
  mode: FailureMode,
  count: number,
  proportion: number
): string => {
  const descriptions: Record<FailureMode, string> = {
    context_overflow: `Detected in ${count} event(s) (${(proportion * 100).toFixed(1)}% of failures). Input tokens exceed context window limit, causing truncation.`,
    silent_truncation_risk: `Detected in ${count} event(s) (${(proportion * 100).toFixed(1)}% of failures). Context usage exceeds 85% threshold, risking silent truncation.`,
    latency_breach: `Detected in ${count} event(s) (${(proportion * 100).toFixed(1)}% of failures). Response latency exceeds 15000ms (15s) threshold.`,
    cost_runaway: `Detected in ${count} event(s) (${(proportion * 100).toFixed(1)}% of failures). Estimated cost exceeds configured budget threshold.`,
    tool_timeout_risk: `Detected in ${count} event(s) (${(proportion * 100).toFixed(1)}% of failures). Tool calls present with timeout events detected.`,
    retrieval_noise_risk: `Detected in ${count} event(s) (${(proportion * 100).toFixed(1)}% of failures). Top-K retrieval value exceeds 8, increasing noise risk.`,
  };
  return descriptions[mode] || `Detected in ${count} event(s).`;
};

export function FailureBreakdown({
  byFailureMode,
}: FailureBreakdownProps) {
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
            What Went Wrong?
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            Breakdown of specific issues detected during testing, sorted by severity.
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-base text-muted-foreground text-center py-4 leading-relaxed">
            No failure events detected
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-3 glass-card">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle leading-tight">
          Failure Mode Breakdown
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
                    {formatFailureMode(item.mode)}
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
                    {item.severity}
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
