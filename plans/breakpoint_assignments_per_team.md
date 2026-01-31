# BreakPoint Assignments Per Team

Assignments derived from the Problems PDF and MVP requirements allocation. Each section lists tasks for one team member with files and acceptance criteria.

---

## Person A — Chris (Runner + Rules Engineer)

**Role:** Runner + Rules Engineer  
**Focus:** Probe runner, rules engine, telemetry, simulation orchestration

### Task 5: Fix "Stuck at 90%" with Real LLMs (Existing)

- **Problem:** Progress bar stops at 90% and never completes in real LLM mode.
- **Root cause:** Client-side progress estimation only; no backend progress feedback.
- **Files:** `app/api/run-simulation/route.ts`, `src/lib/probe-runner.ts`, `app/page.tsx`
- **Subtasks:**
  1. Add optional progress callback to `runAllProbes()` with `{ completed, total }`.
  2. Improve client-side estimation (mode-based timing, dynamic increment, higher cap).
  3. Add timeout handling and user-facing error messages.
- **Done when:** Progress reaches 100% for simulate and real modes; timeouts handled gracefully.

### Problem 5: Only Latency Failures Detected (New)

- **Problem:** Simulation only triggers `latency_breach`; other 5 failure modes do not fire.
- **Target modes:** `context_overflow`, `silent_truncation_risk`, `cost_runaway`, `tool_timeout_risk`, `retrieval_noise_risk`.
- **Files:**
  - `src/lib/telemetry-estimator.ts` — generate diverse failure scenarios.
  - `src/lib/probe-runner.ts` — add logging for rule evaluation.
  - `src/lib/rules-engine.ts` — fix rule conditions if needed.
  - `app/api/run-simulation/route.ts` — confirm `getEnhancedRules(configs)` is used.
- **Subtasks:**
  1. Add logging in probe runner: per-result context usage, latency, cost, tool timeouts, and detected failure modes.
  2. Update telemetry estimator so simulated data can trigger each rule type (e.g., high context usage, overflow, tool timeouts, high cost).
  3. Add unit tests in `tests/rules-engine.test.ts` for all 6 failure modes.
- **Done when:** Runs can produce failures for all 6 categories; unit tests pass.

---

## Person B — Emil (Probability + Analytics Engineer)

**Role:** Probability + Analytics Engineer  
**Focus:** Failure rate math, CIs, comparisons, safer choice

### Task 2: Fix Incorrect Failure Rates (Completed)

- **Status:** Done. `totalTrials` from `computeTrialsPerConfig()` is passed to `runAnalysis()`; unit test E3 added.
- **Verify:** Run simulation and confirm failure rates match `k/n` (e.g., k=10, n=50 → 20%).

### Task 3a: Fix Confidence Interval Calculations (Completed)

- **Status:** Done. `ci_wilson` added to `ConfigStats` in `types/dashboard.ts`; integration test asserts CIs per config.
- **Verify:** CIs differ per config and narrow with larger n.

### Task 2b: Fix Safer Choice Percentage (Completed)

- **Status:** Done. ProbabilityCard display and Bayesian comparison verified; unit tests for B safer and similar configs added.
- **Verify:** When A has lower failure rate than B, safer choice favors A; swap configs flips percentage.

### Problem 1: Low Failure Rate Messaging (Follow-up)

- **Problem:** "1% of tests fail" feels unrealistic; no context for low rates.
- **Files:** `src/lib/probability.ts`, `src/lib/analysis.ts`
- **Subtasks:**
  1. Log actual `k/n` in simulation to confirm Task 2 behavior.
  2. Add validation/warning when `phat` is very low with small n (e.g., &lt; 1% and n &lt; 100).
  3. Optionally surface a “low sample” or “uncertain” flag for UI.
- **Done when:** Rates are correct; suspicious low rates are flagged or explained.

### Problem 3 & 4: Verification Only

- **Problem 3 (unrealistic failure rates):** Covered by Task 2; verify in production.
- **Problem 4 (safer choice explanation):** Logic fixed in Task 2b; UX tooltip is Yufei’s enhancement.

---

## Person C — Yufei (Frontend + Story Engineer)

