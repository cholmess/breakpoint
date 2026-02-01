"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import type { Timeline } from "@/types/dashboard";

interface BreakFirstTimelineProps {
  timeline: Timeline | null;
  configAId: string;
  configBId: string;
}

function formatFailureMode(mode: string): string {
  return mode
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function configLabel(configId: string, configAId: string, configBId: string): string {
  return configId === configAId ? "Config A" : configId === configBId ? "Config B" : configId;
}

export function BreakFirstTimeline({ timeline, configAId, configBId }: BreakFirstTimelineProps) {
  const breakPoints = timeline?.break_points ?? [];

  if (breakPoints.length === 0) {
    return (
      <Card className="py-3 glass-card">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle flex items-center gap-2 leading-tight">
            <Clock className="h-4 w-4" />
            Break-first timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            No break points in this run. Run a simulation to see when each config first hit a high-severity failure.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-3 glass-card">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle flex items-center gap-2 leading-tight">
          <Clock className="h-4 w-4" />
          Break-first timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <ul className="space-y-2">
          {breakPoints.map((bp, idx) => (
            <li
              key={`${bp.config_id}-${bp.prompt_id}-${idx}`}
              className="text-sm leading-relaxed flex items-start gap-2"
            >
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span className="text-foreground">
                <strong>{configLabel(bp.config_id, configAId, configBId)}</strong> broke at prompt{" "}
                <code className="text-xs bg-muted px-1 rounded font-mono">{bp.prompt_id}</code> (
                {formatFailureMode(bp.failure_mode)})
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
