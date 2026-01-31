# Synthetic Prompt Generator Implementation

This document describes the implementation of Option 2: Generate Realistic Synthetic Prompts.

## Overview

The system now supports generating domain-specific prompts using OpenAI, allowing users to describe their use case (e.g., "customer support chatbot", "legal document analysis") and receive 50-200 realistic prompts tailored to that domain.

## Components Implemented

### 1. Prompt Generator Service (`src/lib/prompt-generator.ts`)

- **Function**: `generateDomainPrompts(useCase, count, options)`
- Uses OpenAI GPT-4 to generate domain-specific prompts
- Supports distribution control (short/long, tool-heavy, doc-grounded)
- Handles batching for large prompt counts
- Includes retry logic for reliability

**Key Features:**
- Generates prompts matching the existing `PromptRecord` schema
- Distributes prompts across families (short, long_context, tool_heavy, doc_grounded)
- Validates and fixes prompt IDs and formats
- Supports complexity levels (simple, moderate, complex)

### 2. Telemetry Estimation Service (`src/lib/telemetry-estimator.ts`)

- **Function**: `estimateTelemetry(prompts, config, mode)`
- **Hybrid approach**: LLM-based estimation + optional real API validation
- Fast estimation using OpenAI to predict token counts, latency, tool usage
- Optional real API validation for accuracy checking
- Supports sampling mode (estimate all, validate subset)

**Modes:**
- `estimate`: Fast LLM-based estimation (default)
- `validate`: Real API calls for accurate telemetry
- Sampling: Estimate all, validate a random sample

### 3. API Routes

#### `POST /api/generate-prompts`
- Generates domain-specific prompts
- Request: `{ useCase, count, options? }`
- Response: `{ prompts, metadata }`

#### `POST /api/estimate-telemetry`
- Estimates telemetry for prompts
- Request: `{ prompts, config, mode?, validationSampleSize? }`
- Response: `{ telemetry, metadata }`

### 4. CLI Tool (`src/cli/generate-domain-prompts.ts`)

**Usage:**
```bash
npm run generate-prompts -- \
  --use-case "customer support chatbot" \
  --count 100 \
  --telemetry estimate \
  --config configs/config-a.json
```

**Options:**
- `--use-case, -u`: Use case description (required)
- `--count, -c`: Number of prompts (1-200, required)
- `--output, -o`: Output file path
- `--telemetry, -t`: estimate | validate | none
- `--complexity`: simple | moderate | complex
- `--short-ratio`, `--tool-ratio`, `--doc-ratio`: Distribution control
- `--config`: Config file for telemetry estimation
- `--validation-sample-size`: Number of prompts to validate

### 5. Integration with Probe Runner

- Updated `loadPrompts()` to support domain suite format
- Added `loadDomainPrompts()` for explicit suite loading
- Added `--prompts` flag to `run-probes.ts` CLI

**Usage:**
```bash
npm run probes -- --prompts data/prompts/customer-support.json
```

### 6. Schema (`data/prompts/domain-prompt-suite.schema.json`)

Extended schema supporting:
- Suite metadata (use case, generation method, timestamp)
- Prompts array (standard PromptRecord format)
- Optional telemetry data

## Workflow

1. **Generate Prompts**:
   ```bash
   npm run generate-prompts -- -u "legal analysis" -c 150
   ```

2. **Optional: Estimate Telemetry**:
   ```bash
   npm run generate-prompts -- -u "legal analysis" -c 150 -t estimate --config configs/config-a.json
   ```

3. **Use with Probe Runner**:
   ```bash
   npm run probes -- --prompts data/prompts/legal_analysis.json --mode real
   ```

## API Integration (for Frontend)

The frontend can call these endpoints:

```typescript
// Generate prompts
const response = await fetch('/api/generate-prompts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    useCase: "customer support chatbot",
    count: 100,
    options: {
      complexity: "moderate",
      distribution: {
        short_ratio: 0.4,
        tool_heavy_ratio: 0.3,
        doc_grounded_ratio: 0.4
      }
    }
  })
});

// Estimate telemetry
const telemetryResponse = await fetch('/api/estimate-telemetry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompts: generatedPrompts,
    config: selectedConfig,
    mode: "estimate" // or "validate"
  })
});
```

## Environment Setup

Required environment variable:
```env
OPENAI_API_KEY=your_key_here
```

This is required for:
- Prompt generation (always)
- Telemetry estimation (if using LLM estimation mode)

## Files Created

- `src/lib/prompt-generator.ts` - Core prompt generation logic
- `src/lib/telemetry-estimator.ts` - Hybrid telemetry estimation
- `src/cli/generate-domain-prompts.ts` - CLI tool
- `app/api/generate-prompts/route.ts` - API endpoint
- `app/api/estimate-telemetry/route.ts` - API endpoint
- `data/prompts/domain-prompt-suite.schema.json` - Schema definition

## Files Modified

- `src/lib/probe-runner.ts` - Added domain prompt loading support
- `src/cli/run-probes.ts` - Added `--prompts` flag
- `package.json` - Added `generate-prompts` script
- `README.md` - Added documentation
- `.env.example` - Documented OpenAI requirement

## Next Steps (Frontend)

The frontend team can now:
1. Create UI forms for use case input
2. Call `/api/generate-prompts` to generate prompts
3. Optionally call `/api/estimate-telemetry` for preview
4. Display results and allow export/saving
5. Integrate with probe runner for full analysis

## Notes

- Prompt generation uses OpenAI GPT-4 (configurable via `--model`)
- Telemetry estimation can use cheaper models (gpt-4o-mini) for cost efficiency
- Real API validation is optional but recommended for accuracy
- Generated prompts are compatible with existing probe runner and analysis pipeline
