# Front-End Integration Plan: Aligning with JSON Schemas

## Executive Summary

The current front-end uses **mock data** and doesn't integrate with the actual backend analysis outputs. This plan outlines all changes needed to connect the UI to the real data structures defined in `docs/JSON_SCHEMAS.md`.

---

## Current State Analysis

### ❌ What's Missing/Wrong:

1. **No Data Fetching**: Front-end uses hardcoded mock data, no API calls to load `analysis.json`, `comparisons.json`, `distributions.json`
2. **Config Structure Mismatch**: UI config form uses different fields than actual config files (`config-a.json`, `config-b.json`)
3. **Probability Display**: Shows single percentage instead of pairwise comparisons from `comparisons.json`
4. **Distribution Charts**: Shows latency/token data instead of failure modes and prompt families
5. **Failure Breakdown**: Uses mock failure modes that don't match the actual enum values
6. **Prompt Selector**: Uses hardcoded families instead of actual prompt suite data
7. **No API Routes**: Missing API routes to serve the JSON output files

---

## Required Changes

### 1. Create API Routes to Serve JSON Files

**Location**: `app/api/analysis/route.ts`, `app/api/comparisons/route.ts`, `app/api/distributions/route.ts`

**Purpose**: Serve the output JSON files from `output/` directory

**Implementation**:
```typescript
// app/api/analysis/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'output', 'analysis.json');
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ configs: {} }, { status: 200 });
  }
}
```

**Files to Create**:
- `app/api/analysis/route.ts` - serves `output/analysis.json`
- `app/api/comparisons/route.ts` - serves `output/comparisons.json`
- `app/api/distributions/route.ts` - serves `output/distributions.json`

---

### 2. Update Config Form Component

**File**: `components/config-form.tsx`

**Current Issues**:
- Uses `budgetCost` instead of `cost_per_1k_tokens`
- Uses `topK` instead of `top_k`
- Uses `contextWindow` instead of `context_window`
- Uses `chunkSize` instead of `chunk_size`
- Uses `maxOutputTokens` instead of `max_output_tokens`
- Uses `toolsEnabled` instead of `tools_enabled`
- Missing `model` field
- Missing `id` field

**Required Changes**:
```typescript
interface Config {
  id: string;
  model: string;
  context_window: number;
  top_k: number;
  chunk_size: number;
  max_output_tokens: number;
  tools_enabled: boolean;
  temperature: number;
  cost_per_1k_tokens: number;
}
```

**Update all field names** in the form to match the schema.

---

### 3. Update Probability Card Component

**File**: `components/probability-card.tsx`

**Current State**: Shows single percentage `P(Config B is safer than A)`

**Required Changes**:
- Accept `comparisons.json` data structure
- Display multiple pairwise comparisons
- Show `p_a_safer` values for each config pair
- Handle edge case: `p_a_safer === 0.5` means "indeterminate" (show "N/A")

**New Props**:
```typescript
interface ProbabilityCardProps {
  comparisons: Array<{
    config_a: string;
    config_b: string;
    p_a_safer: number;
  }>;
  selectedConfigA?: string;
  selectedConfigB?: string;
}
```

**Display Format**:
- Show all comparisons in a list or grid
- Highlight the comparison for currently selected configs
- Format: "P(A safer than B): 92%" or "P(A safer than B): N/A" if 0.5

---

### 4. Update Distribution Charts Component

**File**: `components/distribution-charts.tsx`

**Current State**: Shows latency distribution and token distribution (mock data)

**Required Changes**:
- Replace with failure mode distribution chart
- Replace with prompt family distribution chart
- Use data from `distributions.json`

**New Props**:
```typescript
interface DistributionChartsProps {
  byFailureMode: {
    [key: string]: {
      failure_mode: string;
      count: number;
      proportion: number;
    };
  };
  byPromptFamily: {
    [key: string]: {
      family: string;
      count: number;
      proportion: number;
    };
  };
}
```

**Chart Updates**:
1. **Failure Mode Chart**: Bar chart showing count/proportion for each failure mode:
   - `context_overflow`
   - `silent_truncation_risk`
   - `latency_breach`
   - `cost_runaway`
   - `tool_timeout_risk`
   - `retrieval_noise_risk`

