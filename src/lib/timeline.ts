/**
 * Break-First Timeline Builder
 * Groups failure events by config and identifies break points
 */

import type { FailureEvent, Timeline, BreakPoint } from "../types";

/**
 * Build break-first timeline from failure events
 * Groups events by config, sorts by severity (HIGH first), then timestamp
 * Identifies the first HIGH severity failure per config as the break point
 */
export function buildBreakFirstTimeline(events: FailureEvent[]): Timeline {
  // Group events by config_id
  const eventsByConfig: Record<string, FailureEvent[]> = {};
  
  for (const event of events) {
    if (!eventsByConfig[event.config_id]) {
      eventsByConfig[event.config_id] = [];
    }
    eventsByConfig[event.config_id].push(event);
  }
  
  // Sort events within each config
  // Priority: HIGH severity first, then by timestamp
  const severityOrder: Record<string, number> = {
    HIGH: 0,
    MED: 1,
    LOW: 2,
  };
  
  for (const configId in eventsByConfig) {
    eventsByConfig[configId].sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      // If same severity, sort by timestamp
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }
  
  // Convert to BreakPoint format and identify break points
  const timeline: Timeline = {
    configs: {},
    break_points: [],
  };
  
  // Track first HIGH severity failure per config
  const breakPointMap = new Map<string, BreakPoint>();
  
  for (const configId in eventsByConfig) {
    const configEvents = eventsByConfig[configId];
    const breakPoints: BreakPoint[] = [];
    
    for (const event of configEvents) {
      const breakPoint: BreakPoint = {
        config_id: event.config_id,
        prompt_id: event.prompt_id,
        failure_mode: event.failure_mode,
        severity: event.severity,
        timestamp: event.timestamp,
        breaks_at: event.breaks_at,
      };
      
      breakPoints.push(breakPoint);
      
      // Track first HIGH severity failure as the break point
      if (
        event.severity === "HIGH" &&
        !breakPointMap.has(configId)
      ) {
        breakPointMap.set(configId, breakPoint);
      }
    }
    
    timeline.configs[configId] = breakPoints;
  }
  
  // Convert break point map to array, sorted by timestamp
  timeline.break_points = Array.from(breakPointMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  return timeline;
}

/**
 * Get the break point for a specific config
 */
export function getBreakPointForConfig(
  timeline: Timeline,
  configId: string
): BreakPoint | null {
  return (
    timeline.break_points.find((bp) => bp.config_id === configId) || null
  );
}

/**
 * Get all events for a specific config
 */
export function getEventsForConfig(
  timeline: Timeline,
  configId: string
): BreakPoint[] {
  return timeline.configs[configId] || [];
}
