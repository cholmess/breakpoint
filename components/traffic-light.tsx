"use client";

import { cn } from "@/lib/utils";

interface TrafficLightProps {
  status: "idle" | "running" | "success" | "failure";
}

export function TrafficLight({ status }: TrafficLightProps) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-foreground/5 border border-border">
      <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        Status
      </div>
      <div className="flex flex-col gap-1.5">
        {/* Red */}
        <div
          className={cn(
            "h-4 w-4 rounded-full border border-foreground/10 transition-all duration-300",
            status === "failure"
              ? "bg-destructive shadow-[0_0_8px_rgba(220,38,38,0.6)] animate-pulse"
              : "bg-destructive/20"
          )}
        />
        {/* Yellow */}
        <div
          className={cn(
            "h-4 w-4 rounded-full border border-foreground/10 transition-all duration-300",
            status === "running"
              ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse"
              : "bg-amber-400/20"
          )}
        />
        {/* Green */}
        <div
          className={cn(
            "h-4 w-4 rounded-full border border-foreground/10 transition-all duration-300",
            status === "success"
              ? "bg-emerald shadow-[0_0_8px_rgba(37,146,77,0.6)] animate-pulse"
              : "bg-emerald/20"
          )}
        />
      </div>
      <div className="text-[8px] font-mono uppercase mt-1 text-muted-foreground">
        {status}
      </div>
    </div>
  );
}
