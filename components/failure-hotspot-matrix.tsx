"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HotspotEntry } from "@/types/dashboard";

interface FailureHotspotMatrixProps {
  hotspotMatrix: HotspotEntry[];
}

export function FailureHotspotMatrix({ hotspotMatrix }: FailureHotspotMatrixProps) {
  if (!hotspotMatrix || hotspotMatrix.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold neon-text-subtle leading-relaxed">
            Failure Hotspot Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No failures detected
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get unique families and failure modes
  const families = Array.from(new Set(hotspotMatrix.map(h => h.family))).sort();
  const failureModes = Array.from(new Set(hotspotMatrix.map(h => h.failure_mode))).sort();

  // Build lookup map for quick access
  const lookupMap = new Map<string, number>();
  for (const entry of hotspotMatrix) {
    lookupMap.set(`${entry.failure_mode}|${entry.family}`, entry.count);
  }

  // Find max count for color scaling
  const maxCount = Math.max(...hotspotMatrix.map(h => h.count));

  // Get color based on count (gradient from light to dark)
  const getColor = (count: number): string => {
    if (count === 0) return "bg-card border-border/50";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return "bg-red-500/20 border-red-500/30";
    if (intensity < 0.5) return "bg-red-500/40 border-red-500/50";
    if (intensity < 0.75) return "bg-red-500/60 border-red-500/70";
    return "bg-red-500/80 border-red-500/90";
  };

  // Format failure mode for display
  const formatMode = (mode: string): string => {
    return mode
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Format family for display
  const formatFamily = (family: string): string => {
    return family
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold neon-text-subtle leading-relaxed">
          Failure Hotspot Matrix
        </CardTitle>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cross-tabulation of failure modes × prompt families
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-border/30 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Failure Mode / Family
                </th>
                {families.map(family => (
                  <th
                    key={family}
                    className="border border-border/30 bg-muted/20 px-3 py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {formatFamily(family)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failureModes.map(mode => (
                <tr key={mode}>
                  <td className="border border-border/30 bg-muted/10 px-3 py-2 text-xs font-medium text-foreground">
                    {formatMode(mode)}
                  </td>
                  {families.map(family => {
                    const count = lookupMap.get(`${mode}|${family}`) ?? 0;
                    const colorClass = getColor(count);
                    return (
                      <td
                        key={`${mode}|${family}`}
                        className={`border ${colorClass} px-3 py-2 text-center text-sm font-medium transition-colors`}
                      >
                        {count > 0 ? count : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span>Color intensity indicates frequency:</span>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500/20 border border-red-500/30" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500/40 border border-red-500/50" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500/80 border border-red-500/90" />
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
