# How to Verify Bug Fixes (C1, C2, C3)

Quick ways to confirm the fixes work.

---

## C1: Real model API mode

**What changed:** API accepts `mode: "simulate"` (default) or `mode: "real"`; UI has a Run mode dropdown.

**How to check:**

1. **Automated test** (from project root):
   ```bash
   npm run test:mode
   ```
   Expect: “All mode verification checks passed.” (Takes ~20–60s.)

2. **In the UI:**
   - Start app: `npm run dev`
   - Open the dashboard
   - Under config cards, find **Run mode**
   - Choose **Simulate** → click **Run Simulation** → should complete with no API keys
   - Choose **Real** → Run Simulation → with keys you get real data; without keys you get an error (confirms real mode is used)

3. **CLI:**
   ```bash
   npx tsx src/cli/run-probes.ts --config-dir configs --prompts data/prompts/prompt-suite.json --mode simulate
   ```
   Then try `--mode real` (needs API keys).

---

## C2: Tool timeout detection

**What changed:** Simulation uses a low timeout rate (1–3%); real API only marks timeouts when latency > 60s or error message says “timeout”.

**How to check:**

1. **Simulation:**
   - Run a simulation (Simulate mode) with **tools enabled** on at least one config
   - Open **Failure breakdown** / **Tool Timeout Risk**
   - You should **not** see 10/10 or almost all events as tool timeouts; timeouts should be rare (a few %)

2. **Real API:**
   - With real mode, a normal error (e.g. missing API key) should **not** show as a tool timeout in the breakdown
   - Only long-running calls (>60s) or real timeout errors should count as tool timeouts

---

## C3: Simulation realism (model-specific behavior)

**What changed:** Simulated latency and output vary by model (e.g. GPT-4 slower, mini faster); tool call counts depend on prompt complexity.

**How to check:**

1. **Two configs, different models:**
   - Config A: e.g. `gpt-4` (or a “slower” model)
   - Config B: e.g. `gpt-4o-mini` or `gpt-3.5-turbo` (faster model)
   - Run simulation (Simulate mode)
   - In results / latency / token usage, Config A should tend to show **higher latency** and often **more completion tokens** than Config B

2. **Tool calls:**
   - Use prompts that “expect tools” and configs with tools enabled
   - Short/simple prompts: usually 1–3 tool calls
   - Long / doc_grounded prompts: often 2–8 tool calls (more 3–5)
   - Counts should feel plausible, not always the same 1–5

---

## One-shot: run app and simulate

```bash
npm run dev
```

Then in the browser:

1. Set **Run mode** to **Simulate**
2. Click **Run Simulation**
3. When it finishes, check:
   - **C1:** Run mode dropdown was used and simulation completed
   - **C2:** Failure breakdown – Tool Timeout Risk is not 10/10
   - **C3:** If you use two different models (e.g. gpt-4 vs gpt-4o-mini), latency and token usage differ between configs

If all three look right, your changes are working as intended.
