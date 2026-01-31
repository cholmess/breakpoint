# Probabilistic Failure Simulator

A hackathon project for simulating and detecting LLM configuration failures through deterministic rules and probabilistic analysis.

## Person A: Runner + Rules Engineer

This component implements the probe runner, telemetry logging, and deterministic rules engine.

### Components

- **Probe Runner** (`src/lib/probe-runner.ts`): Executes probes against configurations and generates telemetry
- **Telemetry Logger** (`src/lib/telemetry-logger.ts`): Logs probe telemetry to `output/telemetry.log`
- **Rules Engine** (`src/lib/rules-engine.ts`): Evaluates deterministic rules to detect failures
- **Timeline Builder** (`src/lib/timeline.ts`): Builds break-first timeline from failure events

### Testing

**1. Run the full pipeline**

From the project root:

```bash
npm run probes
```

You should see:
- Loaded 2 config(s) and 50 prompt(s)
- Completed 100 probe(s) (2 configs × 50 prompts)
- Detected failure events and break points
- Three output files under `output/`

**2. Check outputs**

- `output/telemetry.log` – JSONL, one line per probe (100 lines)
- `output/failure-events.json` – Array of failure events
- `output/break-first-timeline.json` – `configs` (events per config) and `break_points` (first HIGH per config)

**3. Reproducibility**

Same seed → same results:

```bash
SEED=42 npm run probes
SEED=99 npm run probes   # different failure counts / break points
```

**4. Re-run**

Each run clears the previous `telemetry.log` and overwrites the JSON files. Run again anytime to regenerate.

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
2. Load prompts from `data/prompts/suite.json`
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

The system supports two ways to generate prompts:

1. **Template-based prompts** (existing): 50 synthetic prompts across 4 families:
   - `short`: Quick Q&A prompts
   - `long_context`: Legal, research, document analysis
   - `tool_heavy`: Data analysis and automation tasks
   - `doc_grounded`: Q&A with context requirements

2. **AI-generated domain prompts** (new): Generate 50-200 realistic prompts for your specific use case using OpenAI.

#### Generating Domain-Specific Prompts

Use the CLI tool to generate prompts tailored to your domain:

```bash
# Basic usage
npm run generate-prompts -- \
  --use-case "customer support chatbot" \
  --count 100

# With telemetry estimation
npm run generate-prompts -- \
  --use-case "legal document analysis" \
  --count 150 \
  --telemetry estimate \
  --config configs/config-a.json

# Advanced options
npm run generate-prompts -- \
  --use-case "code review assistant" \
  --count 75 \
  --complexity complex \
  --short-ratio 0.3 \
  --tool-ratio 0.4 \
  --output data/prompts/code-review.json
```

**Options:**
- `--use-case, -u`: Description of your use case (required)
- `--count, -c`: Number of prompts to generate (1-200, required)
- `--output, -o`: Output file path (default: `data/prompts/<use-case>.json`)
- `--telemetry, -t`: Telemetry mode: `estimate` (LLM-based), `validate` (real API), or `none` (default)
- `--complexity`: `simple`, `moderate` (default), or `complex`
- `--short-ratio`: Ratio of short prompts (0-1, default 0.4)
- `--tool-ratio`: Ratio of tool-heavy prompts (0-1, default 0.3)
- `--doc-ratio`: Ratio of doc-grounded prompts (0-1, default 0.4)
- `--config`: Config file for telemetry estimation (required if using `--telemetry`)
- `--validation-sample-size`: Number of prompts to validate with real API (default: 10)

**API Routes** (for frontend integration):

- `POST /api/generate-prompts`: Generate domain-specific prompts
- `POST /api/estimate-telemetry`: Estimate telemetry for prompts

See the generated prompts in `data/prompts/` - they can be used directly with the probe runner:

```bash
npm run probes -- --prompts data/prompts/customer-support.json
```

### Command Line Options

```bash
# Simulation mode (fast, free, reproducible)
npm run probes -- --mode simulate

# Real API mode (accurate, costs apply)
npm run probes -- --mode real

# Custom seed for simulation
npm run probes -- --seed 123

# Use custom prompts file (e.g., domain-generated prompts)
npm run probes -- --prompts data/prompts/customer-support.json

# Combine options
npm run probes -- --mode simulate --seed 42 --prompts data/prompts/my-prompts.json
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

Reads `output/failure-events.json` (or `tests/fixtures/failure-events.json`) and `data/prompts/suite.json`, and writes to `output/`:

- **analysis.json** – Per-config stats (phat, bootstrap/Bayesian 95% CIs)
- **comparisons.json** – Pairwise P(A safer than B)
- **distributions.json** – Counts and proportions by failure mode and by prompt family

**Person C (Frontend):** See **[docs/JSON_SCHEMAS.md](./docs/JSON_SCHEMAS.md)** for exact field names, types, and examples for dashboard, confidence bands, and distribution charts.

### Next Steps

To make this useful for the hackathon:

1. **Replace generic prompts** with domain-specific ones for your use case
2. **Use real API mode** to get actual telemetry from Gemini
3. **Analyze failure patterns** to identify which configs are safer
4. **Export risk analysis** to dashboard (Person C) and probability layer (Person B)
