"use client";

import { useState, useCallback, useEffect } from "react";
import { FlipCard } from "@/components/flip-card";
import { TrafficLight } from "@/components/traffic-light";
import { ProbabilityCard } from "@/components/probability-card";
import { DistributionCharts } from "@/components/distribution-charts";
import { FailureBreakdown } from "@/components/failure-breakdown";
import { ConfidenceBand } from "@/components/confidence-band";
import { OrbTrail } from "@/components/orb-trail";
import { ResultsSummary } from "@/components/results-summary";
import { Activity, Zap, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const [status, setStatus] = useState<"idle" | "running" | "success" | "failure">("idle");
  
  // Data from API
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [comparisonsData, setComparisonsData] = useState<ComparisonsData | null>(null);
  const [distributionsData, setDistributionsData] = useState<DistributionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

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
    setProgress(0);
    
    // Estimate progress based on typical probe count (200 prompts x 2 configs = 400 probes)
    // Show estimated time: ~30 seconds for 400 probes
    const estimatedProbes = 400;
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Simulate progress up to 90%, then wait for actual completion
        if (prev < 90) {
          return prev + 2; // Increment by 2% every ~600ms
        }
        return prev;
      });
    }, 600);
    
    try {
      const response = await fetch("/api/run-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configA,
          configB,
          promptFamily: "all",
          seed: 42,
        }),
      });
      
      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Simulation failed");
      }

      setAnalysisData(data.analysis);
      setComparisonsData(data.comparisons);
      setDistributionsData(data.distributions);
      setStatus("success");
    } catch (err) {
      clearInterval(progressInterval);
      console.error("Simulation failed:", err);
      setError(err instanceof Error ? err.message : "Simulation failed");
      setStatus("failure");
    }
  }, [configA, configB]);

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
              <h1 className="text-2xl font-bold tracking-tight neon-text-subtle leading-tight">
                BreakPoint
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI Observability Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 border border-[#25924d]/30 text-sm">
              <Zap className="h-4 w-4 text-[#25924d]" />
              <span className="font-medium text-[#25924d]">A/B Testing Mode</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - Config & Controls */}
          <div className="col-span-4 space-y-4 sticky top-24 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            <FlipCard
              configA={configA}
              configB={configB}
              onConfigAChange={setConfigA}
              onConfigBChange={setConfigB}
            />
            <Card className="py-3 glass-card">
              <CardContent className="p-4">
                <Button
                  onClick={runSimulation}
                  disabled={status === "running"}
                  className="w-full bg-[#25924d] hover:bg-[#25924d]/90 text-white"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {status === "running" ? "Running Simulation..." : "Run Simulation"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Traffic Light & Probability */}
          <div className="col-span-1 flex flex-col items-center pt-4">
            <TrafficLight status={status} />
          </div>

          {/* Right Column - Results */}
          <div className="col-span-7 space-y-4">
            {loading ? (
              <div className="text-center py-8 text-base text-muted-foreground leading-relaxed">
                Loading analysis data...
              </div>
            ) : status === "running" ? (
              <div className="text-center py-8 space-y-4">
                <div className="text-base text-muted-foreground mb-4 leading-relaxed">
                  Running simulation... (est. 30s for ~400 probes)
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#25924d] h-2 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">{progress}%</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-base font-medium text-destructive leading-relaxed">{error}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Please check your configuration and try again.
                </div>
              </div>
            ) : !comparisonsData || comparisonsData.comparisons.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-base text-muted-foreground leading-relaxed">
                  No comparisons yet. Run a simulation to see results.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Configure Config A and Config B, then click "Run Simulation".
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Row 1: Results Summary */}
                <ResultsSummary
                  analysisData={analysisData}
                  comparisonsData={comparisonsData}
                  distributionsData={distributionsData}
                  configA={configA}
                  configB={configB}
                />
                
                {/* Row 2: Probability Card and Confidence Band side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <ProbabilityCard
                    comparisons={comparisonsData?.comparisons || []}
                    selectedConfigA={configA.id}
                    selectedConfigB={configB.id}
                    isRunning={status === "running"}
                  />
                  {analysisData && (
                    <ConfidenceBand analysisData={analysisData} />
                  )}
                </div>
                
                {/* Row 3: Failure Mode Distribution */}
                <DistributionCharts
                  byFailureMode={distributionsData?.by_failure_mode || {}}
                  byPromptFamily={distributionsData?.by_prompt_family || {}}
                  type="failure-mode"
                />
                
                {/* Row 4: Prompt Family Distribution */}
                <DistributionCharts
                  byFailureMode={distributionsData?.by_failure_mode || {}}
                  byPromptFamily={distributionsData?.by_prompt_family || {}}
                  type="prompt-family"
                />
                
                <FailureBreakdown 
                  byFailureMode={distributionsData?.by_failure_mode || {}}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
