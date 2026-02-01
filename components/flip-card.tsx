"use client";

import { useState, useRef } from "react";
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleFlip = () => {
    if (isTransitioning) return; // Prevent rapid clicks during transition
    
    setIsTransitioning(true);
    setIsFlipped(!isFlipped);
    
    // Clear any existing timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    // Re-enable after transition completes (500ms)
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 500);
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ perspective: "1000px" }}>
      <div
        className={cn(
          "relative w-full transition-transform duration-500",
          isFlipped && "[transform:rotateY(180deg)]"
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front - Config A */}
        <Card
          className="w-full pt-2 pb-4 config-a-bg backdrop-blur-xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="pt-2 px-4 pb-4">
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
                    onClick={handleFlip}
                    disabled={isTransitioning}
                    className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-all text-sm font-medium leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="absolute inset-0 w-full pt-2 pb-4 config-b-bg backdrop-blur-xl [transform:rotateY(180deg)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="pt-2 px-4 pb-4">
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
                    onClick={handleFlip}
                    disabled={isTransitioning}
                    className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-all text-sm font-medium leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
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

      <div className="mt-3 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!isTransitioning && isFlipped) {
                setIsTransitioning(true);
                setIsFlipped(false);
                if (transitionTimeoutRef.current) {
                  clearTimeout(transitionTimeoutRef.current);
                }
                transitionTimeoutRef.current = setTimeout(() => {
                  setIsTransitioning(false);
                }, 500);
              }
            }}
            disabled={isTransitioning || !isFlipped}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors leading-tight disabled:opacity-50 disabled:cursor-not-allowed",
              !isFlipped 
                ? "bg-[#95ccf9]/20 text-[#95ccf9] border border-[#95ccf9]/30" 
                : "bg-border text-muted-foreground hover:bg-[#95ccf9]/10 hover:text-[#95ccf9] border border-border"
            )}
            aria-label="Show Config A"
          >
            <div className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              !isFlipped ? "bg-[#95ccf9]" : "bg-muted-foreground"
            )} />
            <span>Config A</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isTransitioning && !isFlipped) {
                setIsTransitioning(true);
                setIsFlipped(true);
                if (transitionTimeoutRef.current) {
                  clearTimeout(transitionTimeoutRef.current);
                }
                transitionTimeoutRef.current = setTimeout(() => {
                  setIsTransitioning(false);
                }, 500);
              }
            }}
            disabled={isTransitioning || isFlipped}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors leading-tight disabled:opacity-50 disabled:cursor-not-allowed",
              isFlipped 
                ? "bg-[#25924d]/20 text-[#25924d] border border-[#25924d]/30" 
                : "bg-border text-muted-foreground hover:bg-[#25924d]/10 hover:text-[#25924d] border border-border"
            )}
            aria-label="Show Config B"
          >
            <div className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              isFlipped ? "bg-[#25924d]" : "bg-muted-foreground"
            )} />
            <span>Config B</span>
          </button>
        </div>
      </div>
    </div>
  );
}
