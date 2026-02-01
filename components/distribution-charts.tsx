"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import type { DistributionsData } from "@/types/dashboard";

interface DistributionChartsProps {
  byFailureMode: DistributionsData["by_failure_mode"];
  byPromptFamily: DistributionsData["by_prompt_family"];
  type?: "failure-mode" | "prompt-family" | "both";
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

// Custom tick component for wrapping text
const CustomTick = ({ x, y, payload }: any) => {
  const text = payload.value || '';
  const words = text.split(/(?=[A-Z])|[\s_]/).filter((w: string) => w.length > 0);
  const maxCharsPerLine = 10;
  
  // Split text into lines if needed
  const lines: string[] = [];
  let currentLine = '';
  
  words.forEach((word: string) => {
    const trimmedWord = word.trim();
    if (!trimmedWord) return;
    
    if ((currentLine + trimmedWord).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + trimmedWord;
    } else {
      if (currentLine) lines.push(currentLine);
      // If word is too long, truncate it
      if (trimmedWord.length > maxCharsPerLine) {
        currentLine = trimmedWord.substring(0, maxCharsPerLine - 2) + '..';
      } else {
        currentLine = trimmedWord;
      }
    }
  });
  if (currentLine) lines.push(currentLine);
  
  // Limit to 2 lines max
  const displayLines = lines.slice(0, 2);
  
  return (
    <g transform={`translate(${x},${y})`}>
      {displayLines.map((line, i) => (
        <text
          key={i}
          x={0}
          y={0}
          dy={i * 15 + 12}
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize={11}
          style={{ dominantBaseline: 'hanging' }}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

export function DistributionCharts({
  byFailureMode,
  byPromptFamily,
  type = "both",
}: DistributionChartsProps) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // Transform failure mode data for chart
  const failureModeData = Object.values(byFailureMode)
    .map((entry) => ({
      name: formatFailureMode(entry.failure_mode),
      count: Math.round(entry.count),
      proportion: (entry.proportion * 100).toFixed(1),
      rawName: entry.failure_mode,
    }))
    .sort((a, b) => b.count - a.count);

  // Transform prompt family data for chart
  const promptFamilyData = Object.values(byPromptFamily)
    .map((entry) => ({
      name: entry.family.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      count: Math.round(entry.count),
      proportion: (entry.proportion * 100).toFixed(1),
    }))
    .sort((a, b) => b.count - a.count);

  const showFailureMode = type === "both" || type === "failure-mode";
  const showPromptFamily = type === "both" || type === "prompt-family";

  return (
    <div className={type === "both" ? "grid grid-cols-2 gap-4" : "space-y-4"}>
      {/* Failure Mode Distribution */}
      {showFailureMode && (
      <Card className="py-3 glass-card">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle leading-tight">
            Failure Mode Distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Which types of problems occurred most often during testing.
          </p>
        </CardHeader>
        <CardContent className="p-2 pb-0">
          <div className="h-[400px] [&_.recharts-wrapper]:!bg-transparent [&_.recharts-surface]:!bg-transparent [&_.recharts-bar-rectangle:hover]:!bg-transparent [&_.recharts-tooltip-cursor]:!fill-transparent [&_.recharts-rectangle.recharts-tooltip-cursor]:!fill-transparent [&_.recharts-active-shape]:!fill-transparent">
            {failureModeData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                No failure data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={failureModeData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  barCategoryGap="10%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    tick={CustomTick}
                    height={100}
                    interval={0}
                    tickLine={false}
                    angle={0}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="var(--muted-foreground)"
                    width={40}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      color: "white",
                    }}
                    itemStyle={{
                      color: "white",
                      fontSize: "13px",
                    }}
                    labelStyle={{
                      color: "white",
                      fontSize: "13px",
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => {
                      if (name === "count") return [Math.round(value ?? 0), "Count"];
                      if (name === "proportion") return [`${value ?? 0}%`, "Proportion"];
                      return [Math.round(value ?? 0), name ?? ""];
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar 
                    dataKey="count" 
                    name="Count" 
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                    onMouseEnter={(data, index) => {
                      if (index !== undefined) {
                        setHoveredBar(`failure-${index}`);
                      }
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {failureModeData.map((entry, index) => {
                      const baseColor = getFailureModeColor(entry.rawName);
                      const isHovered = hoveredBar === `failure-${index}`;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={baseColor}
                          style={{
                            filter: isHovered ? 'brightness(1.2) saturate(1.3)' : 'none',
                            transition: 'filter 0.2s ease-in-out',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                          }}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Prompt Family Distribution */}
      {showPromptFamily && (
      <Card className="py-3 glass-card">
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-lg font-bold uppercase tracking-wider neon-text-subtle leading-tight">
            Prompt Family Distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Which types of prompts triggered the most failures.
          </p>
        </CardHeader>
        <CardContent className="p-2 pb-0">
          <div className="h-[400px] [&_.recharts-wrapper]:!bg-transparent [&_.recharts-surface]:!bg-transparent [&_.recharts-bar-rectangle:hover]:!bg-transparent [&_.recharts-tooltip-cursor]:!fill-transparent [&_.recharts-rectangle.recharts-tooltip-cursor]:!fill-transparent [&_.recharts-active-shape]:!fill-transparent">
            {promptFamilyData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                No prompt family data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={promptFamilyData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  barCategoryGap="10%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    tick={CustomTick}
                    height={100}
                    interval={0}
                    tickLine={false}
                    angle={0}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="var(--muted-foreground)"
                    width={40}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      color: "white",
                    }}
                    itemStyle={{
                      color: "white",
                      fontSize: "13px",
                    }}
                    labelStyle={{
                      color: "white",
                      fontSize: "13px",
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => {
                      if (name === "count") return [Math.round(value ?? 0), "Count"];
                      if (name === "proportion") return [`${value ?? 0}%`, "Proportion"];
                      return [Math.round(value ?? 0), name ?? ""];
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar
                    dataKey="count"
                    name="Count"
                    fill="#95ccf9"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                    onMouseEnter={(data, index) => {
                      if (index !== undefined) {
                        setHoveredBar(`prompt-${index}`);
                      }
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {promptFamilyData.map((entry, index) => {
                      const isHovered = hoveredBar === `prompt-${index}`;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill="#95ccf9"
                          style={{
                            filter: isHovered ? 'brightness(1.2) saturate(1.3)' : 'none',
                            transition: 'filter 0.2s ease-in-out',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                          }}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
