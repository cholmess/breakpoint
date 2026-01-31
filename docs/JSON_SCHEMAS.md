# Person B: JSON output schemas (for Person C / Frontend)

Person B’s analysis pipeline writes three JSON files to `output/`. Use these schemas to load and render the dashboard, failure-rate bands, and safer-than comparisons.

**How to generate:** From repo root, run `npm run analyze`. Inputs: `output/failure-events.json` (or `tests/fixtures/failure-events.json`) and `data/prompts/prompt-suite.json`.

**Output location:** `output/analysis.json`, `output/comparisons.json`, `output/distributions.json`

---

## 1. `analysis.json` — Per-config failure stats and CIs

**Purpose:** Failure rate (p̂) and 95% confidence intervals per config for the dashboard (failure rate + confidence band).

**Root type:** Object with a single key `configs`.

| Field     | Type   | Description |
|----------|--------|-------------|
| `configs`| object | Keys = `config_id` (string). Values = `Stats` (see below). |

**Stats** (per config):

| Field           | Type     | Required | Description |
|-----------------|----------|----------|-------------|
| `config_id`     | string   | yes      | Config identifier (e.g. `"A"`, `"B"`). |
| `k`             | number   | yes      | Number of prompts that had at least one failure. |
| `n`             | number   | yes      | Total number of probe runs (trials) for this config. |
| `phat`          | number   | yes      | Failure probability estimate = `k / n`. In `[0, 1]`. |
| `ci_bootstrap`  | [number, number] | no  | 95% bootstrap CI: `[lower, upper]`, each in `[0, 1]`. |
| `ci_bayesian`   | [number, number] | no  | 95% Bayesian (Beta) credible interval: `[lower, upper]`, each in `[0, 1]`. |

**Example:**

```json
{
  "configs": {
    "A": {
      "config_id": "A",
      "k": 3,
      "n": 10,
      "phat": 0.3,
      "ci_bootstrap": [0.08, 0.55],
      "ci_bayesian": [0.10, 0.53]
    },
    "B": {
      "config_id": "B",
      "k": 7,
      "n": 10,
      "phat": 0.7,
      "ci_bootstrap": [0.42, 0.92],
      "ci_bayesian": [0.44, 0.90]
    }
  }
}
```

**Edge cases:**

- No failure events → `configs` is `{}`.
- When present, `ci_bootstrap` and `ci_bayesian` are always length-2 arrays; use them for the “failure confidence band” in the UI.

---

## 2. `comparisons.json` — Pairwise “safer than” probabilities

**Purpose:** For each pair of configs (A, B), the probability that config A has a lower failure rate than config B (P(A safer than B)). Use for “safer-than” widget / comparison cards.

**Root type:** Object with a single key `comparisons`.

| Field          | Type   | Description |
|----------------|--------|-------------|
| `comparisons`  | array  | List of comparison results (see below). |

**Comparison result** (one per unordered pair):

| Field        | Type   | Description |
|--------------|--------|-------------|
| `config_a`   | string | First config id (e.g. `"A"`). |
| `config_b`   | string | Second config id (e.g. `"B"`). |
| `p_a_safer`  | number | P(config A has lower failure rate than config B). In `[0, 1]`. |

**Example:**

```json
{
  "comparisons": [
    { "config_a": "A", "config_b": "B", "p_a_safer": 0.92 },
    { "config_a": "A", "config_b": "C", "p_a_safer": 0.15 },
    { "config_a": "B", "config_b": "C", "p_a_safer": 0.08 }
  ]
}
```

**Edge cases:**

- Zero or one config → `comparisons` is `[]`.
- When one or both configs have no data (n=0), `p_a_safer` is `0.5` (indeterminate). UI can show “N/A” or “indeterminate” in that case.

---

## 3. `distributions.json` — Breakdowns by failure mode and prompt family

**Purpose:** Counts and proportions by failure mode and by prompt family for distribution charts (e.g. bar/pie charts).

**Root type:** Object with two keys.

| Field               | Type   | Description |
|---------------------|--------|-------------|
| `by_failure_mode`   | object | Keys = failure mode string. Values = `DistributionEntry` with `failure_mode` + `count` + `proportion`. |
| `by_prompt_family`  | object | Keys = family name string. Values = `DistributionEntry` with `family` + `count` + `proportion`. |

**DistributionEntry** (used in both maps):

| Field          | Type   | Present in           | Description |
|----------------|--------|----------------------|-------------|
| `failure_mode` | string | `by_failure_mode` only | One of the `FailureMode` enum values below. |
| `family`       | string | `by_prompt_family` only | Prompt family name (e.g. `"short_plain"`, `"unknown"`). |
| `count`        | number | both                 | Number of failure events in this bucket. |
| `proportion`   | number | both                 | Share of total events; in `[0, 1]`. Sum of proportions over each map = 1. |

**FailureMode** (string enum):

- `"context_overflow"`
- `"silent_truncation_risk"`
- `"latency_breach"`
- `"cost_runaway"`
- `"tool_timeout_risk"`
- `"retrieval_noise_risk"`

**Example:**

```json
{
  "by_failure_mode": {
    "silent_truncation_risk": {
      "failure_mode": "silent_truncation_risk",
      "count": 4,
      "proportion": 0.25
    },
    "latency_breach": {
      "failure_mode": "latency_breach",
      "count": 8,
      "proportion": 0.5
    },
    "context_overflow": {
      "failure_mode": "context_overflow",
      "count": 4,
      "proportion": 0.25
    }
  },
  "by_prompt_family": {
    "short_plain": {
      "family": "short_plain",
      "count": 6,
      "proportion": 0.375
    },
    "long_context": {
      "family": "long_context",
      "count": 10,
      "proportion": 0.625
    }
  }
}
```

**Edge cases:**

- No failure events → both `by_failure_mode` and `by_prompt_family` are `{}`.
- Prompts not found in the prompt suite are grouped under family `"unknown"`.

---

## Summary for UI

| File               | Use in UI |
|--------------------|-----------|
| `analysis.json`    | Dashboard: failure rate (phat) and confidence band (e.g. `ci_bootstrap` or `ci_bayesian`) per config. |
| `comparisons.json` | Config cards / “safer-than” widget: for each pair (A, B), show `p_a_safer` (e.g. “92% chance A is safer than B”). |
| `distributions.json` | Distribution charts: bar/pie by `by_failure_mode` and by `by_prompt_family` (count + proportion). |

All numeric proportions and probabilities are in the range `[0, 1]`. Config ids and failure-mode/family keys are strings; use them as-is for labels and keys.
