"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { AnalysisData } from "@/types/dashboard";

interface ConfidenceBandProps {
  analysisData: AnalysisData;
}

export function ConfidenceBand({ analysisData }: ConfidenceBandProps) {
  const configs = Object.values(analysisData.configs);

  if (configs.length === 0) {
    return (
      <Card className="py-3">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Failure Rate Comparison
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            Shows how often each configuration fails, with uncertainty ranges. Lower is better.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground text-center py-4">
            No analysis data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for chart
  const chartData = configs.map((config) => {
    const ci = config.ci_bootstrap || config.ci_bayesian;
    return {
      config: config.config_id,
      phat: config.phat * 100, // Convert to percentage
      lower: ci ? ci[0] * 100 : config.phat * 100,
      upper: ci ? ci[1] * 100 : config.phat * 100,
      k: config.k,
      n: config.n,
    };
  });

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-md p-3 shadow-lg">
          <p className="text-base font-semibold mb-2 leading-relaxed">Config {data.config}</p>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            Failure Rate: <span className="font-mono font-semibold text-foreground">{data.phat.toFixed(2)}%</span>
          </p>
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            CI: <span className="font-mono text-foreground">{data.lower.toFixed(2)}% - {data.upper.toFixed(2)}%</span>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Events: <span className="font-mono text-foreground">{data.k}/{data.n}</span>
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
          Failure Rate with Confidence Intervals
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                tick={{ fontSize: 12 }}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="var(--muted-foreground)"
                width={45}
                label={{ 
                  value: 'Failure Rate (%)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: '12px', textAnchor: 'middle' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="2 2" />
              
              {/* Confidence interval area (using error bars) */}
              {chartData.map((entry, index) => (
                <g key={`ci-${index}`}>
                  {/* Lower bound line */}
                  <line
                    x1={index * (100 / chartData.length) + 5}
                    x2={index * (100 / chartData.length) + 5}
                    y1={((entry.lower / 100) * 200)}
                    y2={((entry.upper / 100) * 200)}
                    stroke="var(--muted-foreground)"
                    strokeWidth={2}
                    opacity={0.3}
                  />
                  {/* Upper and lower ticks */}
                  <line
                    x1={index * (100 / chartData.length) + 2}
                    x2={index * (100 / chartData.length) + 8}
                    y1={((entry.lower / 100) * 200)}
                    y2={((entry.lower / 100) * 200)}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={index * (100 / chartData.length) + 2}
                    x2={index * (100 / chartData.length) + 8}
                    y1={((entry.upper / 100) * 200)}
                    y2={((entry.upper / 100) * 200)}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.5}
                  />
                </g>
              ))}
              
              {/* Failure rate line */}
              <Line
                type="monotone"
                dataKey="phat"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ fill: "var(--primary)", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-primary" />
            <span>Failure Rate (p̂)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 border-t border-b border-muted-foreground" />
            <span>95% CI</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

