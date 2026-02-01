"use client";

import jsPDF from "jspdf";
import type { AnalysisData, ComparisonsData, DistributionsData, Config } from "@/types/dashboard";

const MARGIN = 20;
const LINE_HEIGHT = 7;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function getReportContent(
  analysisData: AnalysisData | null,
  comparisonsData: ComparisonsData | null,
  distributionsData: DistributionsData | null,
  configA: Config,
  configB: Config
): {
  summary: string;
  confidencePct: number;
  saferConfigName: string | null;
  configAStats: { phat: number; k: number; n: number } | null;
  configBStats: { phat: number; k: number; n: number } | null;
  topFailureModes: { name: string; count: number }[];
} {
  const currentComparison = comparisonsData?.comparisons.find(
    (c) =>
      (c.config_a === configA.id && c.config_b === configB.id) ||
      (c.config_a === configB.id && c.config_b === configA.id)
  );
  const configAStatsRaw = analysisData?.configs[configA.id];
  const configBStatsRaw = analysisData?.configs[configB.id];

  const pValue =
    currentComparison != null
      ? currentComparison.config_a === configA.id
        ? currentComparison.p_a_safer
        : 1 - currentComparison.p_a_safer
      : null;
  const saferConfig = pValue != null && pValue > 0.5 ? configA : pValue != null && pValue < 0.5 ? configB : null;
  const confidence = pValue != null ? Math.abs(pValue - 0.5) * 2 : 0;
  const confidencePct = Math.round(confidence * 100);

  let summary: string;
  if (!currentComparison || !configAStatsRaw || !configBStatsRaw) {
    summary = "Run a simulation to see which configuration performs better.";
  } else if (pValue === 0.5) {
    summary = "Both configurations show similar failure rates. Consider other factors like cost or latency.";
  } else {
    const saferName = saferConfig === configA ? "Config A" : "Config B";
    const otherName = saferConfig === configA ? "Config B" : "Config A";
    const saferRate = saferConfig === configA ? configAStatsRaw.phat : configBStatsRaw.phat;
    const otherRate = saferConfig === configA ? configBStatsRaw.phat : configAStatsRaw.phat;
    if (confidence > 0.7) {
      summary = `${saferName} is significantly more reliable, with ${(saferRate * 100).toFixed(1)}% failure rate compared to ${otherName}'s ${(otherRate * 100).toFixed(1)}%.`;
    } else if (confidence > 0.5) {
      summary = `${saferName} appears more reliable (${(saferRate * 100).toFixed(1)}% vs ${(otherRate * 100).toFixed(1)}% failure rate), though the difference is moderate.`;
    } else {
      summary = `The configurations are quite similar. ${saferName} has a slightly lower failure rate (${(saferRate * 100).toFixed(1)}% vs ${(otherRate * 100).toFixed(1)}%).`;
    }
  }

  const saferConfigName = saferConfig === configA ? "Config A" : saferConfig === configB ? "Config B" : null;
  const configAStats =
    configAStatsRaw != null
      ? { phat: configAStatsRaw.phat, k: configAStatsRaw.k, n: configAStatsRaw.n }
      : null;
  const configBStats =
    configBStatsRaw != null
      ? { phat: configBStatsRaw.phat, k: configBStatsRaw.k, n: configBStatsRaw.n }
      : null;

  const byMode = distributionsData?.by_failure_mode ?? {};
  const topFailureModes = Object.values(byMode)
    .filter((e) => e.failure_mode != null)
    .map((e) => ({
      name: (e.failure_mode as string)
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      count: e.count ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    summary,
    confidencePct,
    saferConfigName,
    configAStats,
    configBStats,
    topFailureModes,
  };
}

/** Split long text into lines that fit within maxWidth. */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const parts = text.split(/\s+/);
  let current = "";
  for (const part of parts) {
    const candidate = current ? `${current} ${part}` : part;
    const w = doc.getTextWidth(candidate);
    if (w <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = part;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function exportReportAsPdf(
  analysisData: AnalysisData | null,
  comparisonsData: ComparisonsData | null,
  distributionsData: DistributionsData | null,
  configA: Config,
  configB: Config
): void {
  const doc = new jsPDF();
  let y = MARGIN;

  const { summary, confidencePct, saferConfigName, configAStats, configBStats, topFailureModes } = getReportContent(
    analysisData,
    comparisonsData,
    distributionsData,
    configA,
    configB
  );

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BreakPoint", MARGIN, y);
  y += LINE_HEIGHT;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("AI Observability — Comparison Report", MARGIN, y);
  y += LINE_HEIGHT + 2;

  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, y);
  y += LINE_HEIGHT + 4;

  // Recommendation / summary
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Recommendation", MARGIN, y);
  y += LINE_HEIGHT;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryLines = wrapText(doc, summary, CONTENT_WIDTH);
  for (const line of summaryLines) {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }
  y += 2;

  // Confidence
  if (saferConfigName != null && confidencePct > 0) {
    doc.setFont("helvetica", "bold");
    doc.text(`Confidence that ${saferConfigName} is safer: ${confidencePct}%`, MARGIN, y);
    y += LINE_HEIGHT + 2;
    doc.setFont("helvetica", "normal");
  }

  // Key metrics table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Key metrics", MARGIN, y);
  y += LINE_HEIGHT;

  const col1 = MARGIN;
  const col2 = MARGIN + 55;
  const col3 = MARGIN + 95;
  const col4 = MARGIN + 135;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Config", col1, y);
  doc.text("Failure rate", col2, y);
  doc.text("Failures", col3, y);
  doc.text("Tests", col4, y);
  y += LINE_HEIGHT;

  if (configAStats != null) {
    doc.text("Config A", col1, y);
    doc.text(`${(configAStats.phat * 100).toFixed(1)}%`, col2, y);
    doc.text(String(configAStats.k), col3, y);
    doc.text(String(configAStats.n), col4, y);
    y += LINE_HEIGHT;
  }
  if (configBStats != null) {
    doc.text("Config B", col1, y);
    doc.text(`${(configBStats.phat * 100).toFixed(1)}%`, col2, y);
    doc.text(String(configBStats.k), col3, y);
    doc.text(String(configBStats.n), col4, y);
    y += LINE_HEIGHT;
  }
  y += 2;

  // Failure mode breakdown (top 5)
  if (topFailureModes.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Failure modes (top)", MARGIN, y);
    y += LINE_HEIGHT;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const { name, count } of topFailureModes) {
      doc.text(`${name}: ${count}`, MARGIN, y);
      y += LINE_HEIGHT;
    }
  }

  const filename = `breakpoint-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
