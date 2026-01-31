# Wow Features: Easiest to Most Difficult

Implementation order from **quick wins** to **larger builds**. Each feature reuses the same demo flow: Config A vs B, Run Simulation, then the new surface.

---

## 1. One-sentence recommendation (Easiest)

**Effort:** ~30 min  
**Scope:** Frontend only. Data already exists in `components/results-summary.tsx`: `getSummary()`, `saferConfig`, `confidence`, `currentComparison`.

- Add a **prominent banner** at the top of the results column (e.g. above `ResultsSummary`) that shows a single line: *"We recommend **Config B** for production — 87% chance it's safer."*
- Derive the sentence from `comparisonsData` (e.g. `p_a_safer`) and `analysisData`; optionally mention cost if both configs have `cost_per_1k_tokens`.
- Reuse the same logic already in `ResultsSummary` (which config is safer, confidence) so there is one source of truth.

**Deliverable:** One new component (e.g. `RecommendationBanner`) or a dedicated first row in the results section; no API changes.

---

## 2. Big confidence gauge (Easiest)

**Effort:** ~45 min  
**Scope:** Frontend only. Input: `p_a_safer` (or equivalent) from `comparisonsData` for the current config pair.

- Add a **single prominent gauge** (arc or radial) showing: *"Confidence that [Config B] is safer: 87%"* (or Config A when `p_a_safer > 0.5`).
- Place it in the middle column near the traffic light or at the top of the results area so it's the main takeaway.
- Implementation: simple SVG arc or use an existing UI primitive (e.g. `components/ui/progress.tsx` styled as a semicircle, or a small library). No new API or types.

**Deliverable:** One component (e.g. `ConfidenceGauge`) receiving `comparisonsData` and `configA`/`configB`; wire into `app/page.tsx`.

---

## 3. Break-first timeline (Easy)

**Effort:** ~1–2 hrs  
**Scope:** Frontend + wire existing API. `app/api/run-simulation/route.ts` already returns `timeline` (from `src/lib/timeline.ts`); `app/page.tsx` does **not** store or use it.

- In `page.tsx`: add state for `timeline`; in the `runSimulation` success path, set `setTimeline(data.timeline)`.
- Add a dashboard type for the timeline (e.g. in `types/dashboard.ts`) matching `Timeline`: `{ configs: Record<string, BreakPoint[]>, break_points: BreakPoint[] }` (and `BreakPoint`: `config_id`, `prompt_id`, `failure_mode`, `severity`, `timestamp`).
- New component **BreakFirstTimeline**: render `break_points` (or per-config events from `timeline.configs`) as a horizontal timeline or list: "Config A broke at prompt X (context_overflow); Config B broke at prompt Y (latency_breach)."

**Deliverable:** Timeline state in `page.tsx`, one new component, optional type in `types/dashboard.ts`. No backend changes.

---

## 4. Failure hotspot matrix (Medium)

**Effort:** ~2–3 hrs  
**Scope:** Likely frontend + optional backend. Current `types/dashboard.ts` has `by_failure_mode` and `by_prompt_family` separately; no cross-tabulation (failure_mode × family).

- **Option A (frontend-only):** Build a simple 2D grid: rows = prompt families, columns = failure modes. Cells = counts. Requires a **combined distribution** — e.g. from `runDistributions` in `src/lib/analysis.ts` add a `by_failure_mode_and_family` (or similar) and return it from run-simulation; then the UI is a table/heatmap.
- **Option B:** Reuse existing distribution charts and add a small "hotspot" view that only shows the top N (family, mode) pairs by count, derived from event-level data. If events are not exposed to the client, Option A is cleaner.

**Deliverable:** Either extend run-simulation + analysis to return a cross-tabulated structure and add a heatmap/table component, or a simplified frontend-only "top hotspots" list from existing distributions.

---

## 5. What-if prompt checker (Medium)

**Effort:** ~2–4 hrs  
**Scope:** New API + UI. User pastes one prompt; app runs it through the same rules (or a single probe) and returns which failure modes would trigger.

- New route: e.g. `POST /api/check-prompt` with body `{ promptText: string, config: Config }`. Server loads one synthetic prompt (or uses the text as prompt_id placeholder), runs one probe (simulate or real), evaluates rules via `src/lib/rules-engine.ts`, returns `{ failure_modes: string[], pass: boolean, details }`.
- Frontend: small card with textarea + "Check" button; display result as "This prompt would trigger: context_overflow, latency_breach" or "No failures detected."

