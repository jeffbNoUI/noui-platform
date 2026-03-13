# Member Dashboard Enhancement — Design Document

**Date:** 2026-03-13
**Status:** Approved
**Scope:** Enhanced AI summary (hybrid context + action items), action-first layout restructure, summary logging scaffold

---

## 1. Problem Statement

The current Member Dashboard AI summary is a flat paragraph of inventory-style sentences — every member gets the same template with different numbers plugged in. It reads like a data dump rather than a personalized briefing.

The layout gives equal visual weight to active work items and historical/reference data, despite staff primarily visiting the dashboard to act on in-process work.

## 2. Goals

1. **Personalized summary** — hybrid format: context narrative + prioritized attention items
2. **Action-first layout** — active work (cases, commitments) dominates; historical data moves to compact reference sidebar
3. **LLM-ready architecture** — structured return type that a future LLM endpoint can produce without changing consumers
4. **Summary logging** — accumulate deterministic summary corpus for future LLM training/validation

## 3. Summary Engine Restructure

### New Return Type

```typescript
interface AttentionItem {
  severity: 'critical' | 'high' | 'medium' | 'info';
  label: string;        // e.g., "Overdue commitment"
  detail: string;       // e.g., "Send estimate — due Feb 1"
}

interface MemberSummaryResult {
  context: string;              // One-sentence member narrative
  attentionItems: AttentionItem[];  // Prioritized action list
}
```

### Context Line Logic

Builds a single sentence from the most salient facts:
- Tenure + tier (always present)
- Eligibility status (if available): "Rule of 75 eligible, no reduction" or "not yet vested"
- Active case stage (if one exists): "Case at Benefit Calculation (4/7)"

### Attention Items — Priority Order

1. **Critical**: Overdue commitments
2. **High**: Urgent-priority cases, missing beneficiary designations
3. **Medium**: DQ issues flagged, commitments due within 7 days
4. **Info**: Positive confirmations — "Beneficiaries current", "No DQ issues"

### LLM-Ready Signature

```typescript
// Phase 1: synchronous deterministic
export function generateMemberSummary(input: MemberSummaryInput): MemberSummaryResult {
  return buildDeterministicSummary(input);
}

// Phase 2 (future): async LLM call, same return type
// export async function generateMemberSummary(input: MemberSummaryInput): Promise<MemberSummaryResult> {
//   return fetchLLMSummary(input);
// }
```

Consumers receive the same `MemberSummaryResult` regardless of which implementation backs it.

## 4. Summary Logging Scaffold

### Purpose

Accumulate deterministic summary examples so that when the LLM is wired in, there's a corpus for:
- Few-shot prompting
- Validation (compare LLM output against deterministic baseline)
- Fallback (serve deterministic version if LLM call fails)

### Frontend

Fire-and-forget POST after each summary generation:

```
POST /api/v1/intelligence/summary-log
Body: {
  memberId: number,
  inputHash: string,    // SHA-256 of JSON.stringify(input)
  input: MemberSummaryInput,
  output: MemberSummaryResult
}
```

### Backend (Intelligence Service)

```sql
CREATE TABLE member_summary_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     INTEGER NOT NULL,
  input_hash    TEXT NOT NULL,
  input_json    JSONB NOT NULL,
  output_json   JSONB NOT NULL,
  generated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_summary_log_member ON member_summary_log(member_id);
CREATE INDEX idx_summary_log_hash ON member_summary_log(input_hash);
```

Dedup: skip insert if `input_hash` matches the most recent entry for that member.

## 5. Dashboard Layout Restructure

### Current Layout

```
Banner (full width)
AI Summary (full width, flat paragraph)
┌──────────────────────────┬─────────────┐
│ 2/3 column               │ 1/3 column  │
│ ActiveWork               │ SvcCredit   │
│ InteractionHistory       │ Beneficiary │
│ CorrespondenceHistory    │ DataQuality │
└──────────────────────────┴─────────────┘
```

### New Layout

```
Banner (full width)
Enhanced AI Summary (context + attention items)
┌──────────────────────────┬─────────────┐
│ 2/3 — Action Zone        │ 1/3 — Ref   │
│ In-Process Work          │ Interactions│
│ (cases + commitments)    │ Correspond. │
│                          │ Svc Credit  │
│                          │ Beneficiary │
│                          │ Data Quality│
└──────────────────────────┴─────────────┘
```

### Key Changes

- **ActiveWorkCard** takes the full left 2/3 — cases and commitments get prime real estate
- **Right 1/3** becomes compact reference cards — count + most recent item + "View all" drill-down trigger
- **InteractionHistoryCard, CorrespondenceHistoryCard** move from left column to right column as compact cards
- **ServiceCreditCard, BeneficiaryCard, DataQualityCard** stay in right column but become compact

### Compact Reference Card Format

Each reference card shows:
- Header + count badge
- Most recent/notable item (1 line)
- Divider
- "View all →" drill-down trigger

## 6. Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/memberSummary.ts` | Modify | New `MemberSummaryResult` type, restructured generator, attention item logic |
| `components/dashboard/MemberSummaryCard.tsx` | Modify | Structured layout: context line + attention item bullets with severity colors |
| `components/dashboard/MemberDashboard.tsx` | Modify | Restructure grid: 2/3 action zone + 1/3 reference sidebar |
| `components/dashboard/ReferenceCard.tsx` | New | Generic compact card shell for reference sidebar items |
| `components/dashboard/InteractionHistoryCard.tsx` | Modify | Add compact mode (count + last item + drill-down) |
| `components/dashboard/CorrespondenceHistoryCard.tsx` | Modify | Add compact mode |
| `components/dashboard/ServiceCreditCard.tsx` | Modify | Add compact mode |
| `components/dashboard/BeneficiaryCard.tsx` | Modify | Add compact mode |
| `components/dashboard/DataQualityCard.tsx` | Modify | Add compact mode |
| `hooks/useMemberDashboard.ts` | Modify | Wire summary log POST, update summary type |
| `lib/__tests__/memberSummary.test.ts` | Modify | Tests for structured return type + attention items |
| `platform/intelligence/` | Modify | New `/summary-log` endpoint + migration |

## 7. What Does NOT Change

- MemberBanner component (unchanged)
- ActiveWorkCard content (cases + commitments — already good)
- All drill-down overlay behavior
- All existing hooks and API calls
- All existing tests (additive changes only)

## 8. Testing Strategy

- **Unit**: `memberSummary.test.ts` — structured output, attention item prioritization, severity assignment
- **Component**: MemberSummaryCard renders context + attention items correctly
- **Integration**: Summary log POST fires and deduplicates correctly
- **Visual**: Browser verification of new layout via preview tools
