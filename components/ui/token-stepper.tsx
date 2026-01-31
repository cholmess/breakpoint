"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TOKEN_STEP = 512;

/** Round to nearest multiple of 512, minimum 512. */
export function roundToTokenStep(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < TOKEN_STEP) return TOKEN_STEP;
  return Math.round(n / TOKEN_STEP) * TOKEN_STEP;
}

export interface TokenStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  "aria-label"?: string;
}

/**
 * Stepper for token values (multiples of 512). Shows current value with up/down buttons
 * so users see they can only pick discrete steps, not type arbitrary numbers.
 */
export function TokenStepper({
  value,
  onChange,
  min = TOKEN_STEP,
  max = 128 * 1024, // 128k
  step = TOKEN_STEP,
  className,
  "aria-label": ariaLabel,
}: TokenStepperProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const stepped = Math.round(clamped / step) * step;
  const displayValue = Math.max(min, Math.min(max, stepped));

  const decrement = () => {
    const next = Math.max(min, displayValue - step);
    if (next !== displayValue) onChange(next);
  };

  const increment = () => {
    const next = Math.min(max, displayValue + step);
    if (next !== displayValue) onChange(next);
  };

  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-input bg-background",
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0 rounded-l-md rounded-r-none border-0 border-r border-input bg-transparent hover:bg-accent"
        onClick={decrement}
        disabled={displayValue <= min}
        aria-label="Decrease by 512"
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-[4rem] flex-1 px-2 py-1 text-center text-xs font-mono tabular-nums text-foreground">
        {displayValue.toLocaleString()}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0 rounded-r-md rounded-l-none border-0 border-l border-input bg-transparent hover:bg-accent"
        onClick={increment}
        disabled={displayValue >= max}
        aria-label="Increase by 512"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
