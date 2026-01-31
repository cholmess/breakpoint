"use client";

import { useState, useCallback, useEffect } from "react";
import { FlipCard } from "@/components/flip-card";
import { TrafficLight } from "@/components/traffic-light";
import { ProbabilityCard } from "@/components/probability-card";
import { DistributionCharts } from "@/components/distribution-charts";
import { FailureBreakdown } from "@/components/failure-breakdown";
import { PromptSelector } from "@/components/prompt-selector";
import { ConfidenceBand } from "@/components/confidence-band";
import { OrbTrail } from "@/components/orb-trail";
import { Activity, Zap } from "lucide-react";
import type { AnalysisData, ComparisonsData, DistributionsData, Config } from "@/types/dashboard";

// Default configs matching the schema
const defaultConfigA: Config = {
  id: "config-a",
  model: "gpt-4",
  context_window: 8192,
  top_k: 10,
  chunk_size: 512,
  max_output_tokens: 2048,
  tools_enabled: true,
  temperature: 0.7,
  cost_per_1k_tokens: 0.03,
};

const defaultConfigB: Config = {
  id: "config-b",
  model: "gpt-4",
  context_window: 16384,
  top_k: 4,
  chunk_size: 1024,
  max_output_tokens: 4096,
  tools_enabled: false,
  temperature: 0.5,
  cost_per_1k_tokens: 0.03,
};

export default function Dashboard() {
  const [configA, setConfigA] = useState<Config>(defaultConfigA);
  const [configB, setConfigB] = useState<Config>(defaultConfigB);
  const [selectedPrompt, setSelectedPrompt] = useState("long-context");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "failure">("idle");
  
  // Data from API
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [comparisonsData, setComparisonsData] = useState<ComparisonsData | null>(null);
  const [distributionsData, setDistributionsData] = useState<DistributionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from API routes
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        const [analysis, comparisons, distributions] = await Promise.all([
          fetch('/api/analysis').then(r => r.json()),
          fetch('/api/comparisons').then(r => r.json()),
          fetch('/api/distributions').then(r => r.json()),
        ]);
        
        setAnalysisData(analysis);
        setComparisonsData(comparisons);
        setDistributionsData(distributions);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load analysis data');
        // Set empty defaults
        setAnalysisData({ configs: {} });
        setComparisonsData({ comparisons: [] });
        setDistributionsData({ by_failure_mode: {}, by_prompt_family: {} });
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  const runSimulation = useCallback(async () => {
    setStatus("running");
    setError(null);
    try {
      const response = await fetch("/api/run-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configA,
          configB,
          promptFamily: selectedPrompt,
          seed: 42,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Simulation failed");
      }

      setAnalysisData(data.analysis);
      setComparisonsData(data.comparisons);
      setDistributionsData(data.distributions);
      setStatus("success");
    } catch (err) {
      console.error("Simulation failed:", err);
      setError(err instanceof Error ? err.message : "Simulation failed");
      setStatus("failure");
    }
  }, [configA, configB, selectedPrompt]);

  return (
    <div className="min-h-screen gradient-mesh">
      <OrbTrail />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 glass-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-black border border-zinc-800">
              <Activity className="h-4 w-4 text-[#99e4f2]" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight neon-text-subtle">
                Probabilistic Failure Simulator
              </h1>
              <p className="text-[10px] text-muted-foreground">
                AI Observability Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 border border-[#25924d]/30 text-xs">
              <Zap className="h-3 w-3 text-[#25924d]" />
              <span className="font-medium text-[#25924d]">A/B Testing Mode</span>
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
            {loading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Loading analysis data...
              </div>
            ) : error ? (
              <div className="text-center py-8 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <>
                <ProbabilityCard
                  comparisons={comparisonsData?.comparisons || []}
                  selectedConfigA={configA.id}
                  selectedConfigB={configB.id}
                  isRunning={status === "running"}
                />
                {analysisData && (
                  <ConfidenceBand analysisData={analysisData} />
                )}
                <DistributionCharts
                  byFailureMode={distributionsData?.by_failure_mode || {}}
                  byPromptFamily={distributionsData?.by_prompt_family || {}}
                />
                <FailureBreakdown 
                  byFailureMode={distributionsData?.by_failure_mode || {}}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
