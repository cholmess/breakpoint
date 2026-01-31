"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ConfigForm } from "@/components/config-form";
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
          className="w-full py-4 config-a-bg backdrop-blur-xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-[#95ccf9] shadow-[0_0_8px_rgba(149,204,249,0.6)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#95ccf9]">
                Configuration A
              </span>
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#95ccf9]/20 text-[#95ccf9]">Baseline</span>
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
              <span className="text-xs font-semibold uppercase tracking-wider text-[#25924d]">
                Configuration B
              </span>
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#25924d]/20 text-[#25924d]">Test</span>
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
            !isFlipped ? "bg-[#95ccf9]" : "bg-border hover:bg-[#95ccf9]/50"
          )}
          aria-label="Show Config A"
        />
        <button
          type="button"
          onClick={() => setIsFlipped(true)}
          className={cn(
            "h-1.5 w-6 rounded-full transition-colors",
            isFlipped ? "bg-[#25924d]" : "bg-border hover:bg-[#25924d]/50"
          )}
          aria-label="Show Config B"
        />
      </div>
    </div>
  );
}
