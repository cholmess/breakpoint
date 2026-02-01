/**
 * Domain-Specific Prompt Generator
 * Uses OpenAI to generate realistic synthetic prompts for a given use case
 */

import OpenAI from "openai";
import type { PromptRecord } from "../types";

export interface PromptDistribution {
  short_ratio?: number; // 0-1, default 0.4 (40% short)
  tool_heavy_ratio?: number; // 0-1, default 0.3 (30% tool-heavy)
  doc_grounded_ratio?: number; // 0-1, default 0.4 (40% doc-grounded)
}

export interface GenerationOptions {
  distribution?: PromptDistribution;
  complexity?: "simple" | "moderate" | "complex";
  model?: string; // OpenAI model to use for generation, default "gpt-4o"
}

/**
 * Initialize OpenAI client for prompt generation
 */
function initGenerationClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY not found in environment. Please set it in .env file."
    );
  }

  return new OpenAI({ apiKey });
}

/**
 * Get example prompts from existing suite to show the LLM the format
 */
function getExamplePrompts(): PromptRecord[] {
  return [
    {
      id: "p_001",
      family: "short",
      use_case: "quick_qa",
      prompt: "What is the capital of France?",
      expects_tools: false,
      expects_citations: false,
    },
    {
      id: "p_011",
      family: "long_context",
      use_case: "legal_qa",
      prompt:
        "Please analyze the following legal contract excerpt and identify all clauses related to termination, intellectual property rights, and dispute resolution. The contract is between a software development company and a client, covering a 12-month engagement for building a custom CRM system. Include references to specific sections and explain the implications of each clause in plain language.",
      expects_tools: false,
      expects_citations: true,
    },
    {
      id: "p_051",
      family: "tool_heavy",
      use_case: "data_analysis",
      prompt:
        "Use the database lookup tool to fetch sales data for Q4 2024, then use the calculator tool to compute month-over-month growth rates, and finally format the results as a JSON response.",
      expects_tools: true,
      expects_citations: false,
    },
    {
      id: "p_061",
      family: "doc_grounded",
      use_case: "doc_qa",
      prompt:
        'Given the following document excerpt: "Section 3.2 of the agreement states that all intellectual property developed during the engagement belongs to the client." Question: Who owns the IP? Cite the specific section.',
      expects_tools: false,
      expects_citations: true,
    },
  ];
}

/**
 * Build the system prompt for OpenAI to generate domain-specific prompts
 */
function buildGenerationPrompt(
  useCase: string,
  count: number,
  options: GenerationOptions
): string {
  const examples = getExamplePrompts();
  const distribution = options.distribution || {};
  const shortRatio = distribution.short_ratio ?? 0.4;
  const toolRatio = distribution.tool_heavy_ratio ?? 0.3;
  const docRatio = distribution.doc_grounded_ratio ?? 0.4;
  const complexity = options.complexity || "moderate";

  return `You are generating synthetic prompts for testing an LLM failure detection system.
The user wants prompts for this use case: "${useCase}"

Generate ${count} diverse, realistic prompts that would be typical for this domain.

CRITICAL - STRESS TESTING REQUIREMENTS:
Your goal is to generate prompts that will STRESS-TEST the LLM system and reveal potential failures.

30-50% of prompts should be designed to trigger these specific failure modes:
- context_overflow: Very long prompts with extensive context (3000+ tokens when tokenized), including large documents, codebases, or detailed specifications
- latency_breach: Multi-step tasks requiring many tool calls (5+ sequential operations), complex workflows, or time-sensitive operations
- cost_runaway: Prompts requiring large outputs with multiple iterations, extensive generation, or high token consumption
- tool_timeout_risk: Time-sensitive tasks with complex tool orchestration, nested function calls, or operations that may exceed time limits
- retrieval_noise_risk: Ambiguous queries requiring many document lookups, vague instructions needing clarification, or queries that may retrieve irrelevant context

Include edge cases like:
- Extremely long documents or code snippets (5000+ words)
- Nested/recursive requirements that require multiple passes
- Ambiguous instructions that require clarification or multiple interpretations
- Time-sensitive operations with strict deadlines
- Complex multi-tool workflows with dependencies
- Prompts that push context window limits
- Tasks requiring extensive output generation

The remaining 50-70% should be normal, reasonable prompts to establish a baseline.
This mix ensures realistic testing with both success and failure cases.

SCHEMA REQUIREMENTS:
Each prompt must be a JSON object with these exact fields:
- id: string in format "p_XXX" where XXX is a 3-digit number (001, 002, etc.)
- family: one of: "short", "long_context", "tool_heavy", "doc_grounded"
- use_case: a domain-specific label (e.g., "${useCase.replace(/ /g, "_")}", "customer_support", "legal_qa", etc.)
- prompt: the actual prompt text (string)
- expects_tools: boolean (true if prompt requires tool/function calling)
- expects_citations: boolean (true if prompt requires citations or document grounding)

FAMILY DISTRIBUTION:
- ${(shortRatio * 100).toFixed(0)}% should be "short" (1-2 sentences, quick questions)
- ${((1 - shortRatio) * 100).toFixed(0)}% should be "long_context" (3+ sentences, detailed requests)
- ${(toolRatio * 100).toFixed(0)}% should be "tool_heavy" (requires function calling, API calls, calculations)
- ${(docRatio * 100).toFixed(0)}% should be "doc_grounded" (requires document context, citations)

COMPLEXITY LEVEL: ${complexity}
- simple: Basic questions, straightforward requests
- moderate: Mix of simple and complex scenarios
- complex: Advanced multi-step tasks, nuanced questions, stress-testing scenarios

DOMAIN GUIDANCE:
For "${useCase}", generate prompts that are realistic and diverse. Examples:
- Customer support: FAQ, complaint handling, product inquiries, troubleshooting
- Legal document analysis: contract review, clause extraction, risk assessment, compliance checks
- Code review: bug detection, style suggestions, security analysis, performance optimization
- Medical records: summarization, diagnosis assistance, treatment recommendations
- Financial reports: data extraction, trend analysis, risk assessment
- Educational content: complex explanations, multi-step problem solving, interactive learning scenarios

EXAMPLE PROMPTS (follow this format):
${JSON.stringify(examples, null, 2)}

IMPORTANT:
- Prompts must be realistic and domain-appropriate
- Ensure diversity (don't repeat similar prompts)
- Match the family type correctly (short vs long, tool vs plain, doc vs non-doc)
- Set expects_tools and expects_citations accurately based on prompt content
- Use appropriate use_case labels that match the domain
- Remember: 30-50% should be challenging/stress-testing prompts that will trigger failure modes

Return a JSON object with a "prompts" field containing an array of prompt objects. Example format:
{
  "prompts": [
    { "id": "p_001", "family": "short", "use_case": "...", "prompt": "...", "expects_tools": false, "expects_citations": false },
    ...
  ]
}`;
}

