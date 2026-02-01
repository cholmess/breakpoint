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
import {
  TEXT_DICTIONARY,
  type TextKey,
  getFailureModeLabel as getFailureModeLabelDict,
  getFailureModeDescription as getFailureModeDescriptionDict,
  getFailureModeRemediation,
} from "@/lib/text-dictionary";

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

function getT(
  key: TextKey,
  isPlain: boolean,
  params?: Record<string, string | number>
): string {
  const entry = TEXT_DICTIONARY[key];
  if (!entry) return String(key);
  let str: string = isPlain ? entry.plain : entry.technical;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

function configLabel(
  configId: string,
  configA: Config,
  configB: Config,
  isPlain: boolean
): string {
  const a = getT("config_a", isPlain);
  const b = getT("config_b", isPlain);
  return configId === configA.id ? a : configId === configB.id ? b : configId;
}

interface ConfigStatsExtended {
  phat: number;
  k: number;
  n: number;
  ci_wilson?: [number, number];
  ci_bayesian?: [number, number];
}

interface FailureModeDetail {
  name: string;
  key: string;
  count: number;
  proportion: number;
  severity: "HIGH" | "MED";
}

interface ReportContent {
  summary: string;
  confidencePct: number;
  saferConfigName: string | null;
  configAStats: ConfigStatsExtended | null;
  configBStats: ConfigStatsExtended | null;
  topFailureModes: { name: string; count: number }[];
  failureModeDetails: FailureModeDetail[];
  whyBullets: string[];
  whatItMeans: string;
  lowSample: boolean;
  topPromptFamilies: { name: string; count: number }[];
  topHotspots: { family: string; failure_mode: string; count: number }[];
  totalFailures: number;
  highSeverityCount: number;
  medSeverityCount: number;
}

function getReportContent(
  analysisData: AnalysisData | null,
  comparisonsData: ComparisonsData | null,
  distributionsData: DistributionsData | null,
  configA: Config,
  configB: Config,
  isPlainLanguage: boolean
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

  const configALabel = getT("config_a", isPlainLanguage);
  const configBLabel = getT("config_b", isPlainLanguage);

  let summary: string;
  if (!currentComparison || !configAStatsRaw || !configBStatsRaw) {
    summary = getT("run_simulation_to_see", isPlainLanguage);
  } else if (pValue === 0.5) {
    summary = getT("both_similar_failure_rates", isPlainLanguage);
  } else {
    const saferName = saferConfig === configA ? configALabel : configBLabel;
    const otherName = saferConfig === configA ? configBLabel : configALabel;
    const saferRatePct = (saferConfig === configA ? configAStatsRaw.phat : configBStatsRaw.phat) * 100;
    const otherRatePct = (saferConfig === configA ? configBStatsRaw.phat : configAStatsRaw.phat) * 100;
    const saferRateStr = saferRatePct.toFixed(1);
    const otherRateStr = otherRatePct.toFixed(1);
    if (confidence > 0.7) {
      summary = getT("summary_significantly_more_reliable", isPlainLanguage, {
        saferName,
        otherName,
        saferRate: saferRateStr,
        otherRate: otherRateStr,
      });
    } else if (confidence > 0.5) {
      summary = getT("summary_appears_more_reliable", isPlainLanguage, {
        saferName,
        saferRate: saferRateStr,
        otherRate: otherRateStr,
      });
    } else {
      summary = getT("summary_quite_similar", isPlainLanguage, {
        saferName,
        saferRate: saferRateStr,
        otherRate: otherRateStr,
      });
    }
  }

  const saferConfigName = saferConfig === configA ? configALabel : saferConfig === configB ? configBLabel : null;
  const configAStats: ConfigStatsExtended | null =
    configAStatsRaw != null
      ? {
          phat: configAStatsRaw.phat,
          k: configAStatsRaw.k,
          n: configAStatsRaw.n,
          ci_wilson: configAStatsRaw.ci_wilson,
          ci_bayesian: configAStatsRaw.ci_bayesian,
        }
      : null;
  const configBStats: ConfigStatsExtended | null =
    configBStatsRaw != null
      ? {
          phat: configBStatsRaw.phat,
          k: configBStatsRaw.k,
          n: configBStatsRaw.n,
          ci_wilson: configBStatsRaw.ci_wilson,
          ci_bayesian: configBStatsRaw.ci_bayesian,
        }
      : null;

  const byMode = distributionsData?.by_failure_mode ?? {};
  const allModeEntries = Object.values(byMode).filter((e) => e.failure_mode != null);
  const topFailureModes = allModeEntries
    .map((e) => ({
      name: getFailureModeLabelDict(e.failure_mode as string, isPlainLanguage),
      count: e.count ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Severity mapping for failure modes
  const highSeverityModes = ["context_overflow", "cost_runaway", "tool_timeout_risk"];
  const totalFailures = allModeEntries.reduce((sum, e) => sum + (e.count ?? 0), 0);

  const failureModeDetails: FailureModeDetail[] = allModeEntries
    .map((e) => ({
      name: getFailureModeLabelDict(e.failure_mode as string, isPlainLanguage),
      key: e.failure_mode as string,
      count: e.count ?? 0,
      proportion: e.proportion ?? (totalFailures > 0 ? (e.count ?? 0) / totalFailures : 0),
      severity: (highSeverityModes.includes(e.failure_mode as string) ? "HIGH" : "MED") as "HIGH" | "MED",
    }))
    .sort((a, b) => {
      // Sort by severity first (HIGH first), then by count
      if (a.severity !== b.severity) return a.severity === "HIGH" ? -1 : 1;
      return b.count - a.count;
    });

  const highSeverityCount = failureModeDetails
    .filter((f) => f.severity === "HIGH")
    .reduce((sum, f) => sum + f.count, 0);
  const medSeverityCount = failureModeDetails
    .filter((f) => f.severity === "MED")
    .reduce((sum, f) => sum + f.count, 0);

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
      failure_mode: getFailureModeLabelDict(h.failure_mode || "", isPlainLanguage),
      count: h.count ?? 0,
    }));

  const whyBullets: string[] = [];
  const lowSample = Boolean(configAStatsRaw?.low_sample_warning || configBStatsRaw?.low_sample_warning);

  if (saferConfigName && configAStats && configBStats) {
    const saferName = saferConfigName;
    const otherName = saferConfigName === configALabel ? configBLabel : configALabel;
    const saferRate = saferConfigName === configALabel ? configAStats.phat : configBStats.phat;
    const otherRate = saferConfigName === configALabel ? configBStats.phat : configAStats.phat;
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
      const modeName = getFailureModeLabelDict(mostCommon.failure_mode as string, isPlainLanguage);
      whyBullets.push(
        `Most common issue: ${modeName} (${mostCommon.count ?? 0} of ${totalFailures} events); ${saferName} performed better overall.`
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
        whyBullets.push(`${saferName} ${getT("cheaper_per_1k", isPlainLanguage)}`);
      } else if (configA.cost_per_1k_tokens === configB.cost_per_1k_tokens) {
        whyBullets.push(getT("same_cost_1k", isPlainLanguage));
      }
    }
  }

  let whatItMeans = "Use the recommended configuration in production for better reliability.";
  if (saferConfigName && configAStats && configBStats) {
    const rateDiffPct = Math.abs((configAStats.phat - configBStats.phat) * 100);
    if (lowSample) {
      whatItMeans = getT("use_for_production_if_satisfied", isPlainLanguage, { name: saferConfigName });
    } else {
      whatItMeans = getT("use_in_production_reliability", isPlainLanguage, {
        name: saferConfigName,
        rateDiff: rateDiffPct.toFixed(1),
        confidence: String(confidencePct),
      });
    }
  }

  return {
    summary,
    confidencePct,
    saferConfigName,
    configAStats,
    configBStats,
    topFailureModes,
    failureModeDetails,
    whyBullets,
    whatItMeans,
    lowSample,
    topPromptFamilies,
    topHotspots,
    totalFailures,
    highSeverityCount,
    medSeverityCount,
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
  timeline?: Timeline | null,
  isPlainLanguage: boolean = false
): void {
  const doc = new jsPDF();
  let y = 0;

  const content = getReportContent(
    analysisData,
    comparisonsData,
    distributionsData,
    configA,
    configB,
    isPlainLanguage
  );
  const {
    summary,
    confidencePct,
    saferConfigName,
    configAStats,
    configBStats,
    topFailureModes,
    failureModeDetails,
    whyBullets,
    whatItMeans,
    lowSample,
    topPromptFamilies,
    topHotspots,
    totalFailures,
    highSeverityCount,
    medSeverityCount,
  } = content;

  const configALabel = getT("config_a", isPlainLanguage);
  const configBLabel = getT("config_b", isPlainLanguage);

  // —— Header ——
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, PAGE_WIDTH, 28, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("BreakPoint", MARGIN, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(getT("report_subtitle", isPlainLanguage), MARGIN, 22);
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(`Generated ${new Date().toLocaleString()}`, PAGE_WIDTH - MARGIN, 22, { align: "right" });
  y = 36;

  // —— Recommendation & rationale ——
  y = drawSectionHeader(doc, y, getT("recommendation", isPlainLanguage));
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(
    saferConfigName
      ? getT("we_recommend_for_production_pdf", isPlainLanguage, { name: saferConfigName })
      : getT("no_clear_recommendation", isPlainLanguage),
    MARGIN,
    y + 6
  );
  y += 12;

  if (whyBullets.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textMuted);
    doc.text(getT("why_recommend_this_config", isPlainLanguage), MARGIN, y + 4);
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
  doc.text(getT("what_this_means_colon", isPlainLanguage), MARGIN, y + 4);
  y += 6;
  doc.setTextColor(...COLORS.text);
  const whatLines = wrapText(doc, whatItMeans, CONTENT_WIDTH - 4, 9);
  for (const line of whatLines) {
    doc.text(line, MARGIN, y + 4);
    y += LINE_HEIGHT;
  }
  y += 6;

  // —— Executive summary (one-line) ——
  y = drawSectionHeader(doc, y, getT("executive_summary", isPlainLanguage));
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
    doc.text(
      getT("confidence_that_safer", isPlainLanguage, { name: saferConfigName }),
      MARGIN + 60,
      y + 7
    );
    y += 14;
  }
  y += 4;

  // —— Reliability metrics (with confidence intervals) ——
  y = ensureSpace(doc, y, 60);
  y = drawSectionHeader(doc, y + 2, getT("reliability_metrics", isPlainLanguage));
  const tableColWidths = [38, 32, 48, 28, 28];
  const tableHeaders = [
    getT("table_configuration", isPlainLanguage),
    getT("table_failure_rate", isPlainLanguage),
    getT("table_ci_95", isPlainLanguage),
    getT("table_failures", isPlainLanguage),
    getT("table_tests", isPlainLanguage),
  ];
  const tableRows: string[][] = [];
  if (configAStats != null) {
    const ci = configAStats.ci_wilson;
    const ciStr = ci
      ? `${(ci[0] * 100).toFixed(1)}% – ${(ci[1] * 100).toFixed(1)}%`
      : "N/A";
    tableRows.push([
      configALabel,
      `${(configAStats.phat * 100).toFixed(1)}%`,
      ciStr,
      String(configAStats.k),
      String(configAStats.n),
    ]);
  }
  if (configBStats != null) {
    const ci = configBStats.ci_wilson;
    const ciStr = ci
      ? `${(ci[0] * 100).toFixed(1)}% – ${(ci[1] * 100).toFixed(1)}%`
      : "N/A";
    tableRows.push([
      configBLabel,
      `${(configBStats.phat * 100).toFixed(1)}%`,
      ciStr,
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
    doc.text(getT("note_low_sample", isPlainLanguage), MARGIN, y + 4);
    y += 10;
  }
  y += 4;

  // —— Risk Assessment (Severity Breakdown) ——
  if (totalFailures > 0) {
    y = ensureSpace(doc, y, 50);
    y = drawSectionHeader(doc, y + 2, getT("risk_assessment", isPlainLanguage));
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(getT("risk_assessment_desc", isPlainLanguage), MARGIN, y + 4);
    y += 10;

    // Draw severity bars
    const severityData = [
      { label: getT("high_severity_failures", isPlainLanguage), count: highSeverityCount, color: [220, 38, 38] as [number, number, number] },
      { label: getT("medium_severity_failures", isPlainLanguage), count: medSeverityCount, color: [251, 191, 36] as [number, number, number] },
    ];
    const maxSeverity = Math.max(highSeverityCount, medSeverityCount, 1);
    const barStartX = MARGIN + 50;
    const barWidth = 70;
    
    for (const { label, count, color } of severityData) {
      doc.setTextColor(...COLORS.text);
      doc.setFontSize(9);
      doc.text(label, MARGIN, y + 5);
      const w = (count / maxSeverity) * barWidth;
      doc.setFillColor(240, 240, 240);
      doc.rect(barStartX, y - 1, barWidth, 6, "F");
      doc.setFillColor(...color);
      doc.rect(barStartX, y - 1, w, 6, "F");
      doc.setTextColor(...COLORS.textMuted);
      doc.text(`${count} (${totalFailures > 0 ? ((count / totalFailures) * 100).toFixed(0) : 0}%)`, barStartX + barWidth + 4, y + 5);
      y += 12;
    }
    
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(8);
    doc.text(`Total failure events: ${totalFailures}`, MARGIN, y + 4);
    y += 10;
  }
  y += 4;

  // —— Configurations compared ——
  const configTableHeaders = [
    getT("table_parameter", isPlainLanguage),
    configALabel,
    configBLabel,
  ];
  const configTableRows = [
    [getT("label_model", isPlainLanguage), configA.model, configB.model],
    [
      getT("label_context_window", isPlainLanguage),
      `${configA.context_window.toLocaleString()} tokens`,
      `${configB.context_window.toLocaleString()} tokens`,
    ],
    [
      getT("label_max_output", isPlainLanguage),
      `${configA.max_output_tokens.toLocaleString()} tokens`,
      `${configB.max_output_tokens.toLocaleString()} tokens`,
    ],
    [
      getT("label_tools", isPlainLanguage),
      configA.tools_enabled ? getT("tools_enabled", isPlainLanguage) : getT("tools_disabled", isPlainLanguage),
      configB.tools_enabled ? getT("tools_enabled", isPlainLanguage) : getT("tools_disabled", isPlainLanguage),
    ],
    [getT("label_temperature", isPlainLanguage), String(configA.temperature), String(configB.temperature)],
    [
      getT("label_cost_per_1k", isPlainLanguage),
      `$${configA.cost_per_1k_tokens}`,
      `$${configB.cost_per_1k_tokens}`,
    ],
    [getT("label_top_k", isPlainLanguage), String(configA.top_k), String(configB.top_k)],
    [
      getT("label_chunk_size", isPlainLanguage),
      `${configA.chunk_size.toLocaleString()} tokens`,
      `${configB.chunk_size.toLocaleString()} tokens`,
    ],
  ];
  const configTableColWidths = [48, 63, 63];
  const configTableHeight = 14 + (configTableRows.length + 1) * 8;
  y = ensureSpace(doc, y, configTableHeight);
  y = drawSectionHeader(doc, y + 2, getT("configurations_compared", isPlainLanguage));
  y = drawTable(doc, y, configTableHeaders, configTableRows, configTableColWidths);
  y += 4;

  // —— Break-first timeline ——
  const breakPoints = timeline?.break_points ?? [];
  if (breakPoints.length > 0) {
    y = ensureSpace(doc, y, 15 + breakPoints.length * 14);
    y = drawSectionHeader(doc, y + 2, getT("break_first_timeline", isPlainLanguage));
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const sorted = [...breakPoints].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (const bp of sorted) {
      doc.setTextColor(...COLORS.text);
      const label = configLabel(bp.config_id, configA, configB, isPlainLanguage);
      const modeLabel = getFailureModeLabelDict(bp.failure_mode, isPlainLanguage);
      doc.text(
        `${label} ${getT("broke_at_prompt", isPlainLanguage)} ${bp.prompt_id} (${modeLabel}, ${bp.severity})`,
        MARGIN,
        y + 5
      );
      y += 12;
    }
    y += 4;
  }

  // —— Failure mode breakdown ——
  y = ensureSpace(doc, y, 30);
  y = drawSectionHeader(doc, y + 2, getT("failure_mode_breakdown_section", isPlainLanguage));
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
    doc.text(getT("no_failure_events_run", isPlainLanguage), MARGIN, y + 5);
    y += 12;
  }
  y += 6;

  // —— Prompt family distribution ——
  const promptFamilySectionHeight = 14 + (topPromptFamilies.length > 0 ? topPromptFamilies.length * 8 + 4 : 14);
  y = ensureSpace(doc, y, promptFamilySectionHeight);
  y = drawSectionHeader(doc, y + 2, getT("prompt_family_distribution_section", isPlainLanguage));
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
    doc.text(getT("no_prompt_family_data_run", isPlainLanguage), MARGIN, y + 5);
    y += 10;
  }
  y += 4;

  // —— Failure hotspots (family × mode) ——
  if (topHotspots.length > 0) {
    const hotspotColWidths = [55, 55, 25];
    const hotspotHeaders = [
      getT("table_prompt_family", isPlainLanguage),
      getT("table_failure_mode", isPlainLanguage),
      getT("count", isPlainLanguage),
    ];
    const hotspotRows = topHotspots.map((h) => [h.family, h.failure_mode, String(h.count)]);
    // Calculate actual space needed: section header (12) + table header (8) + rows (8 each) + padding (10)
    const hotspotTableHeight = 12 + 8 + (hotspotRows.length * 8) + 10;
    y = ensureSpace(doc, y, hotspotTableHeight);
    y = drawSectionHeader(doc, y + 2, getT("failure_hotspots_section", isPlainLanguage));
    y = drawTable(doc, y, hotspotHeaders, hotspotRows, hotspotColWidths);
    y += 4;
  }

  // —— Failure Mode Definitions ——
  if (failureModeDetails.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionHeader(doc, y + 2, getT("failure_definitions", isPlainLanguage));
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(getT("failure_definitions_desc", isPlainLanguage), MARGIN, y + 4);
    y += 10;

    for (const mode of failureModeDetails.slice(0, 6)) {
      y = ensureSpace(doc, y, 28);
      
      // Mode name with severity badge
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.text);
      doc.text(mode.name, MARGIN, y + 4);
      
      // Severity badge
      const badgeX = MARGIN + doc.getTextWidth(mode.name) + 4;
      const badgeColor = mode.severity === "HIGH" ? [220, 38, 38] as [number, number, number] : [251, 191, 36] as [number, number, number];
      doc.setFillColor(...badgeColor);
      doc.roundedRect(badgeX, y - 1, 18, 6, 1, 1, "F");
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.text(mode.severity, badgeX + 3, y + 3);
      
      y += 8;
      
      // Description
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      const description = getFailureModeDescriptionDict(mode.key, mode.count, mode.proportion, isPlainLanguage);
      const descLines = wrapText(doc, description, CONTENT_WIDTH - 8, 8);
      for (const line of descLines) {
        doc.text(line, MARGIN + 4, y + 3);
        y += 5;
      }
      y += 4;
    }
  }

  // —— Remediation Recommendations ——
  if (failureModeDetails.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionHeader(doc, y + 2, getT("remediation_recommendations", isPlainLanguage));
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(getT("remediation_recommendations_desc", isPlainLanguage), MARGIN, y + 4);
    y += 10;

    // Show remediation for top 4 most impactful failure modes
    const topImpact = failureModeDetails.slice(0, 4);
    for (const mode of topImpact) {
      y = ensureSpace(doc, y, 20);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.text);
      doc.text(`${mode.name}:`, MARGIN, y + 4);
      y += 7;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      const remediation = getFailureModeRemediation(mode.key, isPlainLanguage);
      const remLines = wrapText(doc, remediation, CONTENT_WIDTH - 12, 8);
      for (const line of remLines) {
        doc.text(`• ${line}`, MARGIN + 4, y + 3);
        y += 5;
      }
      y += 4;
    }
  }

  // —— Test Coverage Summary ——
  y = ensureSpace(doc, y, 40);
  y = drawSectionHeader(doc, y + 2, getT("test_coverage", isPlainLanguage));
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(getT("test_coverage_desc", isPlainLanguage), MARGIN, y + 4);
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  const totalTests = (configAStats?.n ?? 0) + (configBStats?.n ?? 0);
  doc.text(`${getT("total_tests_run", isPlainLanguage)}: ${totalTests}`, MARGIN, y + 4);
  y += 8;
  doc.text(`${getT("prompt_families_tested", isPlainLanguage)}: ${topPromptFamilies.length}`, MARGIN, y + 4);
  y += 8;
  doc.text(`${getT("failure_events_detected", isPlainLanguage)}: ${totalFailures}`, MARGIN, y + 4);
  y += 12;

  // —— Footer (all pages) ——
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p);
  }

  const filename = `breakpoint-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
