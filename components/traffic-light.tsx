"use client";

import { cn } from "@/lib/utils";

interface TrafficLightProps {
  status: "idle" | "running" | "success" | "failure";
}

export function TrafficLight({ status }: TrafficLightProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-black border border-zinc-800 shadow-[0_0_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)]">
      <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">
        Status
      </div>
      <div className="flex flex-col gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
        {/* Red */}
        <div
          className={cn(
            "h-5 w-5 rounded-full border-2 transition-all duration-300",
            status === "failure"
              ? "bg-red-500 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.8),0_0_24px_rgba(239,68,68,0.4)] animate-pulse"
              : "bg-red-950 border-red-900/50"
          )}
        />
        {/* Yellow */}
        <div
          className={cn(
            "h-5 w-5 rounded-full border-2 transition-all duration-300",
            status === "running"
              ? "bg-amber-400 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.8),0_0_24px_rgba(251,191,36,0.4)] animate-pulse"
              : "bg-amber-950 border-amber-900/50"
          )}
        />
        {/* Green */}
        <div
          className={cn(
            "h-5 w-5 rounded-full border-2 transition-all duration-300",
            status === "success"
              ? "bg-emerald-500 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8),0_0_24px_rgba(16,185,129,0.4)] animate-pulse"
              : "bg-emerald-950 border-emerald-900/50"
          )}
        />
      </div>
      <div className={cn(
        "text-[9px] font-mono uppercase mt-0.5 tracking-wide",
        status === "idle" && "text-zinc-500",
        status === "running" && "text-amber-400",
        status === "success" && "text-emerald-400",
        status === "failure" && "text-red-400"
      )}>
        {status}
      </div>
    </div>
  );
}
