"use client";

import { useState, useCallback } from "react";
import { FlipCard } from "@/components/flip-card";
import { TrafficLight } from "@/components/traffic-light";
import { ProbabilityCard } from "@/components/probability-card";
import { DistributionCharts } from "@/components/distribution-charts";
import { FailureBreakdown } from "@/components/failure-breakdown";
import { PromptSelector } from "@/components/prompt-selector";
import { Activity, Zap } from "lucide-react";

const defaultConfigA = {
  temperature: 0.7,
  topK: 40,
  contextWindow: 4096,
  chunkSize: 512,
  maxOutputTokens: 2048,
  toolsEnabled: true,
  budgetCost: 2.5,
};

const defaultConfigB = {
  temperature: 0.3,
  topK: 20,
  contextWindow: 8192,
  chunkSize: 256,
  maxOutputTokens: 4096,
  toolsEnabled: false,
  budgetCost: 1.8,
};

const mockLatencyData = [
  { name: "p10", configA: 120, configB: 95 },
  { name: "p25", configA: 180, configB: 140 },
  { name: "p50", configA: 250, configB: 195 },
  { name: "p75", configA: 380, configB: 290 },
  { name: "p90", configA: 520, configB: 420 },
  { name: "p99", configA: 850, configB: 680 },
];

const mockTokenData = [
  { name: "0-500", configA: 150, configB: 180 },
  { name: "500-1k", configA: 280, configB: 320 },
  { name: "1k-2k", configA: 220, configB: 250 },
  { name: "2k-3k", configA: 120, configB: 140 },
  { name: "3k-4k", configA: 60, configB: 80 },
  { name: "4k+", configA: 20, configB: 30 },
];

const mockFailures = [
  {
    mode: "Context Overflow",
    severity: "high" as const,
    description:
      "Config A exceeds context limit at 15% of test cases, causing truncation artifacts",
  },
  {
    mode: "Hallucination Rate",
    severity: "medium" as const,
    description:
      "Higher temperature in A correlates with 23% increased hallucination frequency",
  },
  {
    mode: "Tool Call Errors",
    severity: "low" as const,
    description:
      "Config B shows 8% fewer tool invocation failures due to disabled tools",
  },
];

export default function Dashboard() {
  const [configA, setConfigA] = useState(defaultConfigA);
  const [configB, setConfigB] = useState(defaultConfigB);
  const [selectedPrompt, setSelectedPrompt] = useState("long-context");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "failure">("idle");
  const [probability, setProbability] = useState(67.3);
  const [reasoning, setReasoning] = useState(
    "Based on Monte Carlo simulation with 10,000 iterations, Config B demonstrates superior stability. Lower temperature reduces output variance by 34%. Reduced context window minimizes memory pressure while chunk size optimization improves throughput by 18%. Budget efficiency increased by 28% with comparable quality metrics. Risk of catastrophic failure reduced from 4.2% to 1.1%."
  );

  const runSimulation = useCallback(() => {
    setStatus("running");

    // Simulate processing
    setTimeout(() => {
      const newProbability = 50 + Math.random() * 45;
      setProbability(newProbability);
      setStatus(newProbability >= 50 ? "success" : "failure");

      const newReasoning =
        newProbability >= 50
          ? `Config B shows ${(newProbability - 50).toFixed(1)}% safety improvement. Temperature differential of ${(configA.temperature - configB.temperature).toFixed(1)} reduces variance. Context window ratio ${(configB.contextWindow / configA.contextWindow).toFixed(1)}x provides ${configB.contextWindow > configA.contextWindow ? "extended" : "focused"} processing capacity. Projected cost savings: $${((configA.budgetCost - configB.budgetCost) * 10).toFixed(2)}/10M tokens.`
          : `Warning: Config B shows ${(50 - newProbability).toFixed(1)}% higher failure risk. Temperature setting may be too conservative for ${selectedPrompt} workload. Consider adjusting Top-K from ${configB.topK} to ${Math.min(configB.topK + 15, 100)} for improved coverage.`;

      setReasoning(newReasoning);
    }, 2000);
  }, [configA, configB, selectedPrompt]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-primary">
              <Activity className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">
                Probabilistic Failure Simulator
              </h1>
              <p className="text-[10px] text-muted-foreground">
                AI Observability Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-xs">
              <Zap className="h-3 w-3 text-emerald" />
              <span className="font-medium">A/B Testing Mode</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - Config & Controls */}
          <div className="col-span-4 space-y-4">
            <FlipCard
              configA={configA}
              configB={configB}
              onConfigAChange={setConfigA}
              onConfigBChange={setConfigB}
            />
            <PromptSelector
              selected={selectedPrompt}
              onSelect={setSelectedPrompt}
              onRunSimulation={runSimulation}
              isRunning={status === "running"}
            />
          </div>

          {/* Middle Column - Traffic Light & Probability */}
          <div className="col-span-1 flex flex-col items-center pt-4">
            <TrafficLight status={status} />
          </div>

          {/* Right Column - Results */}
          <div className="col-span-7 space-y-4">
            <ProbabilityCard
              probability={probability}
              isRunning={status === "running"}
            />
            <DistributionCharts
              latencyData={mockLatencyData}
              tokenData={mockTokenData}
            />
            <FailureBreakdown failures={mockFailures} reasoning={reasoning} />
          </div>
        </div>
      </main>
    </div>
  );
}
