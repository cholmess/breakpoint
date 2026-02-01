"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useText, type TextKey } from "@/hooks/use-text";
import type { Timeline, BreakPoint } from "@/types/dashboard";

interface BreakFirstTimelineProps {
  timeline: Timeline | null;
  configAId: string;
  configBId: string;
}

function configLabel(
  configId: string,
  configAId: string,
  configBId: string,
  configALabel: string,
  configBLabel: string
): string {
  return configId === configAId ? configALabel : configId === configBId ? configBLabel : configId;
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
  configALabel,
  configBLabel,
  getFailureModeLabel,
  t,
}: {
  bp: BreakPoint;
  index: number;
  total: number;
  configAId: string;
  configBId: string;
  configALabel: string;
  configBLabel: string;
  getFailureModeLabel: (mode: string) => string;
  t: (key: TextKey, params?: Record<string, string | number>) => string;
}) {
  const orderLabel =
    total > 1 ? `${index + 1} ${t("of_to_break", { total: String(total) })}` : t("break_point");
  const timeStr = formatTimestamp(bp.timestamp);

  return (
    <li className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-primary font-medium">
          {configLabel(bp.config_id, configAId, configBId, configALabel, configBLabel)}
        </span>
        <SeverityBadge severity={bp.severity} />
        <span className="text-xs text-muted-foreground">{orderLabel}</span>
        {timeStr && (
          <span className="text-xs text-muted-foreground font-mono ml-auto">{timeStr}</span>
        )}
      </div>
      <div className="text-sm text-foreground leading-relaxed">
        {t("first_high_severity_at")}{" "}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{bp.prompt_id}</code> —{" "}
        <span className="font-medium">{getFailureModeLabel(bp.failure_mode)}</span>
      </div>
      {bp.breaks_at && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("breaks_at")} {bp.breaks_at}
        </p>
      )}
    </li>
  );
}

export function BreakFirstTimeline({ timeline, configAId, configBId }: BreakFirstTimelineProps) {
  const { t, getFailureModeLabel } = useText();
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
            {t("break_first_timeline")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("no_break_points")}
          </p>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{t("break_point_explainer")}</span>
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
          {t("break_first_timeline")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-4">
        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground leading-tight mb-1">{t("what_this_shows")}</p>
            <p className="leading-relaxed">{t("when_first_high")}</p>
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
              configALabel={t("config_a")}
              configBLabel={t("config_b")}
              getFailureModeLabel={getFailureModeLabel}
              t={t}
            />
          ))}
        </ul>

        {(eventCountA > 0 || eventCountB > 0) && (
          <div className="pt-2 border-t border-border text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{t("total_failure_events")}</p>
            <p className="leading-relaxed">
              {t("config_a")}: <strong>{eventCountA}</strong> event{eventCountA !== 1 ? "s" : ""}
              {" · "}
              {t("config_b")}: <strong>{eventCountB}</strong> event{eventCountB !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
