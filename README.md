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

Run the probe pipeline:

```bash
npm run probes
```

This will:
1. Load configurations from `configs/*.json`
2. Load prompts from `data/prompts/suite.json`
3. Run all probes (configs × prompts)
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

### Deterministic Seed

The probe runner uses a deterministic seed (default: 42) for reproducible results. Set via environment variable:

```bash
SEED=123 npm run probes
```
