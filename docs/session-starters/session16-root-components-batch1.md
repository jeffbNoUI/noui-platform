# Session 16 Starter: Root Component Tests — Batch 1

## Context

Session 15 (PR #TBD, merged) added 82 tests across 14 files covering all workflow non-stage components. Workflow non-stage coverage went from 0% to 100%. 508 frontend tests passing across 61 test files.

**Test coverage audit (post Session 15):**

| Category | Total | Tested | Coverage |
|----------|-------|--------|----------|
| Dashboard cards | 10 | 10 | 100% |
| Detail panels | 5 | 5 | 100% |
| Staff dashboards | 4 | 4 | 100% |
| Workflow stages | 8 | 8 | 100% |
| Portal components | 9 | 9 | 100% |
| CRM components | 4 | 4 | 100% |
| Admin components | 4 | 3 | 75% |
| Workflow non-stage | 14 | 14 | 100% |
| **Root-level components** | **24** | **4** | **17%** |
| UI components | 1 | 0 | 0% |
| **Hooks** | **14** | **1** | **7%** |

**Session 15 brought Workflow Non-Stage to 100%.** The next highest-impact gap is root-level components (17% tested, 20 untested). These are the larger orchestrating components that compose dashboard cards, workflow stages, and CRM panels.

## Session 16 Goal

Add test coverage for root-level components batch 1 — the case/workflow orchestration components. Target: 535+ tests passing.

## Deliverables

### 1. Case & Workflow Orchestration (Required)

#### `CaseJournalPanel.test.tsx` (~4 tests)
- Renders tabs (notes, documents, correspondence)
- Switches tab content on click
- Shows empty state
- Handles case-scoped vs member-scoped mode

**Source file:** `frontend/src/components/CaseJournalPanel.tsx`

#### `CommitmentTracker.test.tsx` (~4 tests)
- Renders commitment list
- Shows search/filter input
- Opens detail overlay on click
- Shows empty state

**Source file:** `frontend/src/components/CommitmentTracker.tsx`

#### `OutreachQueue.test.tsx` (~4 tests)
- Renders outreach items
- Shows search input
- Opens detail overlay on click
- Shows max-attempts warning

**Source file:** `frontend/src/components/OutreachQueue.tsx`

### 2. CRM & Contact Panels (Required)

#### `InteractionTimeline.test.tsx` (~3 tests)
- Renders chronological interactions
- Shows direction/channel indicators
- Shows empty state

**Source file:** `frontend/src/components/InteractionTimeline.tsx`

#### `ContactInfoPanel.test.tsx` (~3 tests)
- Renders contact details
- Shows phone/email/address
- Handles missing data gracefully

**Source file:** `frontend/src/components/ContactInfoPanel.tsx`

### 3. Benefit Calculation Components (If time allows)

#### `BenefitCalcPanel.test.tsx` (~4 tests)
- Renders calculation summary
- Shows tier/multiplier/AMS fields
- Handles loading state
- Shows reduction info for early retirement

**Source file:** `frontend/src/components/BenefitCalcPanel.tsx`

#### `IPRPanel.test.tsx` (~3 tests)
- Renders IPR enrollment options
- Shows monthly amounts
- Handles no-IPR case

**Source file:** `frontend/src/components/IPRPanel.tsx`

### 4. Verify (Required)

After changes:
- `npx tsc --noEmit` — TypeScript clean
- `npm test -- --run` — All tests passing (target: 535+)
- Zero act() warnings
- No regressions in existing tests

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Mock depth | Mock hooks vs. mock API | **Mock hooks** — these are orchestrating components, test the composition not the data layer |
| Async components | waitFor vs. sync | **Read component first** — some fetch in useEffect, others receive props |
| Detail overlays | Test overlay open | **Test that click triggers** — overlay rendering is tested in detail panel tests |

## Files to Create
- `frontend/src/components/__tests__/CaseJournalPanel.test.tsx`
- `frontend/src/components/__tests__/CommitmentTracker.test.tsx`
- `frontend/src/components/__tests__/OutreachQueue.test.tsx`
- `frontend/src/components/__tests__/InteractionTimeline.test.tsx`
- `frontend/src/components/__tests__/ContactInfoPanel.test.tsx`
- `frontend/src/components/__tests__/BenefitCalcPanel.test.tsx` (if time allows)
- `frontend/src/components/__tests__/IPRPanel.test.tsx` (if time allows)

## Files to Modify
- None expected

## Acceptance Criteria

- [ ] 5+ root-level test files with 18+ tests total
- [ ] 535+ frontend tests passing, zero regressions
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Zero act() warnings in new tests

## Test Coverage Roadmap (after Session 16)

| Session | Focus | Est. Tests Added | Cumulative |
|---------|-------|-----------------|------------|
| 13 | Dashboard cards + Portals | 45 | 426 |
| 14 | CRM + Portal sub-components + ScenarioStage | 39 | 465 |
| 15 | Workflow non-stage components | 82 | 508 |
| **16** | **Root components batch 1 (Case, CRM, Benefit)** | **~25** | **~535** |
| 17 | Root components batch 2 (Scenario, DRO, Payment) | ~30 | ~565 |
| 18 | Hook unit tests (useMember, useCRM, useBenefitCalc, etc.) | ~40 | ~605 |
