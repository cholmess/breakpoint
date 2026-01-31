"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

interface DistributionChartsProps {
  latencyData: { name: string; configA: number; configB: number }[];
  tokenData: { name: string; configA: number; configB: number }[];
}

export function DistributionCharts({
  latencyData,
  tokenData,
}: DistributionChartsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Latency Distribution */}
      <Card className="py-3">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Latency Distribution (ms)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={latencyData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 9 }}
                  stroke="var(--muted-foreground)"
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: "10px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "10px" }}
                  iconSize={8}
                />
                <Area
                  type="monotone"
                  dataKey="configA"
                  name="Config A"
                  stroke="var(--accent)"
                  fill="var(--accent)"
                  fillOpacity={0.3}
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="configB"
                  name="Config B"
                  stroke="var(--emerald)"
                  fill="var(--emerald)"
                  fillOpacity={0.3}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Token Distribution */}
      <Card className="py-3">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Token Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tokenData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 9 }}
                  stroke="var(--muted-foreground)"
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: "10px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "10px" }}
                  iconSize={8}
                />
                <Bar
                  dataKey="configA"
                  name="Config A"
                  fill="var(--accent)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="configB"
                  name="Config B"
                  fill="var(--emerald)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
