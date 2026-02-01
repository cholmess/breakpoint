"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FlipCard } from "@/components/flip-card";
import { TrafficLight } from "@/components/traffic-light";
import { ProbabilityCard } from "@/components/probability-card";
import { DistributionCharts } from "@/components/distribution-charts";
import { FailureBreakdown } from "@/components/failure-breakdown";
import { ConfidenceBand } from "@/components/confidence-band";
import dynamic from "next/dynamic";

const OrbTrail = dynamic(() => import("@/components/orb-trail").then(mod => ({ default: mod.OrbTrail })), {
  ssr: false,
});
import { ResultsSummary } from "@/components/results-summary";
import { RecommendationBanner } from "@/components/recommendation-banner";
import { BreakFirstTimeline } from "@/components/break-first-timeline";
import { Activity, Zap, Play, HelpCircle, Download, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { exportReportAsPdf } from "@/lib/export-report";
import type { AnalysisData, ComparisonsData, DistributionsData, Config, Timeline } from "@/types/dashboard";

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
  const [runMode, setRunMode] = useState<"simulate" | "real">("simulate");
  const [runSize, setRunSize] = useState<"quick" | "full">("quick");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "failure">("idle");
  
  // Data from API
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [comparisonsData, setComparisonsData] = useState<ComparisonsData | null>(null);
  const [distributionsData, setDistributionsData] = useState<DistributionsData | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Store the configs that were actually used in the last simulation
  const [simulatedConfigA, setSimulatedConfigA] = useState<Config | null>(null);
  const [simulatedConfigB, setSimulatedConfigB] = useState<Config | null>(null);

  // Which API keys are set (for Real API mode warning)
  const [apiKeysCheck, setApiKeysCheck] = useState<{ openai: boolean; gemini: boolean; manus: boolean } | null>(null);

  // Refs to store abort controller and intervals for stopping simulation
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // When Real API is selected, check which keys are set
  useEffect(() => {
    if (runMode !== "real") {
      setApiKeysCheck(null);
      return;
    }
    fetch("/api/check-api-keys")
      .then((r) => r.json())
      .then(setApiKeysCheck)
      .catch(() => setApiKeysCheck(null));
  }, [runMode]);

  // Infer provider from model name (matches server-side logic)
  const providerForModel = (model: string): "openai" | "gemini" | "manus" | null => {
    const m = (model || "").toLowerCase();
    if (m.startsWith("gpt-") || m.startsWith("o1-")) return "openai";
    if (m.startsWith("gemini-")) return "gemini";
    if (m.startsWith("manus-")) return "manus";
    return null;
  };

  const needsOpenai = providerForModel(configA.model) === "openai" || providerForModel(configB.model) === "openai";
  const needsGemini = providerForModel(configA.model) === "gemini" || providerForModel(configB.model) === "gemini";
  const needsManus = providerForModel(configA.model) === "manus" || providerForModel(configB.model) === "manus";
  const missingKey =
    runMode === "real" &&
    apiKeysCheck &&
    ((needsOpenai && !apiKeysCheck.openai) || (needsGemini && !apiKeysCheck.gemini) || (needsManus && !apiKeysCheck.manus));

  // Fetch data from API routes (non-blocking - show page immediately)
  useEffect(() => {
    // Set initial empty state immediately so page renders
    setAnalysisData({ configs: {} });
    setComparisonsData({ comparisons: [] });
    setDistributionsData({ by_failure_mode: {}, by_prompt_family: {} });
    setLoading(false);
    
    // Fetch data in background with timeout
    async function fetchData() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const [analysis, comparisons, distributions] = await Promise.all([
          fetch('/api/analysis', { signal: controller.signal }).then(r => r.json()),
          fetch('/api/comparisons', { signal: controller.signal }).then(r => r.json()),
          fetch('/api/distributions', { signal: controller.signal }).then(r => r.json()),
        ]);
        
        clearTimeout(timeoutId);
        setAnalysisData(analysis);
        setComparisonsData(comparisons);
        setDistributionsData(distributions);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        // Keep empty defaults, don't show error on initial load
      }
    }
    
    // Fetch in background after a short delay
    const timer = setTimeout(fetchData, 100);
    return () => clearTimeout(timer);
  }, []);

  const stopSimulation = useCallback(() => {
    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Clear intervals and timeouts
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    
    // Reset state
    setStatus("idle");
    setProgress(0);
    setError("Simulation stopped by user");
  }, []);

  const runSimulation = useCallback(async () => {
    setStatus("running");
    setError(null);
    setProgress(0);
    
    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Calculate estimated time and increment rate based on mode + run size
    // Quick: 20 prompts × 2 configs = 40 probes. Full: 200 × 2 = 400 probes
    const probeCount = runSize === "quick" ? 40 : 400;
    const estimatedTimeMs =
      runMode === "simulate"
        ? runSize === "quick"
          ? 5000   // 40 probes batched ~5s
          : 20000  // 400 probes ~20s
        : runSize === "quick"
          ? 30000  // 40 probes real ~30s with 20 concurrent
          : 50000; // 400 probes real ~50s with increased concurrency
    const progressCap = 95; // Allow progress up to 95%, then wait for completion
    const updateIntervalMs = 600; // Update every 600ms
    const incrementsToReachCap = (estimatedTimeMs / updateIntervalMs) * (progressCap / 100);
    const incrementPerUpdate = progressCap / incrementsToReachCap;
    
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Increment progress up to cap, then wait for actual completion
        if (prev < progressCap) {
          const next = prev + incrementPerUpdate;
          // Round to 1 decimal place to avoid floating-point precision issues
          const rounded = Math.round(next * 10) / 10;
          return rounded > progressCap ? progressCap : rounded;
        }
        return prev;
      });
    }, updateIntervalMs);
    progressIntervalRef.current = progressInterval;
    
    // Set timeout with buffer (2x estimated time: 40s for simulate, 7min for real)
    const timeoutMs = estimatedTimeMs * 2;
    const timeoutId = setTimeout(() => {
      clearInterval(progressInterval);
      setError(`Request timed out after ${Math.floor(timeoutMs / 1000)}s. Try reducing the number of prompts or check your API keys.`);
      setStatus("idle");
      setProgress(0);
      abortControllerRef.current = null;
      progressIntervalRef.current = null;
      timeoutIdRef.current = null;
    }, timeoutMs);
    timeoutIdRef.current = timeoutId;
    
    try {
      const response = await fetch("/api/run-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configA,
          configB,
          promptFamily: "all",
          runSize,
          seed: 42,
          mode: runMode,
        }),
        signal: abortController.signal,
      });
      
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      abortControllerRef.current = null;
      progressIntervalRef.current = null;
      timeoutIdRef.current = null;
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Simulation failed");
      }

      setAnalysisData(data.analysis);
      setComparisonsData(data.comparisons);
      setDistributionsData(data.distributions);
      setTimeline(data.timeline ?? null);
      // Store the configs that were actually used in this simulation
      setSimulatedConfigA(data.configA || configA);
      setSimulatedConfigB(data.configB || configB);
      setStatus("success");
    } catch (err) {
      // Don't show error if it was aborted by user
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("idle");
        setProgress(0);
        return;
      }
      
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      abortControllerRef.current = null;
      progressIntervalRef.current = null;
      timeoutIdRef.current = null;
      console.error("Simulation failed:", err);
      setError(err instanceof Error ? err.message : "Simulation failed");
      setStatus("failure");
    }
  }, [configA, configB, runMode, runSize]);

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
                AI Observability Tool
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/help">
              <Button
                variant="ghost"
                size="default"
                className="text-base font-bold text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-5 w-5 mr-2" />
                Help! 🦥
              </Button>
            </Link>
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
            {/* Run mode: simulate (default) or real API calls */}
            <Card className="py-1.5 glass-card">
              <CardContent className="p-3">
                <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-2 leading-relaxed">
                  Run Mode
                </div>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setRunMode("simulate")}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border leading-relaxed",
                      runMode === "simulate"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-secondary border-border text-foreground"
                    )}
                  >
                    Simulate
                  </button>
                  <button
                    type="button"
                    onClick={() => setRunMode("real")}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border leading-relaxed",
                      runMode === "real"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-secondary border-border text-foreground"
                    )}
                  >
                    Real API
                  </button>
                </div>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setRunSize("quick")}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border leading-relaxed",
                      runSize === "quick"
                        ? "bg-primary/20 text-primary border-primary/50 dark:bg-primary/10"
                        : "bg-card hover:bg-secondary border-border text-foreground"
                    )}
                  >
                    Quick (20 prompts)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRunSize("full")}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border leading-relaxed",
                      runSize === "full"
                        ? "bg-primary/20 text-primary border-primary/50 dark:bg-primary/10"
                        : "bg-card hover:bg-secondary border-border text-foreground"
                    )}
                  >
                    Full (200 prompts)
                  </button>
                </div>
                {missingKey && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mb-2 leading-relaxed">
                    Missing API key(s) for your selected configs. Copy <code className="text-xs bg-muted px-1 rounded">.env.example</code> to <code className="text-xs bg-muted px-1 rounded">.env</code> in the project root and add the keys. See SETUP.md.
                  </p>
                )}
                <Button
                  onClick={status === "running" ? stopSimulation : runSimulation}
                  disabled={Boolean(missingKey)}
                  className={cn(
                    "w-full text-white",
                    status === "running"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-[#25924d] hover:bg-[#25924d]/90"
                  )}
                >
                  {status === "running" ? (
                    <>
                      <Square className="h-3.5 w-3.5 mr-1.5" />
                      Stop Simulation
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Run Simulation
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Traffic Light & Probability */}
          <div className="col-span-1 flex flex-col items-center pt-4 sticky top-24 self-start">
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
                  {progress >= 95 
                    ? "Finalizing results..." 
                    : `Running simulation... (est. ${
                        runMode === "simulate"
                          ? runSize === "quick" ? "~5s" : "~20s"
                          : runSize === "quick" ? "~30s" : "~50s"
                      } for ~${runSize === "quick" ? "40" : "400"} probes)`
                  }
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#25924d] h-2 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {progress.toFixed(1)}%
                  {progress >= 95 && <span className="ml-2 text-xs">(processing...)</span>}
                </div>
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
                {/* One-sentence recommendation */}
                <RecommendationBanner
                  analysisData={analysisData}
                  comparisonsData={comparisonsData}
                  configA={simulatedConfigA || configA}
                  configB={simulatedConfigB || configB}
                />
                {/* Export report */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card hover:bg-secondary border-border text-foreground hover:text-foreground transition-colors"
                    onClick={() =>
                      exportReportAsPdf(
                        analysisData,
                        comparisonsData,
                        distributionsData,
                        simulatedConfigA || configA,
                        simulatedConfigB || configB
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export report
                  </Button>
                </div>
                {/* Row 1: Results Summary */}
                <ResultsSummary
                  analysisData={analysisData}
                  comparisonsData={comparisonsData}
                  distributionsData={distributionsData}
                  configA={simulatedConfigA || configA}
                  configB={simulatedConfigB || configB}
                />
                
                {/* Row 2: Probability Card and Confidence Band side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <ProbabilityCard
                    comparisons={comparisonsData?.comparisons || []}
                    selectedConfigA={(simulatedConfigA || configA).id}
                    selectedConfigB={(simulatedConfigB || configB).id}
                    isRunning={false}
                  />
                  {analysisData && (
                    <ConfidenceBand analysisData={analysisData} />
                  )}
                </div>

                {/* Break-first timeline */}
                <BreakFirstTimeline
                  timeline={timeline}
                  configAId={(simulatedConfigA || configA).id}
                  configBId={(simulatedConfigB || configB).id}
                />
                
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
