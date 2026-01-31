# Person B: Probability + Analytics Engineer — Summary of Work

## Role

Person B owns the **probability and statistics layer**: per-config failure probabilities, uncertainty (95% CIs), safer-than comparisons, and distributions by failure mode and prompt family. Outputs feed Person C (UI) and the rest of the pipeline.

---

## What Was Done

### 1. Types (`src/types/index.ts`)

- **Stats** — Per-config stats: `config_id`, `k` (failures), `n` (trials), `phat` (k/n), optional `ci_bootstrap` and `ci_bayesian` (95% intervals).
- **AnalysisOutput** — `configs: Record<string, Stats>` for `analysis.json`.
- **ComparisonResult** / **ComparisonsOutput** — Pairwise “P(A safer than B)” for `comparisons.json`.
- **DistributionEntry** / **DistributionsOutput** — Counts and proportions by failure mode and by prompt family for `distributions.json`.

### 2. Probability Layer (`src/lib/probability.ts`)

- **estimatePhat(events, configId, totalTrials)** — Counts unique prompt runs that produced at least one failure for the config; returns `Stats` with k, n, phat. Uses `totalTrials` (e.g. prompts.length) so n is correct when not all runs fail.

### 3. Statistics Layer (`src/lib/statistics.ts`)

- **bootstrapCI(k, n, alpha)** — Bootstrap 95% CI for binomial p (default 1000 iterations).
- **bayesianBetaCI(k, n, alpha)** — Bayesian 95% credible interval with Beta(1,1) prior; posterior Beta(1+k, 1+n−k); 10000 samples.
- **compareConfigs(a, b)** — P(A safer than B) via posterior sampling (10000 samples); “safer” = lower failure rate.
- **setStatsSeed(s)** — Optional seeded RNG for deterministic tests.

### 4. Analysis Layer (`src/lib/analysis.ts`)

- **modeDistributions(events, prompts)** — Groups events by `failure_mode` and by prompt `family` (using prompt_id → family from prompts); returns counts and proportions.
- **runAnalysis(events, prompts)** — For each config in events: estimatePhat, then bootstrap and Bayesian CIs; returns `AnalysisOutput`.
- **runComparisons(statsList)** — All pairwise config comparisons; returns `ComparisonsOutput`.
- **runDistributions(events, prompts)** — Wrapper around modeDistributions; returns `DistributionsOutput`.

### 5. Test Fixture (`tests/fixtures/failure-events.json`)

- Synthetic `FailureEvent[]`: configs A and B, multiple failure modes and severities, so the pipeline and tests run without Person A’s probe output.

### 6. CLI (`src/cli/run-analysis.ts`)

- Loads failure events from `output/failure-events.json` or, if missing, `tests/fixtures/failure-events.json`.
- Loads prompts from `data/prompts/prompt-suite.json`.
- Runs analysis, comparisons, and distributions; writes:
  - **output/analysis.json** — Per-config stats with CIs.
  - **output/comparisons.json** — Pairwise P(A safer than B).
  - **output/distributions.json** — By failure mode and by prompt family.
- Handles missing inputs and empty events with clear messages.

### 7. Tests (`tests/statistics.test.ts`)

- **estimatePhat** — Normal case, empty events, zero failures.
- **bootstrapCI** — Normal, k=0, k=n, n=1, n=0.
- **bayesianBetaCI** — Normal, k=0, k=n, n=0.
- **compareConfigs** — A safer than B, equal configs, edge cases.
- **modeDistributions** — Structure and proportions.
- **Integration** — Full pipeline (runAnalysis, runComparisons, runDistributions) on fixture data.

### 8. Scripts (`package.json`)

- **npm run analyze** — Runs Person B analysis CLI (`tsx src/cli/run-analysis.ts`).
- **npm run test:statistics** — Runs Person B statistics tests (`tsx tests/statistics.test.ts`).

---

## Inputs and Outputs

| Consumes | Provides |
|----------|----------|
| `failure-events.json` (from Person A or fixture) | `analysis.json` |
| `data/prompts/prompt-suite.json` | `comparisons.json` |
| | `distributions.json` |

---

## File Layout

```
src/
  lib/
    probability.ts   # estimatePhat
    statistics.ts    # bootstrapCI, bayesianBetaCI, compareConfigs
    analysis.ts      # modeDistributions, runAnalysis, runComparisons, runDistributions
  cli/
    run-analysis.ts  # CLI entry
  types/
    index.ts        # + Stats, AnalysisOutput, ComparisonsOutput, DistributionsOutput
tests/
  fixtures/
    failure-events.json
  statistics.test.ts
```

---

## Still To Do (from role / plan)

- Edge cases: zero events, n=1; explicit fallbacks in CLI/docs.
- Optional: **prompt-family.json** (family-level aggregation).
- Schema docs for analysis.json, comparisons.json, distributions.json.
- Align with Person C on visualization shapes.
- Final QA with Person A’s real datasets and feature freeze.
