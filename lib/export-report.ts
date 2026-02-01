"use client";

import jsPDF from "jspdf";
import type { AnalysisData, ComparisonsData, DistributionsData, Config } from "@/types/dashboard";

const MARGIN = 18;
const LINE_HEIGHT = 6;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Professional color palette (RGB 0–255)
const COLORS = {
  headerBg: [45, 55, 72] as [number, number, number],
  accent: [37, 146, 77] as [number, number, number],
  accentLight: [220, 245, 225] as [number, number, number],
  sectionBg: [247, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  textMuted: [100, 116, 139] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

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

function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
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

function drawSectionHeader(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(...COLORS.sectionBg);
  doc.rect(0, y - 5, PAGE_WIDTH, 10, "F");
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.1);
  doc.line(MARGIN, y + 4, PAGE_WIDTH - MARGIN, y + 4);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(title.toUpperCase(), MARGIN, y + 2);
  doc.setTextColor(...COLORS.text);
  return y + 10;
}

function drawTable(
  doc: jsPDF,
  y: number,
  headers: string[],
  rows: string[][],
  colWidths: number[]
): number {
  const rowHeight = 8;
  const x0 = MARGIN;
  let x = x0;

  // Header row
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(x0, y, colWidths.reduce((a, b) => a + b, 0) + 2, rowHeight, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 3, y + 5.5);
    x += colWidths[i];
  }
  y += rowHeight;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(x0, y, x0 + colWidths.reduce((a, b) => a + b, 0) + 2, y);

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  for (let r = 0; r < rows.length; r++) {
    if (r % 2 === 1) {
      doc.setFillColor(...COLORS.sectionBg);
      doc.rect(x0, y, colWidths.reduce((a, b) => a + b, 0) + 2, rowHeight, "F");
    }
    x = x0;
    for (let c = 0; c < rows[r].length; c++) {
      doc.text(rows[r][c], x + 3, y + 5.5);
      x += colWidths[c];
    }
    y += rowHeight;
    doc.line(x0, y, x0 + colWidths.reduce((a, b) => a + b, 0) + 2, y);
  }
  doc.setDrawColor(...COLORS.border);
  doc.line(x0, y - rowHeight * rows.length, x0, y);
  let xEnd = x0;
  for (let i = 0; i < colWidths.length; i++) {
    xEnd += colWidths[i];
    doc.line(xEnd + 2, y - rowHeight * rows.length, xEnd + 2, y);
  }
  return y + 6;
}

