/**
 * Hybrid Telemetry Estimation Service
 * Estimates telemetry using LLM knowledge, with optional real API validation
 */

import OpenAI from "openai";
import type { ProbeConfig, PromptRecord, TelemetryRecord } from "../types";
import { runProbe, setMode } from "./probe-runner";

/**
 * Initialize OpenAI client for telemetry estimation
 */
function initEstimationClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY not found in environment. Please set it in .env file."
    );
  }

  return new OpenAI({ apiKey });
}

/**
 * Estimate token count from text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // More accurate: count words and multiply by ~1.3 (average tokens per word)
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

/**
 * Build prompt for LLM to estimate telemetry
 */
function buildEstimationPrompt(
  prompt: PromptRecord,
  config: ProbeConfig
): string {
  return `You are estimating telemetry metrics for an LLM API call.

PROMPT:
"${prompt.prompt}"

CONFIGURATION:
- Model: ${config.model}
- Context window: ${config.context_window} tokens
- Max output tokens: ${config.max_output_tokens}
- Temperature: ${config.temperature}
- Tools enabled: ${config.tools_enabled}
- Top-k: ${config.top_k}
- Chunk size: ${config.chunk_size}

PROMPT CHARACTERISTICS:
- Family: ${prompt.family}
- Use case: ${prompt.use_case}
- Expects tools: ${prompt.expects_tools}
- Expects citations: ${prompt.expects_citations}

ESTIMATE THE FOLLOWING METRICS:

1. prompt_tokens: Number of input tokens (count the prompt text)
2. retrieved_tokens: If doc_grounded or expects_citations, estimate RAG retrieval tokens (chunk_size × top_k × ~0.8)
3. completion_tokens: Estimated output tokens based on prompt complexity and max_output_tokens
4. latency_ms: Estimated latency considering:
   - Model speed (faster models: 50-200ms base, slower: 200-500ms base)
   - Token count (add ~0.5-2ms per token depending on model)
   - Tool calls add 100-500ms per call
5. tool_calls: Number of tool calls if expects_tools is true (estimate 1-5 based on prompt complexity)
6. tool_timeouts: Usually 0, but estimate 0-1 if many tool calls

BASE YOUR ESTIMATES ON:
- Typical behavior of ${config.model}
- Prompt length and complexity
- Whether tools/citations are needed
- Realistic API response patterns

Return ONLY a JSON object with these exact fields:
{
  "prompt_tokens": <number>,
  "retrieved_tokens": <number>,
  "completion_tokens": <number>,
  "latency_ms": <number>,
  "tool_calls": <number>,
  "tool_timeouts": <number>
}`;
}

/**
 * Estimate telemetry using LLM knowledge (fast, free, but approximate)
 */
async function estimateTelemetryLLM(
  prompt: PromptRecord,
  config: ProbeConfig
): Promise<TelemetryRecord> {
  const client = initEstimationClient();

  // First, do a quick token count estimate ourselves
  const promptTokens = estimateTokens(prompt.prompt);

  // Estimate retrieved tokens if doc-grounded
  let retrievedTokens = 0;
  if (
    prompt.family === "doc_grounded" ||
    prompt.expects_citations ||
    prompt.family === "long_context"
  ) {
    const chunksRetrieved = Math.min(config.top_k, 10);
    retrievedTokens = Math.floor(chunksRetrieved * config.chunk_size * 0.8);
  }

  // Use LLM for more nuanced estimates
  try {
    const estimationPrompt = buildEstimationPrompt(prompt, config);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model for estimation
      messages: [
        {
          role: "system",
          content:
            "You are a telemetry estimation assistant. Return only valid JSON objects.",
        },
        {
          role: "user",
          content: estimationPrompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent estimates
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    let parsed: Partial<TelemetryRecord>;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    // Use LLM estimates, but fall back to our calculations if missing
    const telemetry: TelemetryRecord = {
      prompt_id: prompt.id,
      config_id: config.id,
      prompt_tokens: parsed.prompt_tokens ?? promptTokens,
      retrieved_tokens: parsed.retrieved_tokens ?? retrievedTokens,
      completion_tokens: parsed.completion_tokens ?? Math.min(
        Math.floor(promptTokens * 0.5),
        config.max_output_tokens
      ),
      latency_ms: parsed.latency_ms ?? 300,
      tool_calls: parsed.tool_calls ?? (prompt.expects_tools ? 2 : 0),
      tool_timeouts: parsed.tool_timeouts ?? 0,
      timestamp: new Date().toISOString(),
    };

    return telemetry;
  } catch (error) {
    console.warn(
      `LLM estimation failed for ${prompt.id}, using fallback calculations:`,
      error
    );

    // Fallback to rule-based estimation
    const completionTokens = Math.min(
      Math.floor(promptTokens * (prompt.family === "short" ? 0.3 : 0.6)),
      config.max_output_tokens
    );

    const baseLatency = 200;
    const tokenLatency = (promptTokens + retrievedTokens + completionTokens) * 0.5;
    const latencyMs = Math.floor(baseLatency + tokenLatency);

    return {
      prompt_id: prompt.id,
      config_id: config.id,
      prompt_tokens: promptTokens,
      retrieved_tokens: retrievedTokens,
      completion_tokens: completionTokens,
      latency_ms: latencyMs,
      tool_calls: prompt.expects_tools ? 2 : 0,
      tool_timeouts: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Estimate telemetry for multiple prompts
 * Can use LLM estimation or real API validation
 */
export async function estimateTelemetry(
  prompts: PromptRecord[],
  config: ProbeConfig,
  mode: "estimate" | "validate" = "estimate"
): Promise<TelemetryRecord[]> {
  if (mode === "validate") {
    // Use real API calls for validation
    setMode("real");
    const results = [];

    // For validation, we might want to sample a subset
    // But for now, validate all prompts
    for (const prompt of prompts) {
      try {
        const result = await runProbe(config, prompt);
        results.push(result.telemetry);
      } catch (error) {
        console.error(`Validation failed for ${prompt.id}:`, error);
        // Fall back to estimation on error
        const estimated = await estimateTelemetryLLM(prompt, config);
        results.push(estimated);
      }
    }

    return results;
  } else {
    // Use LLM-based estimation (fast)
    const results: TelemetryRecord[] = [];

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((p) => estimateTelemetryLLM(p, config))
      );
      results.push(...batchResults);

      // Rate limiting between batches
      if (i + batchSize < prompts.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }
}

/**
 * Estimate telemetry with sampling for validation
 * Estimates all prompts, but validates a random sample
 */
export async function estimateTelemetryWithSampling(
  prompts: PromptRecord[],
  config: ProbeConfig,
  validationSampleSize: number = 10
): Promise<{
  estimated: TelemetryRecord[];
  validated: TelemetryRecord[];
  validationIndices: number[];
}> {
  // Estimate all prompts
  const estimated = await estimateTelemetry(prompts, config, "estimate");

  // Sample prompts for validation
  const sampleIndices: number[] = [];
  const sampleSize = Math.min(validationSampleSize, prompts.length);
  
  // Random sampling without replacement
  const indices = Array.from({ length: prompts.length }, (_, i) => i);
  for (let i = 0; i < sampleSize; i++) {
    const randomIndex = Math.floor(Math.random() * indices.length);
    sampleIndices.push(indices.splice(randomIndex, 1)[0]);
  }

  // Validate sampled prompts
  const sampledPrompts = sampleIndices.map((idx) => prompts[idx]);
  const validated = await estimateTelemetry(sampledPrompts, config, "validate");

  return {
    estimated,
    validated,
    validationIndices: sampleIndices,
  };
}