2. **Prompt Family Chart**: Bar chart showing count/proportion for each prompt family (e.g., `short_plain`, `long_context`, `unknown`)

**Data Transformation**:
```typescript
// Convert distributions.json to chart data
const failureModeData = Object.values(byFailureMode).map(entry => ({
  name: entry.failure_mode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  count: entry.count,
  proportion: entry.proportion
}));
```

---

### 5. Update Failure Breakdown Component

**File**: `components/failure-breakdown.tsx`

**Current State**: Uses mock data with custom failure modes

**Required Changes**:
- Use actual failure mode enum values from schema
- Map severity based on failure mode type:
  - HIGH: `context_overflow`, `cost_runaway`, `tool_timeout_risk`
  - MED: `silent_truncation_risk`, `latency_breach`, `retrieval_noise_risk`

**New Props**:
```typescript
interface FailureBreakdownProps {
  byFailureMode: {
    [key: string]: {
      failure_mode: string;
      count: number;
      proportion: number;
    };
  };
}
```

**Display Logic**:
- Show each failure mode from `byFailureMode`
- Display count and proportion
- Color code by severity (HIGH/MED based on failure mode type)

---

### 6. Update Main Dashboard Page

**File**: `app/page.tsx`

**Required Changes**:

1. **Add Data Fetching**:
```typescript
const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
const [comparisonsData, setComparisonsData] = useState<ComparisonsData | null>(null);
const [distributionsData, setDistributionsData] = useState<DistributionsData | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchData() {
    try {
      const [analysis, comparisons, distributions] = await Promise.all([
        fetch('/api/analysis').then(r => r.json()),
        fetch('/api/comparisons').then(r => r.json()),
        fetch('/api/distributions').then(r => r.json()),
      ]);
      setAnalysisData(analysis);
      setComparisonsData(comparisons);
      setDistributionsData(distributions);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }
  fetchData();
}, []);
```

2. **Update Config Loading**:
   - Load actual config files from `configs/` directory
   - Use API route or load directly

3. **Update Component Props**:
   - Pass real data to all components
   - Remove all mock data

4. **Add Confidence Bands Display**:
   - Show `ci_bootstrap` or `ci_bayesian` from `analysis.json`
   - Display as error bars or shaded regions on charts

---

### 7. Update Prompt Selector Component

**File**: `components/prompt-selector.tsx`

**Current State**: Uses hardcoded prompt families

**Required Changes**:
- Load actual prompt families from `data/prompts/suite.json` or `data/prompts/prompt-suite.json`
- Create API route: `app/api/prompts/route.ts` to serve prompt suite
- Display actual family names from the data

**New Props**:
```typescript
interface PromptSelectorProps {
  promptFamilies: Array<{
    family: string;
    count?: number;
  }>;
  selected: string;
  onSelect: (family: string) => void;
  onRunSimulation: () => void;
  isRunning: boolean;
}
```

---

### 8. Add Confidence Interval Visualization

**New Component**: `components/confidence-band.tsx`

**Purpose**: Display confidence intervals from `analysis.json`

**Props**:
```typescript
interface ConfidenceBandProps {
  configs: {
    [configId: string]: {
      config_id: string;
      phat: number;
      ci_bootstrap?: [number, number];
      ci_bayesian?: [number, number];
    };
  };
}
```

**Display**: 
- Line chart with failure rate (phat) per config
- Shaded bands showing confidence intervals
- Use `ci_bootstrap` or `ci_bayesian` (prefer bootstrap if available)

---

### 9. Update Type Definitions

**File**: Create `types/dashboard.ts` or add to existing types

