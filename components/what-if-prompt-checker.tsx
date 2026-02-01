"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import type { Config } from "@/types/dashboard";

interface WhatIfPromptCheckerProps {
  /** Config to run the check against (e.g. Config A) */
  config: Config;
  /** Optional label for which config is used */
  configLabel?: string;
  /** Run mode from dashboard: What-if uses this so it matches "Run Simulation" */
  runMode?: "simulate" | "real";
  /** When runMode is "real", true if Config A's provider has an API key set */
  canUseRealApi?: boolean;
}

interface CheckResult {
  failure_modes: string[];
  pass: boolean;
  mode_used?: "simulate" | "real";
  details?: {
    events: { failure_mode: string; severity: string; breaks_at: string }[];
  };
}

function formatMode(mode: string): string {
  return mode
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function WhatIfPromptChecker({
  config,
  configLabel = "Config A",
  runMode = "simulate",
  canUseRealApi = true,
}: WhatIfPromptCheckerProps) {
  const [promptText, setPromptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveMode = runMode === "real" && canUseRealApi ? "real" : "simulate";
  const realApiDisabled = runMode === "real" && !canUseRealApi;

  const handleCheck = async () => {
    if (!promptText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/check-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptText: promptText.trim(),
          config,
          mode: effectiveMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Check failed");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold neon-text-subtle leading-relaxed">
          What-if prompt checker
        </CardTitle>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Check <strong>one</strong> pasted prompt against {configLabel}. Uses the <strong>same mode</strong> as above: <strong>{runMode === "real" ? "Real API" : "Simulate"}</strong>—so you see whether this prompt would trigger failures (same rules as a 20- or 200-prompt run).
        </p>
        <p className="text-xs text-muted-foreground/80 leading-relaxed mt-1">
          Run size (Quick / Full) above applies only to &quot;Run Simulation&quot;. This checker runs one probe in {runMode === "real" ? "real" : "simulated"} mode.
        </p>
        {realApiDisabled && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Real API is selected but {configLabel}&apos;s provider has no API key. Add it in <code className="bg-muted px-1 rounded">.env</code> to check with the real model; otherwise Check will use Simulate.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="whatif-prompt" className="text-sm font-medium">
            Prompt text
          </Label>
          <Textarea
            id="whatif-prompt"
            placeholder="Paste or type a prompt to check..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={4}
            className="resize-y font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            We evaluate the <strong>exact text</strong> you paste. Instructions like &quot;repeat 10 times&quot; or &quot;30,000 characters&quot; don’t add length—paste the actual long content to see context overflow or cost runaway.
          </p>
        </div>
        <Button
          onClick={handleCheck}
          disabled={loading || !promptText.trim()}
          className="w-full sm:w-auto"
          title={realApiDisabled ? "Using Simulate (no API key for Real)" : undefined}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Check
            </>
          )}
        </Button>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && !error && (
          <>
            <p className="text-xs text-muted-foreground">
              Checked with <strong>{result.mode_used === "real" ? "Real API" : "Simulate"}</strong> ({configLabel}&apos;s model).
            </p>
            <div
              className={
              result.pass
                ? "flex items-start gap-2 rounded-md border border-green-500/50 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400"
                : "flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
            }
          >
            {result.pass ? (
              <>
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span>No failures detected for this prompt.</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    In a full run (20 or 200 prompts), this prompt would be one of the probes and would not add to the failure count.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">This prompt would trigger:</p>
                  <ul className="mt-1 list-inside list-disc">
                    {result.failure_modes.map((m) => (
                      <li key={m}>{formatMode(m)}</li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    In a full run (20 or 200 prompts), prompts like this would count toward the failure rates and hotspot matrix above.
                  </p>
                  {result.details?.events && result.details.events.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Details
                      </summary>
                      <ul className="mt-1 space-y-1 text-xs">
                        {result.details.events.map((e, i) => (
                          <li key={i}>
                            {formatMode(e.failure_mode)} — {e.breaks_at}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </>
            )}
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
