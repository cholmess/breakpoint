# Generate synthetic prompt suite (200 prompts) per plan. 8 families x 25; deterministic.
$ErrorActionPreference = "Stop"
$TOPICS = @("France", "machine learning", "TypeScript", "climate policy", "REST APIs", "legal contracts", "Python", "healthcare")
$TOOLS = @("calculator", "search API", "database lookup", "weather API", "code executor", "document parser", "translation API", "calendar")
$TASKS = @("compute the result", "fetch the latest data", "validate the input", "format the output", "look up the record")
$DOC_SNIPPETS = @("Section 3.2 of the agreement states that...", "The following excerpt from the report...", "According to the contract dated...")
$QUESTIONS = @("What is the main obligation?", "Summarize the key point.", "Which clause applies here?", "What are the risks?")

function Pick($arr, $i) { $arr[$i % $arr.Length] }

$buckets = @(
  @{ family = "short_plain";        expects_tools = $false; expects_citations = $false; use_cases = @("general_qa", "code_help", "summarization") },
  @{ family = "short_tool_heavy";   expects_tools = $true;  expects_citations = $false; use_cases = @("code_help", "general_qa") },
  @{ family = "short_doc_grounded"; expects_tools = $false; expects_citations = $true;  use_cases = @("doc_qa", "legal_qa") },
  @{ family = "short_tool_and_doc"; expects_tools = $true;  expects_citations = $true;  use_cases = @("doc_qa", "code_help") },
  @{ family = "long_plain";         expects_tools = $false; expects_citations = $false; use_cases = @("legal_qa", "summarization") },
  @{ family = "long_tool_heavy";    expects_tools = $true;  expects_citations = $false; use_cases = @("code_help", "general_qa") },
  @{ family = "long_doc_grounded";  expects_tools = $false; expects_citations = $true;  use_cases = @("doc_qa", "legal_qa") },
  @{ family = "long_tool_and_doc"; expects_tools = $true;  expects_citations = $true;  use_cases = @("doc_qa", "legal_qa") }
)

$suite = [System.Collections.ArrayList]@()
$globalIndex = 0
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path (Join-Path $scriptRoot "..") "data"; $outDir = Join-Path $outDir "prompts"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

foreach ($bucket in $buckets) {
  $uc = $bucket.use_cases
  $fam = $bucket.family
  for ($k = 0; $k -lt 25; $k++) {
    $globalIndex++
    $useCase = $uc[$k % $uc.Length]
    $promptText = ""
    switch ($fam) {
      "short_plain" {
        if ($useCase -eq "general_qa") { $promptText = "What is the capital of $(Pick $TOPICS $k)?" }
        elseif ($useCase -eq "code_help") { $promptText = "Write a one-liner in $(Pick @("Python","JavaScript","TypeScript") $k) to $(Pick $TASKS $k)." }
        else { $promptText = "Summarize the concept of $(Pick $TOPICS $k) in one sentence." }
      }
      "short_tool_heavy" {
        if ($useCase -eq "code_help") { $promptText = "Use the $(Pick $TOOLS $k) tool to $(Pick $TASKS $k) and return the result." }
        else { $promptText = "Call the $(Pick $TOOLS $k) to $(Pick $TASKS $k)." }
      }
      "short_doc_grounded" {
        $doc = Pick $DOC_SNIPPETS $k; $q = Pick $QUESTIONS $k
        if ($useCase -eq "legal_qa") { $promptText = "Given: `"$doc`" Question: $q" }
        else { $promptText = "Document: `"$doc`" Answer the following and cite: $q" }
      }
      "short_tool_and_doc" {
        $doc = Pick $DOC_SNIPPETS $k; $tool = Pick $TOOLS $k
        if ($useCase -eq "doc_qa") { $promptText = "Using the document parser and citation tool, from this text: `"$doc`" extract the answer and cite the relevant sentence." }
        else { $promptText = "Use the $tool and document parser. Document: `"$doc`" Run the tool and cite the source." }
      }
      "long_plain" {
        $topic = Pick $TOPICS $k
        if ($useCase -eq "legal_qa") { $promptText = "We have a contract that includes clauses on liability, termination, and dispute resolution. Please explain how liability is limited in such agreements and what typical termination conditions apply. Focus on $topic as the domain." }
        else { $promptText = "I need a clear summary of the following: (1) What is $topic? (2) Why does it matter in practice? (3) What are two main challenges? Keep each part to one or two sentences." }
      }
      "long_tool_heavy" {
        $tool = Pick $TOOLS $k; $task = Pick $TASKS $k
        if ($useCase -eq "code_help") { $promptText = "First call the $(Pick $TOOLS $k) to get the schema. Then use the code executor to $task based on that schema. Return both the schema and the result." }
        else { $promptText = "Step 1: Use the $tool to $task. Step 2: Validate the output. Step 3: Format it for the API response. Describe what you would do at each step." }
      }
      "long_doc_grounded" {
        $doc = Pick $DOC_SNIPPETS $k; $q = Pick $QUESTIONS $k
        if ($useCase -eq "legal_qa") { $promptText = "Consider the following contractual text: `"$doc`" Please answer: $q Provide your answer and cite the exact phrase from the text that supports it." }
        else { $promptText = "Document: `"$doc`" Tasks: (1) $q (2) List any assumptions you made. (3) Cite the sentence(s) that support your answer." }
      }
      "long_tool_and_doc" {
        $doc = Pick $DOC_SNIPPETS $k; $tool = Pick $TOOLS $k
        if ($useCase -eq "doc_qa") { $promptText = "Use the document parser tool on this text: `"$doc`" Then use the citation tool to extract the answer to: $(Pick $QUESTIONS $k). Return the answer with citations." }
        else { $promptText = "Document: `"$doc`" Use the $tool to validate the data in the document, then cite the relevant sections that support your validation result." }
      }
    }
    [void]$suite.Add(@{
      id = "p_$($globalIndex.ToString().PadLeft(3,'0'))"
      family = $fam
      use_case = $useCase
      prompt = $promptText
      expects_tools = $bucket.expects_tools
      expects_citations = $bucket.expects_citations
    })
  }
}

$jsonPath = Join-Path $outDir "prompt-suite.json"
$suite | ConvertTo-Json -Depth 10 | Set-Content -Path $jsonPath -Encoding UTF8
Write-Host "Wrote $($suite.Count) prompts to data/prompts/prompt-suite.json"