**Deliverable:** New API route, reuse probe-runner + rules-engine for a single prompt; one small form + result component on the dashboard.

---

## 6. Guided tour (Medium)

**Effort:** ~1–2 hrs  
**Scope:** Frontend only. Add a "Take a tour" entry point (e.g. in header next to Help).

- Use a lightweight library (e.g. `react-joyride`, `driver.js`, or `intro.js`) and define 4–6 steps: Config A/B cards → Run mode → Run Simulation → Traffic light → Results summary / recommendation → Confidence or timeline.
- Steps should reference existing DOM (cards, button, results section). No new data or API.

**Deliverable:** One dependency, one tour config component, one button/link to start the tour.

---

## 7. Export report (PDF or image) (Medium)

**Effort:** ~2–3 hrs  
**Scope:** Frontend. Snapshot current results into a downloadable report.

- Use `jsPDF` or `html2canvas` + `jspdf` to capture: recommendation line, confidence, key metrics (failure rates, comparison), and optionally a small table or chart.
- Trigger: "Download report" button in results area. Input: current `analysisData`, `comparisonsData`, `distributionsData`, and the recommendation string.

**Deliverable:** One "Export" button and a small export utility that builds a one-page PDF (or PNG) from current state.

---

## 8. Baseline comparison (Medium)

**Effort:** ~2–3 hrs  
**Scope:** Frontend + local persistence. Compare current run to a saved "baseline" run.

- On "Save as baseline": store in `localStorage` the last `analysis`, `comparisons`, `distributions`, and config ids (and optionally timeline).
- On "Compare to baseline": load baseline from `localStorage`, then show a small comparison: "Current run: Config B 87% safer; Baseline: Config A 52% safer" or "Failure rate improved by 12% vs baseline."

**Deliverable:** Save/Load baseline actions, optional Compare-to-baseline view or banner when baseline exists.

---

## 9. Cost vs. reliability trade-off (Harder)

**Effort:** ~4–6 hrs  
**Scope:** Backend + frontend. Interactive control: e.g. "If I allow 2× cost, how much does failure rate change?"

- Either: (a) re-run analysis with a different cost threshold and show the new comparison, or (b) precompute bands (e.g. by cost bucket) and let a slider filter which configs or scenarios are shown. (a) requires run-simulation to accept a cost multiplier or threshold and re-evaluate rules; (b) requires storing or computing multiple scenarios.
- UI: slider or selector ("Allow up to 2× cost") and update recommendation or comparison text. Clarify with product whether this is "same configs, different cost tolerance" or "different configs by cost band."

**Deliverable:** New or extended API for cost-adjusted view, plus slider/selector and updated summary/gauge.

---

## 10. Streaming probe progress (Hardest)

**Effort:** ~6–8 hrs  
**Scope:** Backend + frontend. Show live probe-by-probe (or batch) results during a run instead of a single progress bar.

- Backend: Change `app/api/run-simulation/route.ts` to stream (e.g. Server-Sent Events or chunked transfer). After each probe (or every N probes), push a message: `{ type: "probe", index, total, config_id, prompt_id, passed, failure_modes }`. Final message: full `analysis`, `comparisons`, `distributions`, `timeline`.
- Frontend: Replace the single progress bar with an `EventSource` or `fetch` + stream reader; update UI with a live log or mini-timeline ("Probe 12/40 — Config A: pass, Config B: fail — context_overflow") and then swap to full results when stream ends.

**Deliverable:** Streaming run-simulation API, frontend stream consumer, and a live progress/results component.

---

## Suggested order for tomorrow

| Priority   | Feature                  | Reason                                        |
| ---------- | ------------------------ | --------------------------------------------- |
| Do first   | 1. Recommendation banner | Fast, high impact, no new data                |
| Do second  | 2. Confidence gauge      | Fast, very quotable in a demo                 |
| Do third   | 3. Break-first timeline  | API already returns it; one new component     |
| If time    | 6. Guided tour           | Great for walking the audience through the UI |

Skip for round two unless you have extra time: 4 (hotspot matrix), 5 (what-if), 7 (export), 8 (baseline), 9 (cost trade-off), 10 (streaming).