/**
 * Generate domain-specific prompts using OpenAI
 */
export async function generateDomainPrompts(
  useCase: string,
  count: number,
  options: GenerationOptions = {}
): Promise<PromptRecord[]> {
  if (count < 1 || count > 200) {
    throw new Error("Count must be between 1 and 200");
  }

  const client = initGenerationClient();
  const model = options.model || "gpt-4o";
  const systemPrompt = buildGenerationPrompt(useCase, count, options);

  try {
    // For large counts, we may need to batch the generation
    // OpenAI has token limits, so we'll generate in batches of 50
    const batchSize = 50;
    const batches = Math.ceil(count / batchSize);
    const allPrompts: PromptRecord[] = [];

    for (let batch = 0; batch < batches; batch++) {
      const batchCount = Math.min(batchSize, count - allPrompts.length);
      const batchPrompt = buildGenerationPrompt(useCase, batchCount, options);

      // Update prompt to request JSON object wrapper
      const wrappedPrompt = batchPrompt + "\n\nReturn the prompts in a JSON object with a 'prompts' array field.";

      const response = await client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "You are a prompt generation assistant. Always return valid JSON objects with a 'prompts' array field.",
          },
          {
            role: "user",
            content: wrappedPrompt,
          },
        ],
        temperature: 0.8, // Higher temperature for diversity
        response_format: { type: "json_object" }, // Force JSON output
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content returned from OpenAI");
      }

      // Parse the JSON response
      let parsed: PromptRecord[] | { prompts?: PromptRecord[] };
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        // Sometimes OpenAI wraps in markdown code blocks
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      }

      // Handle different response formats
      let prompts: PromptRecord[];
      if (Array.isArray(parsed)) {
        prompts = parsed;
      } else if (parsed.prompts && Array.isArray(parsed.prompts)) {
        prompts = parsed.prompts;
      } else if (typeof parsed === 'object' && 'prompts' in parsed) {
        // Try to find any array field
        const arrayField = Object.values(parsed).find(v => Array.isArray(v));
        if (arrayField) {
          prompts = arrayField as PromptRecord[];
        } else {
          throw new Error("Unexpected response format from OpenAI - no prompts array found");
        }
      } else {
        throw new Error("Unexpected response format from OpenAI");
      }

      // Validate and fix prompts
      const validatedPrompts = prompts.map((p, idx) => {
        // Ensure ID format is correct
        const globalIndex = allPrompts.length + idx + 1;
        const id = `p_${String(globalIndex).padStart(3, "0")}`;

        // Ensure family is valid
        const validFamilies = ["short", "long_context", "tool_heavy", "doc_grounded"];
        const family = validFamilies.includes(p.family) ? p.family : "short";

        // Ensure use_case is set
        const use_case = p.use_case || useCase.replace(/ /g, "_").toLowerCase();

        return {
          id,
          family,
          use_case,
          prompt: p.prompt || "",
          expects_tools: Boolean(p.expects_tools),
          expects_citations: Boolean(p.expects_citations),
        };
      });

      allPrompts.push(...validatedPrompts);

      // If we have enough, break
      if (allPrompts.length >= count) {
        break;
      }

      // Rate limiting: wait a bit between batches
      if (batch < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Trim to exact count
    return allPrompts.slice(0, count);
  } catch (error) {
    console.error("Error generating prompts:", error);
    throw new Error(
      `Failed to generate prompts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate prompts with retry logic
 */
export async function generateDomainPromptsWithRetry(
  useCase: string,
  count: number,
  options: GenerationOptions = {},
  maxRetries = 3
): Promise<PromptRecord[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateDomainPrompts(useCase, count, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < maxRetries - 1) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  throw lastError || new Error("Failed to generate prompts after retries");
}
