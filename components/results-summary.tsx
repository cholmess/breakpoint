"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisData, ComparisonsData, DistributionsData, Config } from "@/types/dashboard";

interface ResultsSummaryProps {
  analysisData: AnalysisData | null;
  comparisonsData: ComparisonsData | null;
  distributionsData: DistributionsData | null;
  configA: Config;
  configB: Config;
}

export function ResultsSummary({
  analysisData,
  comparisonsData,
  distributionsData,
  configA,
  configB,
}: ResultsSummaryProps) {
  // Find the comparison for the selected configs
  const currentComparison = comparisonsData?.comparisons.find(
    (c) =>
      (c.config_a === configA.id && c.config_b === configB.id) ||
      (c.config_a === configB.id && c.config_b === configA.id)
  );

  // Get failure rates for each config
  const configAStats = analysisData?.configs[configA.id];
  const configBStats = analysisData?.configs[configB.id];

  // Calculate which config is safer
  const pValue = currentComparison
    ? currentComparison.config_a === configA.id
      ? currentComparison.p_a_safer
      : 1 - currentComparison.p_a_safer
    : null;

  const saferConfig = pValue !== null && pValue > 0.5 ? configA : pValue !== null && pValue < 0.5 ? configB : null;
  const confidence = pValue !== null ? Math.abs(pValue - 0.5) * 2 : 0; // Convert to 0-1 scale

  // Get total failures
  const totalFailures = distributionsData?.by_failure_mode
    ? Object.values(distributionsData.by_failure_mode).reduce((sum, entry) => sum + (entry.count || 0), 0)
    : 0;

  // Get most common failure mode
  const mostCommonFailure = distributionsData?.by_failure_mode
    ? Object.values(distributionsData.by_failure_mode).sort((a, b) => (b.count || 0) - (a.count || 0))[0]
    : null;

  // Generate simple summary
  const getSummary = (): string => {
    if (!currentComparison || !configAStats || !configBStats) {
      return "Run a simulation to see which configuration performs better.";
    }

    if (pValue === 0.5) {
      return "Both configurations show similar failure rates. Consider other factors like cost or latency.";
    }

    const saferName = saferConfig === configA ? "Config A" : "Config B";
    const otherName = saferConfig === configA ? "Config B" : "Config A";
    const saferRate = saferConfig === configA ? configAStats.phat : configBStats.phat;
    const otherRate = saferConfig === configA ? configBStats.phat : configAStats.phat;

    if (confidence > 0.7) {
      return `${saferName} is significantly more reliable, with ${(saferRate * 100).toFixed(1)}% failure rate compared to ${otherName}'s ${(otherRate * 100).toFixed(1)}%.`;
    } else if (confidence > 0.5) {
      return `${saferName} appears more reliable (${(saferRate * 100).toFixed(1)}% vs ${(otherRate * 100).toFixed(1)}% failure rate), though the difference is moderate.`;
    } else {
      return `The configurations are quite similar. ${saferName} has a slightly lower failure rate (${(saferRate * 100).toFixed(1)}% vs ${(otherRate * 100).toFixed(1)}%).`;
    }
  };

  // Generate reasoning
  const getReasoning = (): string[] => {
    const reasons: string[] = [];

    if (!configAStats || !configBStats) {
      return ["No analysis data available yet."];
    }

    // Compare failure rates
    const rateDiff = Math.abs((configAStats.phat - configBStats.phat) * 100);
    if (rateDiff > 5) {
      reasons.push(
        `There's a ${rateDiff.toFixed(1)}% difference in failure rates between the two configurations.`
      );
    }

    // Mention most common failure
    if (mostCommonFailure && mostCommonFailure.failure_mode) {
      const modeName = (mostCommonFailure.failure_mode as string)
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      reasons.push(
        `The most common issue detected is ${modeName}, affecting ${mostCommonFailure.count || 0} out of ${totalFailures} failure events.`
      );
    }

    // Mention total failures
    if (totalFailures > 0) {
      const totalTrials = configAStats.n || configBStats.n || 0;
      const overallRate = totalTrials > 0 ? ((totalFailures / totalTrials) * 100).toFixed(1) : "0";
      reasons.push(`Overall, ${overallRate}% of test runs encountered at least one failure.`);
    } else {
      reasons.push("No failures were detected in this simulation - both configurations performed well!");
    }

    // Configuration differences
    const differences: string[] = [];
    if (configA.context_window !== configB.context_window) {
      differences.push(`context window (${configA.context_window} vs ${configB.context_window} tokens)`);
    }
    if (configA.tools_enabled !== configB.tools_enabled) {
      differences.push(`tools ${configA.tools_enabled ? "enabled" : "disabled"} vs ${configB.tools_enabled ? "enabled" : "disabled"}`);
    }
    if (configA.top_k !== configB.top_k) {
      differences.push(`top-k retrieval (${configA.top_k} vs ${configB.top_k})`);
    }

    if (differences.length > 0) {
      reasons.push(
        `Key differences between configurations: ${differences.join(", ")}. These settings can impact reliability.`
      );
    }

    return reasons.length > 0 ? reasons : ["Analysis complete. Review the detailed charts below for more insights."];
  };

  const summary = getSummary();
  const reasoning = getReasoning();
  const hasFailures = totalFailures > 0;

  return (
    <Card className="py-3 glass-card border-2 border-primary/20">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Lightbulb className="h-3 w-3" />
          Results Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-4">
        {/* Main Summary */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            {hasFailures ? (
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-[#25924d] mt-0.5 shrink-0" />
            )}
            <p className="text-sm leading-relaxed text-foreground">
              {summary}
            </p>
          </div>
        </div>

        {/* Reasoning Section */}
        {reasoning.length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Why This Matters
            </div>
            <ul className="space-y-1.5">
              {reasoning.map((reason, idx) => (
                <li key={idx} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="text-primary mt-1 shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Stats */}
        {configAStats && configBStats && (
          <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Config A Failure Rate
              </div>
              <div className="text-lg font-bold font-mono text-[#95ccf9]">
                {(configAStats.phat * 100).toFixed(1)}%
              </div>
              <div className="text-[9px] text-muted-foreground">
                {configAStats.k} failures out of {configAStats.n} tests
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Config B Failure Rate
              </div>
              <div className="text-lg font-bold font-mono text-[#25924d]">
                {(configBStats.phat * 100).toFixed(1)}%
              </div>
              <div className="text-[9px] text-muted-foreground">
                {configBStats.k} failures out of {configBStats.n} tests
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

