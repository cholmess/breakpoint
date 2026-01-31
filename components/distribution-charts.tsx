"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import type { DistributionsData } from "@/types/dashboard";

interface DistributionChartsProps {
  byFailureMode: DistributionsData["by_failure_mode"];
  byPromptFamily: DistributionsData["by_prompt_family"];
}

// Color mapping for failure modes
const getFailureModeColor = (mode: string): string => {
  const colors: Record<string, string> = {
    context_overflow: "#ef4444", // red
    silent_truncation_risk: "#f59e0b", // amber
    latency_breach: "#f97316", // orange
    cost_runaway: "#dc2626", // dark red
    tool_timeout_risk: "#b91c1c", // darker red
    retrieval_noise_risk: "#eab308", // yellow
  };
  return colors[mode] || "#6b7280"; // gray default
};

// Format failure mode name for display
const formatFailureMode = (mode: string): string => {
  return mode
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function DistributionCharts({
  byFailureMode,
  byPromptFamily,
}: DistributionChartsProps) {
  // Transform failure mode data for chart
  const failureModeData = Object.values(byFailureMode)
    .map((entry) => ({
      name: formatFailureMode(entry.failure_mode),
      count: entry.count,
      proportion: (entry.proportion * 100).toFixed(1),
      rawName: entry.failure_mode,
    }))
    .sort((a, b) => b.count - a.count);

  // Transform prompt family data for chart
  const promptFamilyData = Object.values(byPromptFamily)
    .map((entry) => ({
      name: entry.family.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      count: entry.count,
      proportion: (entry.proportion * 100).toFixed(1),
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Failure Mode Distribution */}
      <Card className="py-3 glass-card">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Failure Mode Distribution
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            Which types of problems occurred most often during testing.
          </p>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-[180px]">
            {failureModeData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                No failure data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={failureModeData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 8 }}
                    stroke="var(--muted-foreground)"
                    angle={-45}
                    textAnchor="end"
                    height={60}
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
                    formatter={(value: number | undefined, name: string | undefined) => {
                      if (name === "count") return [value ?? 0, "Count"];
                      if (name === "proportion") return [`${value ?? 0}%`, "Proportion"];
                      return [value ?? 0, name ?? ""];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "10px" }}
                    iconSize={8}
                  />
                  <Bar dataKey="count" name="Count" radius={[2, 2, 0, 0]}>
                    {failureModeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getFailureModeColor(entry.rawName)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prompt Family Distribution */}
      <Card className="py-3 glass-card">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Prompt Family Distribution
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            Which types of prompts triggered the most failures.
          </p>
        </CardHeader>
        <CardContent className="p-2">
          <div className="h-[180px]">
            {promptFamilyData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                No prompt family data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={promptFamilyData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 8 }}
                    stroke="var(--muted-foreground)"
                    angle={-45}
                    textAnchor="end"
                    height={60}
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
                    formatter={(value: number | undefined, name: string | undefined) => {
                      if (name === "count") return [value ?? 0, "Count"];
                      if (name === "proportion") return [`${value ?? 0}%`, "Proportion"];
                      return [value ?? 0, name ?? ""];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "10px" }}
                    iconSize={8}
                  />
                  <Bar
                    dataKey="count"
                    name="Count"
                    fill="#95ccf9"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
