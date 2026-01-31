"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ConfigForm } from "@/components/config-form";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

interface FlipCardProps {
  configA: {
    temperature: number;
    topK: number;
    contextWindow: number;
    chunkSize: number;
    maxOutputTokens: number;
    toolsEnabled: boolean;
    budgetCost: number;
  };
  configB: {
    temperature: number;
    topK: number;
    contextWindow: number;
    chunkSize: number;
    maxOutputTokens: number;
    toolsEnabled: boolean;
    budgetCost: number;
  };
  onConfigAChange: (config: FlipCardProps["configA"]) => void;
  onConfigBChange: (config: FlipCardProps["configB"]) => void;
}

export function FlipCard({
  configA,
  configB,
  onConfigAChange,
  onConfigBChange,
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="relative w-full" style={{ perspective: "1000px" }}>
      <button
        type="button"
        onClick={() => setIsFlipped(!isFlipped)}
        className="absolute -top-2 -right-2 z-20 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
        aria-label="Flip card"
      >
        <RotateCcw className="h-3 w-3" />
      </button>

      <div
        className={cn(
          "relative w-full transition-transform duration-500",
          isFlipped && "[transform:rotateY(180deg)]"
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front - Config A */}
        <Card
          className="w-full py-4 border-accent/50 bg-card/80 backdrop-blur-sm"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Configuration A
              </span>
            </div>
            <ConfigForm
              config={configA}
              onChange={onConfigAChange}
              label="Baseline Config"
            />
          </CardContent>
        </Card>

        {/* Back - Config B */}
        <Card
          className="absolute inset-0 w-full py-4 border-emerald/50 bg-card/80 backdrop-blur-sm [transform:rotateY(180deg)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-emerald" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Configuration B
              </span>
            </div>
            <ConfigForm
              config={configB}
              onChange={onConfigBChange}
              label="Test Config"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-2 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setIsFlipped(false)}
          className={cn(
            "h-1.5 w-6 rounded-full transition-colors",
            !isFlipped ? "bg-accent" : "bg-border hover:bg-accent/50"
          )}
          aria-label="Show Config A"
        />
        <button
          type="button"
          onClick={() => setIsFlipped(true)}
          className={cn(
            "h-1.5 w-6 rounded-full transition-colors",
            isFlipped ? "bg-emerald" : "bg-border hover:bg-emerald/50"
          )}
          aria-label="Show Config B"
        />
      </div>
    </div>
  );
}
