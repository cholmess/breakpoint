# API Integration Guide

This project now supports **real API calls** to Google Gemini for measuring actual telemetry, in addition to the simulation mode.

## Supported Providers

- **OpenAI** (gpt-4, gpt-4o, gpt-3.5-turbo, etc.) – Set `OPENAI_API_KEY` in `.env`
- **Google Gemini** (gemini-1.5-flash, gemini-1.5-pro, etc.) – Set `GEMINI_API_KEY` in `.env`
- **Manus AI** (manus-1.6, manus-1.6-lite, manus-1.6-max) – Set `MANUS_API_KEY` in `.env`

Provider is inferred from the `model` field in configs (`gpt-*` → OpenAI, `gemini-*` → Gemini, `manus-*` → Manus), or set explicitly via `provider` field.

## Quick Start

### 1. Get API Keys

**OpenAI:**
- Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
- Create a new key

**Google Gemini – free tier (no billing required):**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Get API key** → **Create API key** → **Create API key in new project**
4. Copy the key

The Gemini API has a **free tier** with rate limits – no credit card needed. Good for development and small runs.

**Hackathon credits:** If your event offers Google Cloud/Gemini credits (e.g. via Devpost, Google Cloud Skills Boost, or event organizers), follow the instructions from the hackathon. Typically:
- Sign up via the event’s campaign/registration link
- Complete any required labs or onboarding
- Credits are applied to your Google Cloud project or AI Studio account

For current hackathon offers, search [Devpost](https://devpost.com/hackathons) for “Gemini” or “Google AI”.

**Manus AI:**
- Go to [manus.im](https://manus.im) and sign up
- Open **Settings** → **Integrations** → **API** to generate an API key
- Models: `manus-1.6` (default), `manus-1.6-lite` (faster), `manus-1.6-max` (more capable)

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add the API keys for the providers your configs use:

```env
# For configs with gpt-4, gpt-3.5-turbo, etc.
OPENAI_API_KEY=sk-proj-...

# For configs with gemini-1.5-flash, etc.
GEMINI_API_KEY=...

# For configs with manus-1.6, etc.
MANUS_API_KEY=...

MODE=real
```

**⚠️ SECURITY**: Never commit your `.env` file or share API keys. If you accidentally expose a key, revoke it immediately in the provider's dashboard and create a new one.

### 3. Run with Real API Calls

```bash
# Using command line flag
npm run probes -- --mode real

# Or using environment variable in .env
npm run probes
```

## Modes

### Simulation Mode (Default)

- **No API calls**: Uses deterministic simulation
- **Fast**: Processes hundreds of prompts in seconds
- **Free**: No API costs
- **Reproducible**: Same seed = same results

```bash
npm run probes -- --mode simulate
```

### Real API Mode

- **Real API calls**: Calls Google Gemini with your prompts
- **Accurate telemetry**: Measures actual tokens, latency, tool calls
- **Costs apply**: Uses your API quota
- **Rate limited**: 5 concurrent requests, 200ms delay between calls

```bash
npm run probes -- --mode real
```

## Command Line Options

```bash
# Specify mode
npm run probes -- --mode real
npm run probes -- --mode simulate

# Set seed for simulation (reproducibility)
npm run probes -- --seed 12345

# Combine options
npm run probes -- --mode simulate --seed 42
```

## Environment Variables

You can set these in `.env`:

- `GEMINI_API_KEY`: Your Google Gemini API key (required for real mode)
- `MODE`: Default mode (`simulate` or `real`)
- `SEED`: Default seed for simulation (integer)

## Telemetry Differences

### Simulation Mode

- Estimates token counts from prompt length
- Simulates latency based on token count
- Adds randomness with seeded RNG

### Real API Mode

- `prompt_tokens`: Actual tokens from API response
- `completion_tokens`: Actual completion tokens
- `latency_ms`: Real end-to-end API call time
- `retrieved_tokens`: From cached content (if applicable)
- `error`: Contains error message if API call failed

## Rate Limiting

The system automatically rate limits API calls:

- **Max concurrent requests**: 5
- **Min delay between calls**: 200ms
- **Retry logic**: 3 attempts with exponential backoff

This prevents hitting API rate limits while maintaining reasonable throughput.

## Error Handling

If an API call fails:

1. Automatic retry (up to 3 attempts)
2. Exponential backoff (1s, 2s, 4s)
3. Error logged to telemetry with `error` field
4. `tool_timeouts` set to 1 to mark as failed
5. Processing continues with remaining prompts

## Cost Estimation

Real API calls will consume your Gemini quota. Before running:

1. Check your prompt count: `jq length data/prompts/prompt-suite.json`
2. Check config count: `ls configs/*.json | wc -l`
3. Total API calls = prompts × configs
4. Estimate cost based on Gemini pricing

Example:
- 50 prompts × 2 configs = 100 API calls
- Average 1000 tokens per call = ~100k tokens
- Check [Gemini pricing](https://ai.google.dev/pricing) for current rates

## Validation

Test with a small prompt set first:

1. Create `data/prompts/test.json` with 3-5 prompts
2. Run: `npm run probes -- --mode real`
3. Check `output/telemetry.log` for real metrics
4. Verify no errors in output

## Troubleshooting

### "GEMINI_API_KEY not found"

Solution: Create `.env` file with your API key

### API calls timing out

Solutions:
- Check your internet connection
- Verify API key is valid
- Check Gemini service status
- Try simulation mode to verify code works

### Rate limit errors

Solutions:
- System automatically retries with backoff
- Reduce concurrent requests in `gemini-client.ts`
- Add longer delays between calls

### High costs

Solutions:
- Use simulation mode for development
- Test with small prompt sets first
- Set budget alerts in Google Cloud Console
- Use `--mode simulate` by default

## Best Practices

1. **Development**: Use simulation mode
2. **Validation**: Use real mode with small prompt sets
3. **Production**: Use real mode for actual risk analysis
4. **Testing**: Always test with `--mode simulate` first
5. **API Keys**: Never commit `.env` to git (already in `.gitignore`)

## Next Steps

After integrating real APIs:

1. Generate realistic prompts for your use case
2. Run real API calls to measure actual behavior
3. Apply failure rules to real telemetry
4. Analyze break-first timeline for risk assessment
5. Compare config A vs config B with real data
