"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Timeline, BreakPoint } from "@/types/dashboard";

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

function formatTimestamp(ts: string | undefined): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const style =
    severity === "HIGH"
      ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40"
      : severity === "MED"
        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider",
        style
      )}
    >
      {severity}
    </span>
  );
}

function BreakPointRow({
  bp,
  index,
  total,
  configAId,
  configBId,
}: {
  bp: BreakPoint;
  index: number;
  total: number;
  configAId: string;
  configBId: string;
}) {
  const orderLabel = total > 1 ? `${index + 1} of ${total} to break` : "Break point";
  const timeStr = formatTimestamp(bp.timestamp);

  return (
    <li className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-primary font-medium">
          {configLabel(bp.config_id, configAId, configBId)}
        </span>
        <SeverityBadge severity={bp.severity} />
        <span className="text-xs text-muted-foreground">{orderLabel}</span>
        {timeStr && (
          <span className="text-xs text-muted-foreground font-mono ml-auto">{timeStr}</span>
        )}
      </div>
      <div className="text-sm text-foreground leading-relaxed">
        First high-severity failure at prompt{" "}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{bp.prompt_id}</code> —{" "}
        <span className="font-medium">{formatFailureMode(bp.failure_mode)}</span>
      </div>
      {bp.breaks_at && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Breaks at: {bp.breaks_at}
        </p>
      )}
    </li>
  );
}

export function BreakFirstTimeline({ timeline, configAId, configBId }: BreakFirstTimelineProps) {
  const breakPoints = timeline?.break_points ?? [];
  const configs = timeline?.configs ?? {};
  const sortedBreakPoints = [...breakPoints].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const eventCountA = configs[configAId]?.length ?? 0;
  const eventCountB = configs[configBId]?.length ?? 0;

  if (breakPoints.length === 0) {
    return (
      <Card className="py-3 glass-card">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle flex items-center gap-2 leading-tight">
            <Clock className="h-4 w-4" />
            Break-first timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            No break points in this run. Run a simulation to see when each config first hit a high-severity failure.
          </p>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              A &quot;break point&quot; is the first <strong>HIGH</strong> severity failure per config. It indicates
              when that configuration would first fail in a production-like scenario.
            </span>
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
      <CardContent className="px-4 pb-4 pt-0 space-y-4">
        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground leading-tight mb-1">What this shows</p>
            <p className="leading-relaxed">
              When each config first hit a <strong>HIGH</strong> severity failure, in chronological order.
              The first row is the config that &quot;broke&quot; first in the run.
            </p>
          </div>
        </div>

        <ul className="space-y-3">
          {sortedBreakPoints.map((bp, idx) => (
            <BreakPointRow
              key={`${bp.config_id}-${bp.prompt_id}-${idx}`}
              bp={bp}
              index={idx}
              total={sortedBreakPoints.length}
              configAId={configAId}
              configBId={configBId}
            />
          ))}
        </ul>

        {(eventCountA > 0 || eventCountB > 0) && (
          <div className="pt-2 border-t border-border text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Total failure events in this run</p>
            <p className="leading-relaxed">
              Config A: <strong>{eventCountA}</strong> event{eventCountA !== 1 ? "s" : ""}
              {" · "}
              Config B: <strong>{eventCountB}</strong> event{eventCountB !== 1 ? "s" : ""}
              {" "}
              (all severities; break points above are first HIGH per config).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