export function exportReportAsPdf(
  analysisData: AnalysisData | null,
  comparisonsData: ComparisonsData | null,
  distributionsData: DistributionsData | null,
  configA: Config,
  configB: Config
): void {
  const doc = new jsPDF();
  let y = 0;

  const { summary, confidencePct, saferConfigName, configAStats, configBStats, topFailureModes } = getReportContent(
    analysisData,
    comparisonsData,
    distributionsData,
    configA,
    configB
  );

  // —— Header bar ——
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, PAGE_WIDTH, 28, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("BreakPoint", MARGIN, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("AI Observability · Configuration Comparison Report", MARGIN, 22);
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(`Generated ${new Date().toLocaleString()}`, PAGE_WIDTH - MARGIN, 22, { align: "right" });
  y = 36;

  // —— Executive Summary ——
  y = drawSectionHeader(doc, y, "Executive summary");
  const summaryLines = wrapText(doc, summary, CONTENT_WIDTH - 8, 10);
  const summaryBoxHeight = Math.max(22, summaryLines.length * LINE_HEIGHT + 12);
  doc.setFillColor(...COLORS.accentLight);
  doc.rect(MARGIN, y, CONTENT_WIDTH, summaryBoxHeight, "F");
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, y, CONTENT_WIDTH, summaryBoxHeight, "S");
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let summaryY = y + 10;
  for (const line of summaryLines) {
    doc.text(line, MARGIN + 6, summaryY);
    summaryY += LINE_HEIGHT;
  }
  y += summaryBoxHeight + 4;

  if (saferConfigName != null && confidencePct > 0) {
    doc.setFillColor(...COLORS.accent);
    doc.rect(MARGIN, y, 52, 10, "F");
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${confidencePct}% confidence`, MARGIN + 6, y + 7);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.text(`that ${saferConfigName} is safer for production`, MARGIN + 60, y + 7);
    y += 16;
  }
  y += 6;

  // —— Key metrics ——
  y = drawSectionHeader(doc, y + 4, "Reliability metrics");
  const tableColWidths = [42, 38, 42, 35];
  const tableHeaders = ["Configuration", "Failure rate", "Failures", "Tests"];
  const tableRows: string[][] = [];
  if (configAStats != null) {
    tableRows.push([
      "Config A",
      `${(configAStats.phat * 100).toFixed(1)}%`,
      String(configAStats.k),
      String(configAStats.n),
    ]);
  }
  if (configBStats != null) {
    tableRows.push([
      "Config B",
      `${(configBStats.phat * 100).toFixed(1)}%`,
      String(configBStats.k),
      String(configBStats.n),
    ]);
  }
  if (tableRows.length > 0) {
    y = drawTable(doc, y, tableHeaders, tableRows, tableColWidths);
  }
  y += 4;

  // —— Configurations compared ——
  y = drawSectionHeader(doc, y + 4, "Configurations compared");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Config A", MARGIN, y + 2);
  doc.text("Config B", MARGIN + CONTENT_WIDTH / 2, y + 2);
  doc.setTextColor(...COLORS.text);
  y += 6;
  const configRows = [
    ["Model", configA.model, configB.model],
    ["Context window", `${configA.context_window} tokens`, `${configB.context_window} tokens`],
    ["Max output tokens", String(configA.max_output_tokens), String(configB.max_output_tokens)],
    ["Tools", configA.tools_enabled ? "Enabled" : "Disabled", configB.tools_enabled ? "Enabled" : "Disabled"],
    ["Temperature", String(configA.temperature), String(configB.temperature)],
  ];
  const colW = CONTENT_WIDTH / 2;
  for (const [label, valA, valB] of configRows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textMuted);
    doc.text(label, MARGIN, y + 5);
    doc.setTextColor(...COLORS.text);
    doc.text(valA, MARGIN + 36, y + 5);
    doc.text(valB, MARGIN + colW + 36, y + 5);
    y += 7;
  }
  y += 6;

  // —— Failure mode breakdown ——
  y = drawSectionHeader(doc, y + 4, "Failure mode breakdown");
  if (topFailureModes.length > 0) {
    const maxCount = Math.max(...topFailureModes.map((m) => m.count), 1);
    const barStartX = MARGIN + 62;
    const barWidth = 60;
    const barEndX = barStartX + barWidth;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const { name, count } of topFailureModes) {
      doc.setTextColor(...COLORS.text);
      doc.text(name, MARGIN, y + 5);
      const w = (count / maxCount) * barWidth;
      doc.setFillColor(...COLORS.accentLight);
      doc.rect(barStartX, y - 2, barWidth, 6, "F");
      doc.setFillColor(...COLORS.accent);
      doc.rect(barStartX, y - 2, w, 6, "F");
      doc.setTextColor(...COLORS.textMuted);
      doc.text(String(count), barEndX + 6, y + 5);
      y += 10;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textMuted);
    doc.text("No failure events in this run.", MARGIN, y + 5);
    y += 12;
  }
  y += 8;

  // —— Footer ——
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, PAGE_HEIGHT - 18, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 18);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text("BreakPoint — AI Observability Dashboard", MARGIN, PAGE_HEIGHT - 12);
  doc.text("This report reflects the state at the time of export.", PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12, {
    align: "right",
  });

  const filename = `breakpoint-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
