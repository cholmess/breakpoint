# Probabilistic Failure Simulator

A hackathon project for simulating and detecting LLM configuration failures through deterministic rules and probabilistic analysis.

## Person A: Runner + Rules Engineer

This component implements the probe runner, telemetry logging, and deterministic rules engine.

### Components

- **Probe Runner** (`src/lib/probe-runner.ts`): Executes probes against configurations and generates telemetry
- **Telemetry Logger** (`src/lib/telemetry-logger.ts`): Logs probe telemetry to `output/telemetry.log`
- **Rules Engine** (`src/lib/rules-engine.ts`): Evaluates deterministic rules to detect failures
- **Timeline Builder** (`src/lib/timeline.ts`): Builds break-first timeline from failure events

### Usage

#### Quick Start (Simulation Mode)

Run the probe pipeline with simulated telemetry:

```bash
npm run probes -- --mode simulate
```

#### Real API Mode

To use real Google Gemini API calls:

1. Create a `.env` file with your API key:
   ```bash
   cp .env.example .env
   # Edit .env and add: GEMINI_API_KEY=your_key_here
   ```

2. Run with real API calls:
   ```bash
   npm run probes -- --mode real
   ```

**See [README_API_INTEGRATION.md](./README_API_INTEGRATION.md) for detailed API setup and usage.**

#### Pipeline Steps

The pipeline will:
1. Load configurations from `configs/*.json`
2. Load prompts from `data/prompts/prompt-suite.json`
3. Run all probes (configs × prompts)
   - **Simulate mode**: Generate synthetic telemetry
   - **Real mode**: Call Gemini API and measure actual tokens/latency
4. Evaluate rules and detect failures
5. Build break-first timeline
6. Write outputs to `output/`:
   - `telemetry.log` - JSONL of all probe telemetry
   - `failure-events.json` - Array of failure events
   - `break-first-timeline.json` - Timeline showing when each config breaks

### Failure Modes Detected

1. **Context Overflow** (HIGH): tokens_in > context_window
2. **Silent Truncation Risk** (MED): context_usage > 0.85
3. **Latency Breach** (MED/HIGH): latency_ms > 3000ms
4. **Cost Runaway** (HIGH): estimated_cost exceeds threshold
5. **Tool Timeout Risk** (HIGH): tool_calls > 0 && timeouts > 0
6. **Retrieval Noise Risk** (MED): top_k > 8

### Configuration

Sample configurations are in `configs/`:
- `config-a.json`: top_k=10, context_window=8192, tools=true
- `config-b.json`: top_k=4, context_window=16384, tools=false

### Prompt Suite

50 synthetic prompts across 4 families:
- `short`: Quick Q&A prompts
- `long_context`: Legal, research, document analysis
- `tool_heavy`: Data analysis and automation tasks
- `doc_grounded`: Q&A with context requirements

### Command Line Options

```bash
# Simulation mode (fast, free, reproducible)
npm run probes -- --mode simulate

# Real API mode (accurate, costs apply)
npm run probes -- --mode real

# Custom seed for simulation
npm run probes -- --seed 123

# Combine options
npm run probes -- --mode simulate --seed 42
```

### Modes

**Simulate Mode** (default):
- ✅ Fast execution (processes 100s of prompts in seconds)
- ✅ No API costs
- ✅ Deterministic/reproducible with seed
- ❌ Synthetic telemetry (not real model behavior)

**Real API Mode**:
- ✅ Actual Gemini API calls
- ✅ Real token counts and latency measurements
- ✅ Accurate risk analysis based on real model behavior
- ⚠️ API costs apply
- ⚠️ Rate limited (5 concurrent, 200ms delays)

## Person B: Probability & Analytics

This component computes per-config failure probabilities, confidence intervals, pairwise “safer than” probabilities, and distributions by failure mode and prompt family.

### Usage

```bash
npm run analyze
```

Reads `output/failure-events.json` (or `tests/fixtures/failure-events.json`) and `data/prompts/prompt-suite.json`, and writes to `output/`:

- **analysis.json** – Per-config stats (phat, bootstrap/Bayesian 95% CIs)
- **comparisons.json** – Pairwise P(A safer than B)
- **distributions.json** – Counts and proportions by failure mode and by prompt family

**Person C (Frontend):** See **[docs/JSON_SCHEMAS.md](./docs/JSON_SCHEMAS.md)** for exact field names, types, and examples for dashboard, confidence bands, and distribution charts.

## Person C: Frontend Dashboard

The front-end dashboard provides a visual interface for viewing analysis results, comparing configurations, and exploring failure patterns.

### Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to http://localhost:3000

**See [SETUP.md](./SETUP.md) for detailed setup instructions and troubleshooting.**

### Features

- **Configuration Comparison**: Compare two LLM configurations side-by-side
- **Probability Analysis**: View pairwise "safer than" probabilities
- **Confidence Intervals**: Visualize failure rates with 95% confidence bands
- **Distribution Charts**: Explore failure modes and prompt family distributions
- **Failure Breakdown**: Detailed view of failure events by mode and severity

### Data Flow

The dashboard automatically loads data from:
- `/api/analysis` → `output/analysis.json`
- `/api/comparisons` → `output/comparisons.json`
- `/api/distributions` → `output/distributions.json`

To generate fresh data, run:
```bash
npm run analyze
```

### Next Steps

To make this useful for the hackathon:

1. **Replace generic prompts** with domain-specific ones for your use case
2. **Use real API mode** to get actual telemetry from Gemini
3. **Analyze failure patterns** to identify which configs are safer
4. **Export risk analysis** to dashboard (Person C) and probability layer (Person B)
