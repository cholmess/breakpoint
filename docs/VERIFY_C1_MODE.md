# Verifying C1: Real Model API Mode

Ways to confirm the run-simulation API respects the `mode` parameter (`simulate` vs `real`).

## 1. Automated test (recommended)

From the project root:

```bash
npx tsx tests/run-simulation-mode.test.ts
```

This checks:

- `setMode` / `getMode` in the probe-runner work.
- The route sets mode from the request body (`mode: "real"` and default `simulate`).
- One full run with default mode returns 200.

**Note:** The test runs the full pipeline twice (once with `mode: "real"`, once with default), so it can take 20–60 seconds.

## 2. Manual: API with curl

Start the app, then call the API with and without `mode`.

**Simulate (default, no API keys needed):**

```bash
curl -s -X POST http://localhost:3000/api/run-simulation \
  -H "Content-Type: application/json" \
  -d '{"configA":{"id":"config-a","model":"gpt-4","context_window":8192,"top_k":10,"chunk_size":512,"max_output_tokens":2048,"tools_enabled":true,"temperature":0.7,"cost_per_1k_tokens":0.03},"configB":{"id":"config-b","model":"gpt-4","context_window":16384,"top_k":4,"chunk_size":1024,"max_output_tokens":4096,"tools_enabled":false,"temperature":0.5,"cost_per_1k_tokens":0.03}}' \
  | head -c 500
```

You should get JSON with `analysis`, `comparisons`, `distributions`, `timeline`.

**Real (requires API keys in `.env`):**

Same body with `"mode": "real"` added. With valid keys you get real telemetry; without keys you get an error from the LLM client. In both cases the route is using `mode: "real"`.

## 3. Manual: CLI

The CLI supports `--mode`:

```bash
npx tsx src/cli/run-probes.ts --config-dir configs --prompts data/prompts/prompt-suite.json --mode real
```

Use `--mode simulate` (or omit) for simulated runs.

## 4. From the UI

The dashboard currently does **not** send `mode`; the API defaults to `simulate`. To use real mode from the UI you would need to add a control (e.g. a “Run with real APIs” toggle) that sends `mode: "real"` in the request body. Until then, real mode is only used when you pass it explicitly (curl, CLI, or by adding the toggle).