**Required Types**:
```typescript
// From analysis.json
export interface ConfigStats {
  config_id: string;
  k: number;
  n: number;
  phat: number;
  ci_bootstrap?: [number, number];
  ci_bayesian?: [number, number];
}

export interface AnalysisData {
  configs: {
    [configId: string]: ConfigStats;
  };
}

// From comparisons.json
export interface Comparison {
  config_a: string;
  config_b: string;
  p_a_safer: number;
}

export interface ComparisonsData {
  comparisons: Comparison[];
}

// From distributions.json
export interface DistributionEntry {
  failure_mode?: string;
  family?: string;
  count: number;
  proportion: number;
}

export interface DistributionsData {
  by_failure_mode: {
    [key: string]: DistributionEntry & { failure_mode: string };
  };
  by_prompt_family: {
    [key: string]: DistributionEntry & { family: string };
  };
}
```

---

## Implementation Priority

### Phase 1: Data Infrastructure (Critical)
1. ✅ Create API routes for JSON files
2. ✅ Add TypeScript types
3. ✅ Update main page to fetch data

### Phase 2: Component Updates (High Priority)
4. ✅ Update Probability Card for comparisons
5. ✅ Update Distribution Charts for failure modes/prompt families
6. ✅ Update Failure Breakdown for actual failure modes

### Phase 3: Config & Prompt Integration (Medium Priority)
7. ✅ Update Config Form to match schema
8. ✅ Update Prompt Selector to use real data

### Phase 4: Enhanced Visualizations (Nice to Have)
9. ✅ Add Confidence Band component
10. ✅ Add loading states and error handling

---

## Testing Checklist

- [ ] API routes return correct JSON data
- [ ] Config form matches actual config file structure
- [ ] Probability card displays all pairwise comparisons
- [ ] Distribution charts show failure modes and prompt families
- [ ] Failure breakdown uses correct enum values
- [ ] Prompt selector loads actual prompt families
- [ ] Confidence intervals are displayed correctly
- [ ] Edge cases handled (empty data, missing fields)
- [ ] Loading states work properly
- [ ] Error handling for failed API calls

---

## Files to Modify

### New Files:
- `app/api/analysis/route.ts`
- `app/api/comparisons/route.ts`
- `app/api/distributions/route.ts`
- `app/api/prompts/route.ts` (optional)
- `components/confidence-band.tsx`
- `types/dashboard.ts`

### Modified Files:
- `app/page.tsx` - Add data fetching, remove mocks
- `components/config-form.tsx` - Update field names
- `components/probability-card.tsx` - Use comparisons data
- `components/distribution-charts.tsx` - Use distributions data
- `components/failure-breakdown.tsx` - Use failure mode data
- `components/prompt-selector.tsx` - Use real prompt families

---

## Notes for v0/Cursor

When regenerating or updating components in v0:

1. **Specify Data Sources**: Tell v0 to use API routes (`/api/analysis`, `/api/comparisons`, `/api/distributions`)
2. **Field Names**: Emphasize using snake_case for config fields (`context_window`, `top_k`, etc.)
3. **Failure Modes**: Use exact enum values: `context_overflow`, `silent_truncation_risk`, `latency_breach`, `cost_runaway`, `tool_timeout_risk`, `retrieval_noise_risk`
4. **Data Structures**: Reference the JSON schema structure explicitly
5. **TypeScript Types**: Include type definitions matching the schemas
6. **Edge Cases**: Handle empty data, missing confidence intervals, indeterminate comparisons (0.5)

---

## Example v0 Prompt

```
Update the dashboard to integrate with backend analysis outputs:

1. Create API routes to serve:
   - /api/analysis → output/analysis.json
   - /api/comparisons → output/comparisons.json  
   - /api/distributions → output/distributions.json

2. Update ProbabilityCard to display pairwise comparisons from comparisons.json:
   - Show all config pairs with p_a_safer values
   - Display "N/A" when p_a_safer === 0.5 (indeterminate)

3. Update DistributionCharts to show:
   - Failure mode distribution (by_failure_mode from distributions.json)
   - Prompt family distribution (by_prompt_family from distributions.json)
   - Use count and proportion values

4. Update ConfigForm to match actual config schema:
   - Use snake_case: context_window, top_k, chunk_size, max_output_tokens, tools_enabled, cost_per_1k_tokens
   - Include id and model fields

5. Add confidence interval visualization showing ci_bootstrap or ci_bayesian from analysis.json

Use TypeScript with proper types matching the JSON schemas in docs/JSON_SCHEMAS.md
```