**Role:** Frontend + Story Engineer  
**Focus:** UI, results summary, help, flip card, charts

### Task 1: Fix Horizontal Slider on Fast Flip (Existing)

- **Problem:** Horizontal slider appears when flipping or switching configs quickly.
- **Files:** `components/flip-card.tsx`
- **Subtasks:** Resolve CSS transform/overflow conflict; debounce flip; ensure `overflow: hidden` and `backface-visibility`.
- **Done when:** No slider on fast flip; animation stays smooth.

### Task 3b: Fix Confidence Band Display (Existing)

- **Problem:** Confidence band does not visually change with data.
- **Files:** `components/confidence-band.tsx`
- **Subtasks:** Fix data binding and re-render; Y-axis domain; React `key` on config change.
- **Done when:** Band widens/narrows with uncertainty; updates when config changes.

### Task 4: Add HELP Tab (Existing)

- **Files:** New `components/help-dialog.tsx`, `app/page.tsx`
- **Subtasks:** Dialog/Sheet with Getting Started, Config Options, Understanding Results; Help button (e.g. HelpCircle); optional `?`/F1.
- **Done when:** Help is reachable from main page and explains main features.

### Problem 2: Key Differences Need Better Explanation (New)

- **Problem:** “Key differences” is a bare list of params; no “why it matters” or impact on reliability.
- **Files:** `components/results-summary.tsx` (e.g. `getReasoning()`, lines 115–129).
- **Subtasks:**
  1. Add contextual copy per parameter (context_window, tools_enabled, top_k, temperature) and link to failure modes where relevant.
  2. Optional later: “Explain with AI” using new `/api/explain-results` (backend by Chris).
- **Done when:** Key differences section explains impact on reliability and failure types.

### Problem 1: Low Failure Rate Messaging (Follow-up)

- **Problem:** Same as Emil’s — UI must explain low rates and sample size.
- **Files:** `components/results-summary.tsx` (`getSummary()`).
- **Subtasks:**
  1. Show “X% failure rate (k out of n tests)” and add note for small n (e.g. &lt; 100).
  2. Differentiate “no failures” vs “very low rate.”
- **Done when:** Summary text gives clear, honest context for low failure rates.

### Problem 4 Enhancement: Safer Choice Tooltip (New)

- **Problem:** Users don’t know how “safer choice” is calculated.
- **Files:** `components/probability-card.tsx`
- **Subtasks:** Add help icon + tooltip describing Bayesian comparison (e.g. “probability that X has lower failure rate than Y based on Beta distributions” and “&gt;90% = strong confidence”).
- **Done when:** One click/hover explains the safer choice metric.

---

## Summary Table

| Owner   | Tasks                                                                 | Priority  |
|--------|-----------------------------------------------------------------------|-----------|
| **Chris**  | Task 5 (90% stuck), Problem 5 (all failure modes)                       | High      |
| **Emil**   | Task 2/3a/2b verify, Problem 1 (low-rate validation)                   | Low/Verify|
| **Yufei**  | Task 1 (flip), Task 3b (CI display), Task 4 (HELP), Problem 2 (key differences), Problem 1 (messaging), Problem 4 (tooltip) | Medium–High |

---

## Priority Order

1. **High (this sprint):** Chris — Problem 5 (all failure modes); Chris — Task 5 (90% stuck); Yufei — Problem 2 (key differences).
2. **Medium:** Yufei — Task 1, Task 3b, Task 4; Yufei — Problem 4 tooltip.
3. **Low / Verify:** Emil — Problem 1 validation; Emil — confirm Task 2/3a/2b in production.

---

## Key Files by Team

| Team   | Primary files                                                                 |
|--------|-------------------------------------------------------------------------------|
| Chris  | `app/api/run-simulation/route.ts`, `src/lib/probe-runner.ts`, `src/lib/telemetry-estimator.ts`, `src/lib/rules-engine.ts` |
| Emil   | `src/lib/probability.ts`, `src/lib/statistics.ts`, `src/lib/analysis.ts`, `types/dashboard.ts` |
| Yufei  | `components/results-summary.tsx`, `components/probability-card.tsx`, `components/confidence-band.tsx`, `components/flip-card.tsx`, `app/page.tsx` |
