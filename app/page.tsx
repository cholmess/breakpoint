"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FlipCard } from "@/components/flip-card";
import { TrafficLight } from "@/components/traffic-light";
import { ProbabilityCard } from "@/components/probability-card";
import { DistributionCharts } from "@/components/distribution-charts";
import { FailureBreakdown } from "@/components/failure-breakdown";
import { ConfidenceBand } from "@/components/confidence-band";
import { FailureHotspotMatrix } from "@/components/failure-hotspot-matrix";
import { WhatIfPromptChecker } from "@/components/what-if-prompt-checker";
import dynamic from "next/dynamic";

const OrbTrail = dynamic(() => import("@/components/orb-trail").then(mod => ({ default: mod.OrbTrail })), {
  ssr: false,
});
import { ResultsSummary } from "@/components/results-summary";
import { RecommendationBanner } from "@/components/recommendation-banner";
import { BreakFirstTimeline } from "@/components/break-first-timeline";
import { Activity, Zap, Play, HelpCircle, Download, Square, Compass, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { exportReportAsPdf } from "@/lib/export-report";
import { startDashboardTour } from "@/lib/dashboard-tour";
import { saveBaseline, loadBaseline, clearBaseline } from "@/lib/baseline";
import { BaselineComparisonBanner } from "@/components/baseline-comparison-banner";
import type { AnalysisData, ComparisonsData, DistributionsData, Config, Timeline, Baseline, CostBand, CostMultiplierKey, LatencyMultiplierKey } from "@/types/dashboard";

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
  // Streaming: live probe log and per-probe outcomes (filled on "done")
  const [streamLog, setStreamLog] = useState<Array<{ index: number; total: number; config_id: string; prompt_id: string; family: string; use_case: string }>>([]);
  const [probeOutcomes, setProbeOutcomes] = useState<Array<{ config_id: string; prompt_id: string; failure_modes: string[] }> | null>(null);

  // Store the configs that were actually used in the last simulation
  const [simulatedConfigA, setSimulatedConfigA] = useState<Config | null>(null);
  const [simulatedConfigB, setSimulatedConfigB] = useState<Config | null>(null);
  // Once configs are edited after a run, results stay hidden until the user runs again (even if they slide back)
  const [configsEditedSinceRun, setConfigsEditedSinceRun] = useState(false);

  // Cost vs reliability: precomputed bands (cost × latency tolerance) from last run
  const [costBands, setCostBands] = useState<Record<string, CostBand> | null>(null);
  const [costMultiplier, setCostMultiplier] = useState<CostMultiplierKey>("1");
  const [latencyMultiplier, setLatencyMultiplier] = useState<LatencyMultiplierKey>("1");

  // Baseline (saved run for comparison) — load from localStorage on mount
  const [baseline, setBaselineState] = useState<Baseline | null>(null);
  useEffect(() => {
    setBaselineState(loadBaseline());
  }, []);

  const setBaseline = useCallback((value: Baseline | null) => {
    setBaselineState(value);
    if (value === null) clearBaseline();
  }, []);

  // Which API keys are set (for Real API mode warning)
  const [apiKeysCheck, setApiKeysCheck] = useState<{ openai: boolean; gemini: boolean; manus: boolean } | null>(null);

  // Refs to store abort controller and intervals for stopping simulation
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const streamLogEndRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-scroll stream log to bottom when new entries arrive
  useEffect(() => {
    streamLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamLog]);

  // Mark that configs were edited after a run so we hide results until the next run
  useEffect(() => {
    if (simulatedConfigA == null || simulatedConfigB == null) return;
    const differ =
      JSON.stringify(configA) !== JSON.stringify(simulatedConfigA) ||
      JSON.stringify(configB) !== JSON.stringify(simulatedConfigB);
    if (differ) setConfigsEditedSinceRun(true);
  }, [configA, configB, simulatedConfigA, simulatedConfigB]);

  // Infer provider from model name (matches server-side logic)
  const providerForModel = (model: string): "openai" | "gemini" | "manus" | null => {
    const m = (model || "").toLowerCase();
    if (m.startsWith("gpt-") || m.startsWith("o1")) return "openai";
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

  const configAProvider = providerForModel(configA.model);
  const canUseRealApiForConfigA =
    runMode !== "real" ||
    !apiKeysCheck ||
    (configAProvider === "openai" && apiKeysCheck.openai) ||
    (configAProvider === "gemini" && apiKeysCheck.gemini) ||
    (configAProvider === "manus" && apiKeysCheck.manus);

  // Fetch data from API routes (non-blocking - show page immediately)
  useEffect(() => {
    // Set initial empty state immediately so page renders
    setAnalysisData({ configs: {} });
    setComparisonsData({ comparisons: [] });
    setDistributionsData({ by_failure_mode: {}, by_prompt_family: {}, hotspot_matrix: [] });
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
    
    setStreamLog([]);
    setProbeOutcomes(null);
    setStatus("idle");
    setProgress(0);
    setError("Simulation stopped by user");
  }, []);

  const runSimulation = useCallback(async () => {
    setStatus("running");
    setError(null);
    setProgress(0);
    setStreamLog([]);
    setProbeOutcomes(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const estimatedTimeMs =
      runMode === "simulate"
        ? runSize === "quick" ? 5000 : 20000
        : runSize === "quick" ? 30000 : 50000;
    const timeoutMs = estimatedTimeMs * 2;
    const timeoutId = setTimeout(() => {
      abortController.abort();
      setError(`Request timed out after ${Math.floor(timeoutMs / 1000)}s. Try reducing the number of prompts or check your API keys.`);
      setStatus("idle");
      setProgress(0);
      abortControllerRef.current = null;
      timeoutIdRef.current = null;
    }, timeoutMs);
    timeoutIdRef.current = timeoutId;

    try {
      const response = await fetch("/api/run-simulation/stream", {
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

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message ?? data.error ?? "Simulation failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let receivedDone = false;

      const processBuffer = (): boolean => {
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim().replace(/^data:\s*/, "");
          if (!line) continue;
          try {
            const msg = JSON.parse(line) as { type: string; index?: number; total?: number; config_id?: string; prompt_id?: string; family?: string; use_case?: string; message?: string; analysis?: AnalysisData; comparisons?: ComparisonsData; distributions?: DistributionsData; timeline?: Timeline | null; configA?: Config; configB?: Config; costBands?: Record<string, CostBand>; probeOutcomes?: Array<{ config_id: string; prompt_id: string; failure_modes: string[] }> };
            if (msg.type === "probe" && msg.index != null && msg.total != null && msg.config_id != null && msg.prompt_id != null) {
              setStreamLog((prev) => [...prev, { index: msg.index!, total: msg.total!, config_id: msg.config_id!, prompt_id: msg.prompt_id!, family: msg.family ?? "", use_case: msg.use_case ?? "" }]);
              setProgress((msg.index! / msg.total!) * 100);
            } else if (msg.type === "done") {
              receivedDone = true;
              clearTimeout(timeoutId);
              timeoutIdRef.current = null;
              abortControllerRef.current = null;
              setProgress(100);
              setAnalysisData(msg.analysis ?? null);
              setComparisonsData(msg.comparisons ?? null);
              setDistributionsData(msg.distributions ?? null);
              setTimeline(msg.timeline ?? null);
              setCostBands(msg.costBands ?? null);
              setCostMultiplier("1");
              setLatencyMultiplier("1");
              setSimulatedConfigA(msg.configA ?? configA);
              setSimulatedConfigB(msg.configB ?? configB);
              setProbeOutcomes(msg.probeOutcomes ?? null);
              setConfigsEditedSinceRun(false);
              setStatus("success");
              return true;
            } else if (msg.type === "error") {
              throw new Error(msg.message ?? "Stream error");
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          if (processBuffer()) return;
        }
        if (done) {
          if (buffer.trim()) processBuffer();
          break;
        }
      }

      if (!receivedDone) {
        clearTimeout(timeoutId);
        abortControllerRef.current = null;
        timeoutIdRef.current = null;
        setError("Stream ended without completion");
        setStatus("failure");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("idle");
        setProgress(0);
        setStreamLog([]);
        setProbeOutcomes(null);
        return;
      }
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
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
            <Button
              variant="ghost"
              size="default"
              className="text-base font-bold text-muted-foreground hover:text-foreground"
              onClick={() => startDashboardTour()}
            >
              <Compass className="h-5 w-5 mr-2" />
              Take a tour
            </Button>
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
          <div className="col-span-4 space-y-4 sticky top-24 self-start max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide">
            <div id="tour-config-cards">
              <FlipCard
                configA={configA}
                configB={configB}
                onConfigAChange={setConfigA}
                onConfigBChange={setConfigB}
              />
            </div>
            {/* Run mode: simulate (default) or real API calls */}
            <Card id="tour-run-mode" className="py-1.5 glass-card">
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
                <span id="tour-run-simulation">
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
                </span>
              </CardContent>
            </Card>
            <WhatIfPromptChecker
              config={configA}
              configLabel="Config A"
              runMode={runMode}
              canUseRealApi={canUseRealApiForConfigA}
            />
          </div>

          {/* Middle Column - Traffic Light & Probability */}
          <div id="tour-traffic-light" className="col-span-1 flex flex-col items-center pt-4 sticky top-24 self-start">
            <TrafficLight status={status} />
          </div>

          {/* Right Column - Results */}
          <div id="tour-results" className="col-span-7 space-y-4">
            {loading ? (
              <div className="text-center py-8 text-base text-muted-foreground leading-relaxed">
                Loading analysis data...
              </div>
            ) : status === "running" ? (
              <div className="py-6 space-y-4">
                <div className="text-base text-muted-foreground leading-relaxed">
                  {progress >= 95
                    ? "Finalizing results..."
                    : (() => {
                        const total = streamLog[streamLog.length - 1]?.total ?? (runSize === "quick" ? 40 : 400);
                        const current = streamLog.length > 0 ? streamLog[streamLog.length - 1]?.index ?? 0 : 0;
                        const configCount = 2;
                        const promptCount = runSize === "quick" ? 20 : 200;
                        return `Testing ${configCount} configs × ${promptCount} prompts — ${current}/${total} probes`;
                      })()}
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#25924d] h-2 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-sm text-muted-foreground mb-2">{progress.toFixed(1)}%</div>
                <ScrollArea className="h-[240px] w-full rounded-md border border-border/30 bg-muted/10 p-2 font-mono text-xs">
                  <div className="space-y-0.5">
                    {streamLog.map((entry, i) => {
                      const familyLabel = entry.family
                        ? entry.family.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                        : "Prompt";
                      const configLabel = entry.config_id === "config-a" ? "Config A" : entry.config_id === "config-b" ? "Config B" : entry.config_id.replace(/-/g, " ");
                      return (
                        <div key={i} className="flex items-center gap-2 text-muted-foreground">
                          <span className="text-foreground/90 shrink-0 tabular-nums">
                            {entry.index}/{entry.total}
                          </span>
                          <span className="shrink-0 text-muted-foreground/80">—</span>
                          <span className="shrink-0 text-foreground/80">{familyLabel}</span>
                          <span className="shrink-0 text-muted-foreground/70">·</span>
                          <span className="shrink-0">{configLabel}</span>
                        </div>
                      );
                    })}
                    <div ref={streamLogEndRef} />
                  </div>
                </ScrollArea>
              </div>
            ) : error ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-base font-medium text-destructive leading-relaxed">{error}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Please check your configuration and try again.
                </div>
              </div>
            ) : (() => {
              const hasComparisons = comparisonsData && comparisonsData.comparisons.length > 0;

              if (!hasComparisons) {
                return (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-base text-muted-foreground leading-relaxed">
                      No comparisons yet. Run a simulation to see results.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Configure Config A and Config B, then click "Run Simulation".
                    </p>
                  </div>
                );
              }
              if (configsEditedSinceRun) {
                return (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-base text-muted-foreground leading-relaxed">
                      Configs have changed since the last run.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Run a simulation to see results for your current configuration.
                    </p>
                  </div>
                );
              }
              const toleranceKey = `${costMultiplier}_${latencyMultiplier}`;
              const displayAnalysisData = costBands?.[toleranceKey]?.analysis ?? analysisData;
              const displayComparisonsData = costBands?.[toleranceKey]?.comparisons ?? comparisonsData;
              const displayDistributionsData = costBands?.[toleranceKey]?.distributions ?? distributionsData;

              return (
              <div className="space-y-4">
                {/* Cost & latency tolerance (only when bands from last run exist) */}
                {costBands && (
                  <div className="space-y-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Cost tolerance:</span>
                      {(["1", "2", "3"] as const).map((mult) => (
                        <button
                          key={mult}
                          type="button"
                          onClick={() => setCostMultiplier(mult)}
                          className={cn(
                            "px-2.5 py-1 rounded text-sm font-medium transition-colors border",
                            costMultiplier === mult
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card hover:bg-secondary border-border text-foreground"
                          )}
                        >
                          {mult}×
                        </button>
                      ))}
                      <span className="text-xs text-muted-foreground">Fewer cost_runaway at higher ×.</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Latency tolerance:</span>
                      {(["1", "2"] as const).map((mult) => (
                        <button
                          key={mult}
                          type="button"
                          onClick={() => setLatencyMultiplier(mult)}
                          className={cn(
                            "px-2.5 py-1 rounded text-sm font-medium transition-colors border",
                            latencyMultiplier === mult
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card hover:bg-secondary border-border text-foreground"
                          )}
                        >
                          {mult}×
                        </button>
                      ))}
                      <span className="text-xs text-muted-foreground">Fewer latency_breach at higher ×.</span>
                    </div>
                  </div>
                )}
                {/* One-sentence recommendation */}
                <RecommendationBanner
                  analysisData={displayAnalysisData}
                  comparisonsData={displayComparisonsData}
                  distributionsData={displayDistributionsData}
                  configA={simulatedConfigA || configA}
                  configB={simulatedConfigB || configB}
                />
                {/* Baseline comparison banner when a baseline exists */}
                {baseline && (
                  <BaselineComparisonBanner
                    current={{
                      analysis: displayAnalysisData!,
                      comparisons: displayComparisonsData!,
                      configA: simulatedConfigA || configA,
                      configB: simulatedConfigB || configB,
                    }}
                    baseline={baseline}
                    onClearBaseline={() => setBaseline(null)}
                  />
                )}
                {/* Export report & Save as baseline */}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card hover:bg-secondary border-border text-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      saveBaseline({
                        analysis: displayAnalysisData!,
                        comparisons: displayComparisonsData!,
                        distributions: displayDistributionsData!,
                        configA: simulatedConfigA || configA,
                        configB: simulatedConfigB || configB,
                        timeline: timeline ?? undefined,
                      });
                      setBaselineState(loadBaseline());
                    }}
                  >
                    <Bookmark className="h-4 w-4 mr-2" />
                    Save as baseline
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card hover:bg-secondary border-border text-foreground hover:text-foreground transition-colors"
                    onClick={() =>
                      exportReportAsPdf(
                        displayAnalysisData,
                        displayComparisonsData,
                        displayDistributionsData,
                        simulatedConfigA || configA,
                        simulatedConfigB || configB,
                        timeline
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export report
                  </Button>
                </div>
                {/* Row 1: Results Summary */}
                <ResultsSummary
                  analysisData={displayAnalysisData}
                  comparisonsData={displayComparisonsData}
                  distributionsData={displayDistributionsData}
                  configA={simulatedConfigA || configA}
                  configB={simulatedConfigB || configB}
                />
                
                {/* Row 2: Probability Card and Confidence Band side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <ProbabilityCard
                    comparisons={displayComparisonsData?.comparisons || []}
                    selectedConfigA={(simulatedConfigA || configA).id}
                    selectedConfigB={(simulatedConfigB || configB).id}
                    isRunning={false}
                  />
                  {displayAnalysisData && (
                    <ConfidenceBand analysisData={displayAnalysisData} />
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
                  byFailureMode={displayDistributionsData?.by_failure_mode || {}}
                  byPromptFamily={displayDistributionsData?.by_prompt_family || {}}
                  type="failure-mode"
                />
                
                {/* Row 4: Prompt Family Distribution */}
                <DistributionCharts
                  byFailureMode={displayDistributionsData?.by_failure_mode || {}}
                  byPromptFamily={displayDistributionsData?.by_prompt_family || {}}
                  type="prompt-family"
                />
                
                <FailureBreakdown 
                  byFailureMode={displayDistributionsData?.by_failure_mode || {}}
                />
                
                {/* Failure Hotspot Matrix */}
                <FailureHotspotMatrix 
                  hotspotMatrix={displayDistributionsData?.hotspot_matrix || []}
                />
              </div>
            ); })()}
          </div>
        </div>
      </main>
    </div>
  );
}
