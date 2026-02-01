"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useText } from "@/hooks/use-text";
import type { AnalysisData } from "@/types/dashboard";

interface ConfidenceBandProps {
  analysisData: AnalysisData;
}

export function ConfidenceBand({ analysisData }: ConfidenceBandProps) {
  const { t } = useText();
  const configs = Object.values(analysisData.configs);

  if (configs.length === 0) {
    return (
      <Card className="py-3">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("failure_rate_comparison")}
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            {t("failure_rate_chart_desc")}
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground text-center py-4">
            {t("no_analysis_data")}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prefer Wilson score CI (deterministic, width varies visibly with k and n)
  const chartData = configs.map((config) => {
    const ci = config.ci_wilson ?? config.ci_bootstrap ?? config.ci_bayesian;
    const lower = ci ? ci[0] * 100 : config.phat * 100;
    const upper = ci ? ci[1] * 100 : config.phat * 100;
    return {
      config: config.config_id,
      phat: config.phat * 100,
      lower,
      upper,
      bandHeight: Math.max(0, upper - lower), // for stacked Area: corridor from lower to upper
      k: config.k,
      n: config.n,
    };
  });

  // Data-driven Y domain so CI corridors look visibly different (zoom into data range)
  const maxUpper = Math.max(...chartData.map((d) => d.upper), 0);
  const yDomainMax = Math.max(15, Math.ceil(maxUpper * 1.25));
  const yDomain: [number, number] = [0, yDomainMax];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-md p-3 shadow-lg">
          <p className="text-base font-semibold mb-2 leading-relaxed">{t("config_label")} {data.config}</p>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            {t("tooltip_failure_rate")} <span className="font-mono font-semibold text-foreground">{data.phat.toFixed(2)}%</span>
          </p>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            {t("tooltip_ci")} <span className="font-mono text-foreground">{data.lower.toFixed(2)}% - {data.upper.toFixed(2)}%</span>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("tooltip_events")} <span className="font-mono text-foreground">{data.k}/{data.n}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="py-3">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle leading-tight">
          {t("failure_rate_with_ci")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="config"
                tick={{ fontSize: 14, dy: 8 }}
                stroke="var(--muted-foreground)"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="var(--muted-foreground)"
                width={45}
                domain={yDomain}
                label={{
                  value: t("failure_rate_pct"),
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: "12px", textAnchor: "middle" },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="2 2" />

              {/* Confidence corridor: stacked Area so band = lower..upper */}
              <Area
                type="monotone"
                dataKey="lower"
                stackId="ci"
                fill="transparent"
                stroke="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="bandHeight"
                stackId="ci"
                fill="var(--muted-foreground)"
                fillOpacity={0.25}
                stroke="none"
                isAnimationActive={false}
              />

              {/* Failure rate line on top */}
              <Line
                type="monotone"
                dataKey="phat"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ fill: "var(--primary)", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-primary" />
            <span>{t("failure_rate_phat")}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 border-t border-b border-muted-foreground" />
            <span>{t("ci_95")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

