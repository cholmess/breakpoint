/**
 * Generate synthetic prompt suite (200 prompts) per plan.
 * 8 families × 25 prompts; deterministic output (no random).
 * Run: node scripts/generate-prompt-suite.js
 */

const fs = require("fs");
const path = require("path");

const BUCKETS = [
  { family: "short_plain",        expects_tools: false, expects_citations: false, use_cases: ["general_qa", "code_help", "summarization"] },
  { family: "short_tool_heavy",   expects_tools: true,  expects_citations: false, use_cases: ["code_help", "general_qa"] },
  { family: "short_doc_grounded", expects_tools: false, expects_citations: true,  use_cases: ["doc_qa", "legal_qa"] },
  { family: "short_tool_and_doc", expects_tools: true,  expects_citations: true,  use_cases: ["doc_qa", "code_help"] },
  { family: "long_plain",         expects_tools: false, expects_citations: false, use_cases: ["legal_qa", "summarization"] },
  { family: "long_tool_heavy",    expects_tools: true,  expects_citations: false, use_cases: ["code_help", "general_qa"] },
  { family: "long_doc_grounded", expects_tools: false, expects_citations: true,  use_cases: ["doc_qa", "legal_qa"] },
  { family: "long_tool_and_doc", expects_tools: true,  expects_citations: true,  use_cases: ["doc_qa", "legal_qa"] },
];

const PROMPTS_PER_BUCKET = 25;

// Deterministic variation pools (indexed by i % length)
const TOPICS = ["France", "machine learning", "TypeScript", "climate policy", "REST APIs", "legal contracts", "Python", "healthcare"];
const TOOLS = ["calculator", "search API", "database lookup", "weather API", "code executor", "document parser", "translation API", "calendar"];
const TASKS = ["compute the result", "fetch the latest data", "validate the input", "format the output", "look up the record"];
const DOC_SNIPPETS = ["Section 3.2 of the agreement states that...", "The following excerpt from the report...", "According to the contract dated..."];
const QUESTIONS = ["What is the main obligation?", "Summarize the key point.", "Which clause applies here?", "What are the risks?"];

function pick(arr, i) {
  return arr[i % arr.length];
}

function shortPlainPrompt(i, useCase) {
  if (useCase === "general_qa") {
    return `What is the capital of ${pick(TOPICS, i)}?`;
  }
  if (useCase === "code_help") {
    return `Write a one-liner in ${pick(["Python", "JavaScript", "TypeScript"], i)} to ${pick(TASKS, i)}.`;
  }
  return `Summarize the concept of ${pick(TOPICS, i)} in one sentence.`;
}

function shortToolHeavyPrompt(i, useCase) {
  const tool = pick(TOOLS, i);
  const task = pick(TASKS, i);
  if (useCase === "code_help") {
    return `Use the ${tool} tool to ${task} and return the result.`;
  }
  return `Call the ${tool} to ${task}.`;
}

function shortDocGroundedPrompt(i, useCase) {
  const doc = pick(DOC_SNIPPETS, i);
  const q = pick(QUESTIONS, i);
  if (useCase === "legal_qa") {
    return `Given: "${doc}" Question: ${q}`;
  }
  return `Document: "${doc}" Answer the following and cite: ${q}`;
}

function shortToolAndDocPrompt(i, useCase) {
  const doc = pick(DOC_SNIPPETS, i);
  const tool = pick(TOOLS, i);
  if (useCase === "doc_qa") {
    return `Using the document parser and citation tool, from this text: "${doc}" extract the answer and cite the relevant sentence.`;
  }
  return `Use the ${tool} and document parser. Document: "${doc}" Run the tool and cite the source.`;
}

function longPlainPrompt(i, useCase) {
  const topic = pick(TOPICS, i);
  if (useCase === "legal_qa") {
    return `We have a contract that includes clauses on liability, termination, and dispute resolution. Please explain how liability is limited in such agreements and what typical termination conditions apply. Focus on ${topic} as the domain.`;
  }
  return `I need a clear summary of the following: (1) What is ${topic}? (2) Why does it matter in practice? (3) What are two main challenges? Keep each part to one or two sentences.`;
}

function longToolHeavyPrompt(i, useCase) {
  const tool = pick(TOOLS, i);
  const task = pick(TASKS, i);
  if (useCase === "code_help") {
    return `First call the ${tool} to get the schema. Then use the code executor to ${task} based on that schema. Return both the schema and the result.`;
  }
  return `Step 1: Use the ${tool} to ${task}. Step 2: Validate the output. Step 3: Format it for the API response. Describe what you would do at each step.`;
}

function longDocGroundedPrompt(i, useCase) {
  const doc = pick(DOC_SNIPPETS, i);
  const q = pick(QUESTIONS, i);
  if (useCase === "legal_qa") {
    return `Consider the following contractual text: "${doc}" Please answer: ${q} Provide your answer and cite the exact phrase from the text that supports it.`;
  }
  return `Document: "${doc}" Tasks: (1) ${q} (2) List any assumptions you made. (3) Cite the sentence(s) that support your answer.`;
}

function longToolAndDocPrompt(i, useCase) {
  const doc = pick(DOC_SNIPPETS, i);
  const tool = pick(TOOLS, i);
  if (useCase === "doc_qa") {
    return `Use the document parser tool on this text: "${doc}" Then use the citation tool to extract the answer to: ${pick(QUESTIONS, i)}. Return the answer with citations.`;
  }
  return `Document: "${doc}" Use the ${tool} to validate the data in the document, then cite the relevant sections that support your validation result.`;
}

const GENERATORS = {
  short_plain: shortPlainPrompt,
  short_tool_heavy: shortToolHeavyPrompt,
  short_doc_grounded: shortDocGroundedPrompt,
  short_tool_and_doc: shortToolAndDocPrompt,
  long_plain: longPlainPrompt,
  long_tool_heavy: longToolHeavyPrompt,
  long_doc_grounded: longDocGroundedPrompt,
  long_tool_and_doc: longToolAndDocPrompt,
};

function generateSuite() {
  const out = [];
  let globalIndex = 0;
  for (const bucket of BUCKETS) {
    const useCases = bucket.use_cases;
    const gen = GENERATORS[bucket.family];
    for (let k = 0; k < PROMPTS_PER_BUCKET; k++) {
      const useCase = useCases[k % useCases.length];
      const promptText = gen(k, useCase);
      globalIndex++;
      out.push({
        id: `p_${String(globalIndex).padStart(3, "0")}`,
        family: bucket.family,
        use_case: useCase,
        prompt: promptText,
        expects_tools: bucket.expects_tools,
        expects_citations: bucket.expects_citations,
      });
    }
  }
  return out;
}

const suite = generateSuite();
const outDir = path.join(__dirname, "..", "data", "prompts");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "prompt-suite.json"),
  JSON.stringify(suite, null, 2),
  "utf8"
);
console.log(`Wrote ${suite.length} prompts to data/prompts/prompt-suite.json`);
