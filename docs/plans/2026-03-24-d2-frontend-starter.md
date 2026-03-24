# Session Starter: False Cognate Warning Badges (D2 Frontend)

## Context

Session 34 completed **Deliverable 2 backend** — the false cognate warning system. The mapper now attaches `MappingWarning` objects to `ColumnMatch` results when a matched term is a known false cognate. Warnings are informational only (they don't block matching or reduce confidence). The API at `POST /api/v1/engagements/:id/mappings` already returns warnings in the JSON response.

## What to Read First

1. `BUILD_HISTORY.md` — Session 34 entry
2. `platform/migration/mapper/template.go` — `MappingWarning` struct definition
3. `platform/migration/mapper/matcher.go` — `ColumnMatch.Warnings` field, `AttachFalseCognateWarnings()`
4. `platform/migration/mapper/false_cognate_test.go` — test cases showing warning shape
5. `frontend/src/types/Migration.ts` — current `ColumnMatch` type (needs `warnings` field)
6. `frontend/src/components/migration/engagement/MappingReview.tsx` — mapping table UI (if exists)

## Task: D2 Frontend — Warning Badges + Acknowledgment

### API Response Shape

```json
{
  "source_column": "membership_service",
  "source_type": "decimal(6,2)",
  "canonical_column": "credited_years_total",
  "confidence": 0.9,
  "match_method": "pattern",
  "warnings": [
    {
      "term": "membership_service",
      "warning": "In some systems refers to membership status period, not credited service time",
      "risk": "HIGH"
    }
  ]
}
```

### Implementation Steps

1. **Types** — Add `MappingWarning` type and `warnings?: MappingWarning[]` to `ColumnMatch` in `frontend/src/types/Migration.ts`

2. **Warning badge on mapping rows** — In the mapping review table, show a yellow/amber warning icon next to any row where `warnings.length > 0`. Badge should indicate risk level (HIGH = red-amber, MEDIUM = yellow).

3. **Warning detail popover** — Clicking the badge shows a popover with:
   - The false cognate term
   - The warning explanation text
   - The risk level
   - An "Acknowledge" button

4. **Acknowledgment gate** — Analyst must acknowledge all warnings on a mapping before the "Approve Mapping" button becomes enabled. Track acknowledgment in local component state (not persisted to backend yet — that's a D3 concern).

### Design Guidance

- Use existing Tailwind utility classes and project icon patterns
- Warning badge: `bg-amber-100 text-amber-800 border-amber-300` for MEDIUM, `bg-red-100 text-red-800 border-red-300` for HIGH
- Popover: use existing popover/tooltip pattern from the codebase if one exists
- Keep it accessible: badge should have `aria-label` describing the warning

### Verification Gate

- Frontend typecheck clean
- Existing frontend tests pass with no regressions
- New test: mapping row with warnings shows badge
- New test: approve button disabled when unacknowledged warnings exist
- Visual verification via preview tools: badge renders, popover opens, acknowledge works
