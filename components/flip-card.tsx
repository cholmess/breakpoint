"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ConfigForm } from "@/components/config-form";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import type { Config } from "@/types/dashboard";

interface FlipCardProps {
  configA: Config;
  configB: Config;
  onConfigAChange: (config: Config) => void;
  onConfigBChange: (config: Config) => void;
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
      <div
        className={cn(
          "relative w-full transition-transform duration-500",
          isFlipped && "[transform:rotateY(180deg)]"
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front - Config A */}
        <Card
          className="w-full py-4 config-a-bg backdrop-blur-xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-[#95ccf9] shadow-[0_0_8px_rgba(149,204,249,0.6)]" />
              <span className="text-base font-semibold uppercase tracking-wider text-[#95ccf9] leading-tight">
                Configuration A
              </span>
              <span className="ml-auto text-sm px-2 py-1 rounded bg-[#95ccf9]/20 text-[#95ccf9] leading-relaxed">Baseline</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-all text-sm font-medium leading-relaxed"
                    aria-label="Flip card"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="hidden sm:inline">Flip</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to view Configuration B</p>
                </TooltipContent>
              </Tooltip>
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
          className="absolute inset-0 w-full py-4 config-b-bg backdrop-blur-xl [transform:rotateY(180deg)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-[#25924d] shadow-[0_0_8px_rgba(37,146,77,0.6)]" />
              <span className="text-base font-semibold uppercase tracking-wider text-[#25924d] leading-tight">
                Configuration B
              </span>
              <span className="ml-auto text-sm px-2 py-1 rounded bg-[#25924d]/20 text-[#25924d] leading-relaxed">Test</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-all text-sm font-medium leading-relaxed"
                    aria-label="Flip card"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="hidden sm:inline">Flip</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to view Configuration A</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <ConfigForm
              config={configB}
              onChange={onConfigBChange}
              label="Test Config"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsFlipped(false)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors leading-relaxed",
              !isFlipped 
                ? "bg-[#95ccf9]/20 text-[#95ccf9] border border-[#95ccf9]/30" 
                : "bg-border text-muted-foreground hover:bg-[#95ccf9]/10 hover:text-[#95ccf9] border border-border"
            )}
            aria-label="Show Config A"
          >
            <div className={cn(
              "h-2 w-2 rounded-full transition-colors",
              !isFlipped ? "bg-[#95ccf9]" : "bg-muted-foreground"
            )} />
            <span>Config A</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFlipped(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors leading-relaxed",
              isFlipped 
                ? "bg-[#25924d]/20 text-[#25924d] border border-[#25924d]/30" 
                : "bg-border text-muted-foreground hover:bg-[#25924d]/10 hover:text-[#25924d] border border-border"
            )}
            aria-label="Show Config B"
          >
            <div className={cn(
              "h-2 w-2 rounded-full transition-colors",
              isFlipped ? "bg-[#25924d]" : "bg-muted-foreground"
            )} />
            <span>Config B</span>
          </button>
        </div>
      </div>
    </div>
  );
}
