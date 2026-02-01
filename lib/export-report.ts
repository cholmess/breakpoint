"use client";

import jsPDF from "jspdf";
import type {
  AnalysisData,
  ComparisonsData,
  DistributionsData,
  Config,
  Timeline,
  HotspotEntry,
} from "@/types/dashboard";

const MARGIN = 18;
const LINE_HEIGHT = 6;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = PAGE_HEIGHT - 22;

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

function formatFailureMode(mode: string): string {
  return mode
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function configLabel(configId: string, configA: Config, configB: Config): string {
  return configId === configA.id ? "Config A" : configId === configB.id ? "Config B" : configId;
}

interface ReportContent {
  summary: string;
  confidencePct: number;
  saferConfigName: string | null;
  configAStats: { phat: number; k: number; n: number } | null;
  configBStats: { phat: number; k: number; n: number } | null;
  topFailureModes: { name: string; count: number }[];
  whyBullets: string[];
  whatItMeans: string;
  lowSample: boolean;
  topPromptFamilies: { name: string; count: number }[];
  topHotspots: { family: string; failure_mode: string; count: number }[];
}

function getReportContent(
  analysisData: AnalysisData | null,
  comparisonsData: ComparisonsData | null,
  distributionsData: DistributionsData | null,
  configA: Config,
  configB: Config
): ReportContent {
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
      name: formatFailureMode(e.failure_mode as string),
      count: e.count ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const byFamily = distributionsData?.by_prompt_family ?? {};
  const topPromptFamilies = Object.values(byFamily)
    .filter((e) => e.family != null)
    .map((e) => ({
      name: (e.family as string).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      count: e.count ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const hotspotMatrix = distributionsData?.hotspot_matrix ?? [];
  const topHotspots = [...hotspotMatrix]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((h: HotspotEntry) => ({
      family: (h.family || "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      failure_mode: formatFailureMode(h.failure_mode || ""),
      count: h.count ?? 0,
    }));

  const whyBullets: string[] = [];
  const lowSample = Boolean(configAStatsRaw?.low_sample_warning || configBStatsRaw?.low_sample_warning);

  if (saferConfigName && configAStats && configBStats) {
    const saferName = saferConfigName;
    const otherName = saferConfigName === "Config A" ? "Config B" : "Config A";
    const saferRate = saferConfigName === "Config A" ? configAStats.phat : configBStats.phat;
    const otherRate = saferConfigName === "Config A" ? configBStats.phat : configAStats.phat;
    whyBullets.push(
      `${saferName} had a lower failure rate: ${(saferRate * 100).toFixed(1)}% versus ${otherName}'s ${(otherRate * 100).toFixed(1)}%.`
    );
    whyBullets.push(
      `Analysis gives ${confidencePct}% confidence that ${saferName} is the safer choice for production.`
    );
    const mostCommon = Object.values(byMode)
      .filter((e) => e.failure_mode != null)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
    const totalFailures = Object.values(byMode).reduce((sum, e) => sum + (e.count ?? 0), 0);
    if (mostCommon && totalFailures > 0) {
      whyBullets.push(
        `Most common issue: ${formatFailureMode(mostCommon.failure_mode as string)} (${mostCommon.count ?? 0} of ${totalFailures} events); ${saferName} performed better overall.`
      );
    }
    const hasCost =
      typeof configA.cost_per_1k_tokens === "number" && typeof configB.cost_per_1k_tokens === "number";
    if (hasCost && saferConfig) {
      const cheaper =
        saferConfig === configA
          ? configA.cost_per_1k_tokens < configB.cost_per_1k_tokens
          : configB.cost_per_1k_tokens < configA.cost_per_1k_tokens;
      if (cheaper) {
        whyBullets.push(`${saferName} is also cheaper per 1k tokens.`);
      } else if (configA.cost_per_1k_tokens === configB.cost_per_1k_tokens) {
        whyBullets.push("Both configs have the same cost per 1k tokens.");
      }
    }
  }

  let whatItMeans = "Use the recommended configuration in production for better reliability.";
  if (saferConfigName && configAStats && configBStats) {
    const rateDiffPct = Math.abs((configAStats.phat - configBStats.phat) * 100);
    if (lowSample) {
      whatItMeans = `Use ${saferConfigName} if satisfied with this sample. For higher confidence, run a full simulation (200 prompts) before committing.`;
    } else {
      whatItMeans = `Use ${saferConfigName} in production. The ${rateDiffPct.toFixed(1)}% lower failure rate and ${confidencePct}% confidence support this choice.`;
    }
  }

  return {
    summary,
    confidencePct,
    saferConfigName,
    configAStats,
    configBStats,
    topFailureModes,
    whyBullets,
    whatItMeans,
    lowSample,
    topPromptFamilies,
    topHotspots,
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

const FOOTER_CLEARANCE = 18; // Min space between content and footer

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_TOP - FOOTER_CLEARANCE) {
    doc.addPage();
    return 36;
  }
  return y;
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
  const totalW = colWidths.reduce((a, b) => a + b, 0) + 2;

  doc.setFillColor(...COLORS.headerBg);
  doc.rect(x0, y, totalW, rowHeight, "F");
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
  doc.line(x0, y, x0 + totalW, y);

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  for (let r = 0; r < rows.length; r++) {
    if (r % 2 === 1) {
      doc.setFillColor(...COLORS.sectionBg);
      doc.rect(x0, y, totalW, rowHeight, "F");
    }
    x = x0;
    for (let c = 0; c < rows[r].length; c++) {
      doc.text(rows[r][c], x + 3, y + 5.5);
      x += colWidths[c];
    }
    y += rowHeight;
    doc.line(x0, y, x0 + totalW, y);
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

function drawFooter(doc: jsPDF, pageNum: number) {
  const y = FOOTER_TOP;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y - 4, PAGE_WIDTH - MARGIN, y - 4);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text("BreakPoint — AI Observability Dashboard", MARGIN, y + 2);
  doc.text(`Page ${pageNum} · Report reflects state at time of export.`, PAGE_WIDTH - MARGIN, y + 2, {
    align: "right",
  });
}

export function exportReportAsPdf(
  analysisData: AnalysisData | null,
  comparisonsData: ComparisonsData | null,
  distributionsData: DistributionsData | null,
  configA: Config,
  configB: Config,
  timeline?: Timeline | null
): void {
  const doc = new jsPDF();
  let y = 0;
  let pageNum = 1;

  const content = getReportContent(
    analysisData,
    comparisonsData,
    distributionsData,
    configA,
    configB
  );
  const {
    summary,
    confidencePct,
    saferConfigName,
    configAStats,
    configBStats,
    topFailureModes,
    whyBullets,
    whatItMeans,
    lowSample,
    topPromptFamilies,
    topHotspots,
  } = content;

  // —— Header ——
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

  // —— Recommendation & rationale ——
  y = drawSectionHeader(doc, y, "Recommendation");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(
    saferConfigName ? `We recommend ${saferConfigName} for production.` : "No clear recommendation from this run.",
    MARGIN,
    y + 6
  );
  y += 12;

  if (whyBullets.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textMuted);
    doc.text("Why we recommend this configuration:", MARGIN, y + 4);
    y += 10;
    doc.setTextColor(...COLORS.text);
    for (const bullet of whyBullets) {
      const lines = wrapText(doc, bullet, CONTENT_WIDTH - 10, 9);
      doc.text("•", MARGIN, y + 4);
      for (const line of lines) {
        doc.text(line, MARGIN + 6, y + 4);
        y += LINE_HEIGHT;
      }
      y += 2;
    }
    y += 2;
  }

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textMuted);
  doc.text("What this means:", MARGIN, y + 4);
  y += 6;
  doc.setTextColor(...COLORS.text);
  const whatLines = wrapText(doc, whatItMeans, CONTENT_WIDTH - 4, 9);
  for (const line of whatLines) {
    doc.text(line, MARGIN, y + 4);
    y += LINE_HEIGHT;
  }
  y += 6;

  // —— Executive summary (one-line) ——
  y = drawSectionHeader(doc, y, "Executive summary");
  const summaryLines = wrapText(doc, summary, CONTENT_WIDTH - 8, 10);
  const summaryBoxHeight = Math.max(18, summaryLines.length * LINE_HEIGHT + 10);
  doc.setFillColor(...COLORS.accentLight);
  doc.rect(MARGIN, y, CONTENT_WIDTH, summaryBoxHeight, "F");
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, y, CONTENT_WIDTH, summaryBoxHeight, "S");
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(10);
  let summaryY = y + 8;
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
    y += 14;
  }
  y += 4;

  // —— Reliability metrics ——
  y = ensureSpace(doc, y, 50);
  y = drawSectionHeader(doc, y + 2, "Reliability metrics");
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
  if (lowSample) {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(
      "Note: Fewer than 100 tests per config; consider a full run for higher confidence.",
      MARGIN,
      y + 4
    );
    y += 10;
  }
  y += 4;

  // —— Configurations compared ——
  const configTableHeaders = ["Parameter", "Config A", "Config B"];
  const configTableRows = [
    ["Model", configA.model, configB.model],
    ["Context window", `${configA.context_window} tokens`, `${configB.context_window} tokens`],
    ["Max output tokens", String(configA.max_output_tokens), String(configB.max_output_tokens)],
    ["Tools", configA.tools_enabled ? "Enabled" : "Disabled", configB.tools_enabled ? "Enabled" : "Disabled"],
    ["Temperature", String(configA.temperature), String(configB.temperature)],
    ["Cost per 1k tokens", `$${configA.cost_per_1k_tokens}`, `$${configB.cost_per_1k_tokens}`],
  ];
  const configTableColWidths = [48, 63, 63];
  const configTableHeight = 14 + (configTableRows.length + 1) * 8;
  y = ensureSpace(doc, y, configTableHeight);
  y = drawSectionHeader(doc, y + 2, "Configurations compared");
  y = drawTable(doc, y, configTableHeaders, configTableRows, configTableColWidths);
  y += 4;

  // —— Break-first timeline ——
  const breakPoints = timeline?.break_points ?? [];
  if (breakPoints.length > 0) {
    y = ensureSpace(doc, y, 15 + breakPoints.length * 14);
    y = drawSectionHeader(doc, y + 2, "Break-first timeline");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const sorted = [...breakPoints].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (const bp of sorted) {
      doc.setTextColor(...COLORS.text);
      const label = configLabel(bp.config_id, configA, configB);
      doc.text(
        `${label} broke at prompt ${bp.prompt_id} (${formatFailureMode(bp.failure_mode)}, ${bp.severity})`,
        MARGIN,
        y + 5
      );
      y += 12;
    }
    y += 4;
  }

  // —— Failure mode breakdown ——
  y = ensureSpace(doc, y, 30);
  y = drawSectionHeader(doc, y + 2, "Failure mode breakdown");
  if (topFailureModes.length > 0) {
    const maxCount = Math.max(...topFailureModes.map((m) => m.count), 1);
    const barStartX = MARGIN + 58;
    const barWidth = 58;
    const barEndX = barStartX + barWidth;
    doc.setFontSize(9);
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
    doc.setTextColor(...COLORS.textMuted);
    doc.text("No failure events in this run.", MARGIN, y + 5);
    y += 12;
  }
  y += 6;

  // —— Prompt family distribution ——
  const promptFamilySectionHeight = 14 + (topPromptFamilies.length > 0 ? topPromptFamilies.length * 8 + 4 : 14);
  y = ensureSpace(doc, y, promptFamilySectionHeight);
  y = drawSectionHeader(doc, y + 2, "Prompt family distribution");
  if (topPromptFamilies.length > 0) {
    doc.setFontSize(9);
    for (const { name, count } of topPromptFamilies) {
      doc.setTextColor(...COLORS.text);
      doc.text(name, MARGIN, y + 5);
      doc.setTextColor(...COLORS.textMuted);
      doc.text(String(count), MARGIN + 90, y + 5);
      y += 8;
    }
  } else {
    doc.setTextColor(...COLORS.textMuted);
    doc.text("No prompt family data.", MARGIN, y + 5);
    y += 10;
  }
  y += 4;

  // —— Failure hotspots (family × mode) ——
  if (topHotspots.length > 0) {
    y = ensureSpace(doc, y, 35);
    y = drawSectionHeader(doc, y + 2, "Failure hotspots (prompt family × failure mode)");
    const hotspotColWidths = [55, 55, 25];
    const hotspotHeaders = ["Prompt family", "Failure mode", "Count"];
    const hotspotRows = topHotspots.map((h) => [h.family, h.failure_mode, String(h.count)]);
    y = drawTable(doc, y, hotspotHeaders, hotspotRows, hotspotColWidths);
    y += 4;
  }

  // —— Footer (all pages) ——
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p);
  }

  const filename = `breakpoint-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
