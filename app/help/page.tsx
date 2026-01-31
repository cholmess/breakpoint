"use client";

import Link from "next/link";
import { ArrowLeft, HelpCircle, Settings, BarChart3, Zap, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrbTrail } from "@/components/orb-trail";

export default function HelpPage() {
  return (
    <div className="min-h-screen gradient-mesh">
      <OrbTrail />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 glass-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-black border border-zinc-800">
              <HelpCircle className="h-4 w-4 text-[#99e4f2]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight neon-text-subtle leading-tight">
                Help & Guide
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Learn how to use BreakPoint
              </p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Getting Started Section */}
          <Card className="py-4 glass-card">
            <CardHeader className="py-3 px-6">
              <CardTitle className="text-xl font-bold neon-text-subtle flex items-center gap-3 leading-tight">
                <Zap className="h-5 w-5" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <p className="text-base leading-relaxed">
                BreakPoint is an AI observability dashboard that helps you compare different LLM configurations
                to find the most reliable setup for your use case.
              </p>
              <ol className="list-decimal list-inside space-y-3 ml-2 text-base leading-relaxed">
                <li>
                  <strong className="text-foreground">Configure your setups:</strong> Use the flip card to configure{" "}
                  <strong className="text-[#95ccf9]">Configuration A</strong> (Baseline) and{" "}
                  <strong className="text-[#25924d]">Configuration B</strong> (Test)
                </li>
                <li>
                  <strong className="text-foreground">Select Run Mode:</strong> Choose between{" "}
                  <strong>Simulate</strong> (fast, no API costs) or <strong>Real API</strong> (actual LLM calls)
                </li>
                <li>
                  <strong className="text-foreground">Run Simulation:</strong> Click the{" "}
                  <strong className="text-[#25924d]">Run Simulation</strong> button to test both configurations
                </li>
                <li>
                  <strong className="text-foreground">Review Results:</strong> Analyze the results to see which
                  configuration is safer and more reliable
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Configuration Parameters */}
          <Card className="py-4 glass-card">
            <CardHeader className="py-3 px-6">
              <CardTitle className="text-xl font-bold neon-text-subtle flex items-center gap-3 leading-tight">
                <Settings className="h-5 w-5" />
                Configuration Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base leading-relaxed">
                <div className="space-y-3">
                  <div>
                    <strong className="text-foreground">Model:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      The LLM model to use (e.g., gpt-4, gemini-1.5-flash, manus-1.6)
                    </p>
                  </div>
                  <div>
                    <strong className="text-foreground">Context Window:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Maximum tokens the model can process in one request
                    </p>
                  </div>
                  <div>
                    <strong className="text-foreground">Top-K:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Number of retrieval results to consider (higher = more context, but more noise)
                    </p>
                  </div>
                  <div>
                    <strong className="text-foreground">Chunk Size:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Size of text chunks for processing (must be divisible by 512)
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <strong className="text-foreground">Max Output Tokens:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Maximum tokens the model can generate in response
                    </p>
                  </div>
                  <div>
                    <strong className="text-foreground">Tools Enabled:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Whether the model can use function calling/tools
                    </p>
                  </div>
                  <div>
                    <strong className="text-foreground">Temperature:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Controls randomness (0 = deterministic, 1 = creative)
                    </p>
                  </div>
                  <div>
                    <strong className="text-foreground">Cost per 1K Tokens:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pricing for cost calculations
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Understanding Results */}
          <Card className="py-4 glass-card">
            <CardHeader className="py-3 px-6">
              <CardTitle className="text-xl font-bold neon-text-subtle flex items-center gap-3 leading-tight">
                <BarChart3 className="h-5 w-5" />
                Understanding Results
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div>
                <strong className="text-base text-foreground">Failure Rate:</strong>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  The percentage of prompts that triggered a failure event. Lower is better. Calculated as{" "}
                  <code className="text-sm bg-muted px-1.5 py-0.5 rounded">(number of failures) / (total prompts tested)</code>.
                </p>
              </div>
              <div>
                <strong className="text-base text-foreground">Confidence Interval (CI):</strong>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  A range that shows the uncertainty in the failure rate estimate. A narrower band means more confidence.
                  A wider band means less certainty due to smaller sample sizes. The band visually represents the 95% confidence interval.
                </p>
              </div>
              <div>
                <strong className="text-base text-foreground">Safer Choice Percentage:</strong>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  The probability that one configuration is more reliable than the other. For example, "85%" means there's
                  an 85% chance that Configuration A has a lower failure rate than Configuration B. This uses Bayesian
                  statistical methods to compare the two configurations.
                </p>
              </div>
              <div>
                <strong className="text-base text-foreground">Failure Mode Distribution:</strong>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  Shows which types of problems occurred most often (e.g., context overflow, latency breaches, tool timeouts).
                  This helps you identify specific issues with your configuration.
                </p>
              </div>
              <div>
                <strong className="text-base text-foreground">Prompt Family Distribution:</strong>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  Shows which types of prompts triggered the most failures, helping you understand which use cases are
                  most problematic for your configuration.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Run Modes */}
          <Card className="py-4 glass-card">
            <CardHeader className="py-3 px-6">
              <CardTitle className="text-xl font-bold neon-text-subtle flex items-center gap-3 leading-tight">
                <Zap className="h-5 w-5" />
                Run Modes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div>
                <strong className="text-base text-foreground">Simulate Mode:</strong>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  Fast, free testing using generated telemetry. Perfect for quick comparisons and development.
                  Results are deterministic with the same seed, making it ideal for reproducible testing.
                  No API keys required.
                </p>
              </div>
              <div>
                <strong className="text-base text-foreground">Real API Mode:</strong>
                <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                  Makes actual API calls to LLM providers (OpenAI, Gemini, or Manus). Requires API keys in your{" "}
                  <code className="text-sm bg-muted px-1.5 py-0.5 rounded">.env</code> file. More accurate but slower
                  and incurs API costs. Use this for final validation before production.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="py-4 glass-card">
            <CardHeader className="py-3 px-6">
              <CardTitle className="text-xl font-bold neon-text-subtle flex items-center gap-3 leading-tight">
                <Lightbulb className="h-5 w-5" />
                Tips & Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <ul className="list-disc list-inside space-y-3 text-base leading-relaxed">
                <li>Start with <strong>Simulate mode</strong> to quickly test different configurations</li>
                <li>Use <strong>Real API mode</strong> for final validation before production</li>
                <li>Compare configurations with significantly different failure rates for meaningful results</li>
                <li>Check the <strong>Failure Mode Breakdown</strong> to understand specific issues</li>
                <li>Higher confidence intervals indicate you may need more test data</li>
                <li>Use the flip card to easily switch between Configuration A and B</li>
                <li>Monitor the traffic light indicator to see simulation status</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

