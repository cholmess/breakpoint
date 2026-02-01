# BreakPoint

**Compare LLM configurations for production reliability.** Run A/B probes, detect failure modes (latency, cost, context, retrieval), and get a probabilistic recommendation for which config is safer—with simulated telemetry or real API calls.

---

## For Judges

### Run it in 2 minutes

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

### What to try

1. **Simulate (default)** — Click **Run**. No API keys needed. You’ll see failure rates, confidence bands, and a recommendation (e.g. “Config A is significantly more reliable”).
2. **Real API** — Switch to **Real API**, add `OPENAI_API_KEY` (and optionally `GEMINI_API_KEY`) to `.env`, then **Run**. Both configs call real models; failure rates reflect actual latency, cost, and token usage.
3. **Cost & latency tolerance** — After a run, use the **Cost ×** and **Latency ×** toggles to see how the recommendation changes with looser thresholds.

### What we’re demonstrating

- **Probabilistic A/B comparison** — “P(Config A safer than B)” with confidence intervals, not just point estimates.
- **Six failure modes** — Context overflow, silent truncation, latency breach, cost runaway, tool timeout, retrieval noise. Rules are deterministic; analysis is Bayesian/bootstrap.
- **Real + simulate** — Same dashboard and rules for synthetic telemetry (fast, free) and real OpenAI/Gemini calls (realistic stress test).
- **Production recommendation** — Clear “We recommend Config A for production” with reasoning (failure rate, confidence, most common issues).

### Tech stack

Next.js 16, React 19, TypeScript. Probe runner + rules engine (Node); analysis (probability, statistics); dashboard (Recharts, Tailwind). APIs: OpenAI, Google Gemini, Manus (optional).

---

## Project structure

| Layer | Responsibility |
|-------|-----------------|
| **Probe runner** | Run prompts × configs; simulate or call LLM APIs; collect telemetry |
| **Rules engine** | Evaluate SLOs (latency, cost, context, retrieval, tools); emit failure events |
| **Analysis** | Per-config failure rate (phat), 95% CIs, P(A safer than B), distributions by failure mode & prompt family |
| **Dashboard** | Config comparison, probability cards, confidence bands, failure breakdown, timeline, PDF export |

### Quick commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dashboard at http://localhost:3000 |
| `npm run probes -- --mode simulate` | Run probes with synthetic telemetry (CLI) |
| `npm run probes -- --mode real` | Run probes with real API calls (CLI) |
| `npm run analyze` | Compute analysis from `output/failure-events.json` |
| `npm run test` | Run statistics/edge-case tests |

---

## Setup (detailed)

### 1. Install and run the dashboard

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The dashboard can load pre-generated analysis or run a **simulation** from the UI (no keys required).

### 2. Real API mode (optional)

For real OpenAI and/or Gemini calls:

```bash
cp .env.example .env
# Edit .env:
# OPENAI_API_KEY=sk-...
# GEMINI_API_KEY=...   # optional
```

In the UI, switch to **Real API** and click **Run**. Configs use the model names you set (e.g. `gpt-4`, `gpt-4o`, `gemini-1.5-flash`). Newer OpenAI models (o1, gpt-5.x) use `max_completion_tokens` automatically.

See [README_API_INTEGRATION.md](./README_API_INTEGRATION.md) and [SETUP.md](./SETUP.md) for more.

---

## Failure modes detected

| Mode | Severity | Rule (simplified) |
|------|----------|-------------------|
| Context overflow | HIGH | tokens_in > context_window |
| Silent truncation risk | MED | context_usage > 85% |
| Latency breach | MED/HIGH | latency_ms > 4.5s (configurable) |
| Cost runaway | HIGH | estimated_cost > threshold per probe |
| Tool timeout risk | HIGH | tool_calls > 0 and timeouts > 0 |
| Retrieval noise risk | MED | top_k > 6 or high retrieved-token ratio |

Thresholds are fixed for latency (so real API isn’t overfocused on latency); cost and context use adaptive (P95) or fixed SLOs depending on mode.

---

## Configs and prompts

- **Configs**: Two configs (A vs B) with model, context window, top_k, chunk size, tools, temperature, cost. Edit in UI or via `configs/*.json`.
- **Prompts**: Loaded from `data/prompts/prompt-suite.json` (or custom prompts in “Real use case” mode). Families: short/long, plain / doc grounded / tool heavy.

---

## Person A: Runner + Rules

- **Probe runner** (`src/lib/probe-runner.ts`): Runs probes, simulate or real API, rate limiting.
- **Rules engine** (`src/lib/rules-engine.ts`): Default and adaptive rules, latency/cost/context thresholds.
- **Timeline** (`src/lib/timeline.ts`): Break-first timeline from failure events.

## Person B: Probability & analytics

- **Analysis** (`src/lib/analysis.ts`): Failure rate (phat), bootstrap/Bayesian CIs, pairwise comparisons, distributions.
- **Statistics** (`src/lib/statistics.ts`): Wilson score, beta CI, config comparison.

## Person C: Frontend

- **Dashboard** (`app/page.tsx`): Run control (Simulate / Real API), config flip cards, results summary, recommendation banner, probability cards, confidence band, failure breakdown, hotspot matrix, timeline, cost/latency bands, PDF export.
- **APIs**: `POST /api/run-simulation` runs the full pipeline (probes + rules + analysis) and returns analysis, comparisons, distributions, timeline.

See [docs/JSON_SCHEMAS.md](./docs/JSON_SCHEMAS.md) for schemas used by the dashboard.
