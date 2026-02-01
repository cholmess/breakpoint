/**
 * Baseline comparison: save/load run snapshot to localStorage.
 */

import type { Baseline } from "@/types/dashboard";

const BASELINE_KEY = "breakpoint-baseline";

export function saveBaseline(baseline: Omit<Baseline, "savedAt">): void {
  if (typeof window === "undefined") return;
  const withDate: Baseline = { ...baseline, savedAt: new Date().toISOString() };
  window.localStorage.setItem(BASELINE_KEY, JSON.stringify(withDate));
}

export function loadBaseline(): Baseline | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BASELINE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Baseline;
  } catch {
    return null;
  }
}

export function clearBaseline(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BASELINE_KEY);
}
