# Session 17 Starter: Root Component Tests — Batch 2 (Props-Based Components)

## Context

Session 16 (PR #TBD, merged) added 45 tests across 6 files covering case/workflow orchestration, CRM, and benefit calculation components. All tests use **network-layer (fetch) mocking** — real hooks, React Query, and data transformation run in tests. 592 frontend tests passing across 67 test files.

**Testing strategy (established Session 16):** Mock at the `fetch` boundary, not at the hook level. This ensures real hooks, React Query caching, and enum normalization in `apiClient.ts` are exercised. Props-based components need no mocking at all.

**Test coverage audit (post Session 16):**

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
| **Root-level components** | **24** | **10** | **42%** |
| UI components | 1 | 0 | 0% |
| **Hooks** | **14** | **1** | **7%** |

## Session 17 Goal

Add test coverage for root-level components batch 2 — the props-based display components plus lightweight interactive ones. Target: ~630 tests passing.

## Deliverables

### 1. Props-Based Display Components (No Mocking Needed)

These components receive all data as props. Test with `render()` and fixture data.

#### `ScenarioModeler.test.tsx` (~7 tests)
- Renders scenario table with all columns (date, age, service, eligibility, Rule of N, reduction, monthly benefit)
- Highlights current retirement date row with "(current)" label
- Highlights best scenario with green text
- Returns null for empty scenarios array
- Shows "Waiting increases benefit" advisory when best > current
- Shows reduction elimination message when applicable
- Hover interaction (mouseEnter/mouseLeave on rows)

**Source file:** `frontend/src/components/ScenarioModeler.tsx`
**Props:** `{ scenarios: ScenarioEntry[], currentRetirementDate: string }`
**Type file:** `frontend/src/types/BenefitCalculation.ts` — `ScenarioEntry`

#### `DROImpactPanel.test.tsx` (~6 tests)
- Renders DRO header and marriage/divorce dates
- Shows marital share calculation (marital service, total service, fraction)
- Shows benefit division (gross, marital share, alt payee %, amount, member after DRO)
- Returns null when `has_dro` is false
- Shows division method in footer
- Formats all currency and percentage values correctly

**Source file:** `frontend/src/components/DROImpactPanel.tsx`
**Props:** `{ dro: DROCalcResult }`
**Type file:** `frontend/src/types/BenefitCalculation.ts` — `DROCalcResult`

#### `PaymentOptionsComparison.test.tsx` (~6 tests)
- Renders all four payment options (Maximum, 100% J&S, 75% J&S, 50% J&S)
- Shows factor and survivor amounts for each J&S option
- Shows "per month" labels
- Shows spousal consent warning when `maritalStatus === 'M'`
- Hides spousal consent when not married
- Shows disclaimer text

**Source file:** `frontend/src/components/PaymentOptionsComparison.tsx`
**Props:** `{ options: PaymentOptions, maritalStatus?: string }`
**Type file:** `frontend/src/types/BenefitCalculation.ts` — `PaymentOptions`, `JSOption`

#### `DeathBenefitPanel.test.tsx` (~4 tests)
- Renders death benefit header and lump-sum amount
- Shows 50 and 100 monthly installment amounts
- Shows retirement type and source reference
- Formats all currency values correctly

**Source file:** `frontend/src/components/DeathBenefitPanel.tsx`
**Props:** `{ deathBenefit: DeathBenefitDetail }`
**Type file:** `frontend/src/types/BenefitCalculation.ts` — `DeathBenefitDetail`

#### `ServiceCreditSummary.test.tsx` (~5 tests)
- Renders earned service years and total
- Shows purchased service when > 0
- Shows military service when > 0
- Hides purchased/military rows when 0
- Shows purchased service distinction callout (benefit formula vs eligibility)

**Source file:** `frontend/src/components/ServiceCreditSummary.tsx`
**Props:** `{ summary: ServiceCreditSummary }`
**Type file:** `frontend/src/types/Member.ts` — `ServiceCreditSummary`

#### `EmploymentTimeline.test.tsx` (~5 tests)
- Renders employment events in order
- Shows event type labels (Hired, Promotion, Transfer, etc.)
- Shows dates, department, position codes
- Shows salary when present
- Shows separation reason for SEPARATION events

**Source file:** `frontend/src/components/EmploymentTimeline.tsx`
**Props:** `{ events: EmploymentEvent[] }`
**Type file:** `frontend/src/types/Member.ts` — `EmploymentEvent`

#### `MemberBanner.test.tsx` (~5 tests)
- Renders member name (first, optional middle, last)
- Shows initials avatar, member ID, department, position
- Shows tier badge and status badge
- Displays DOB, hire date, marital status, medicare, email
- Shows termination date when present

**Source file:** `frontend/src/components/MemberBanner.tsx`
**Props:** `{ member: Member }`
**Type file:** `frontend/src/types/Member.ts` — `Member`

### 2. Verify (Required)

After all tests are written:
- `npx tsc --noEmit` — TypeScript clean
- `npm test -- --run` — All tests passing (target: ~630)
- Zero act() warnings
- No regressions in existing tests

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Mock depth | Mock hooks vs. mock fetch vs. props | **Props only** — all 7 components are props-based, no fetch mocking needed |
| Fixtures | Inline vs. shared | **Inline per test file** — keeps tests self-contained, fixtures are small |
| CollapsibleSection | getByText vs. getAllByText | **Use getAllByText** when badge text duplicates content (CSS grid `0fr` keeps collapsed content in DOM) |
| Formatter testing | Test formatter output vs. test presence | **Test formatted output** — confirms both rendering and correct formatter usage |

## Files to Create
- `frontend/src/components/__tests__/ScenarioModeler.test.tsx`
- `frontend/src/components/__tests__/DROImpactPanel.test.tsx`
- `frontend/src/components/__tests__/PaymentOptionsComparison.test.tsx`
- `frontend/src/components/__tests__/DeathBenefitPanel.test.tsx`
- `frontend/src/components/__tests__/ServiceCreditSummary.test.tsx`
- `frontend/src/components/__tests__/EmploymentTimeline.test.tsx`
- `frontend/src/components/__tests__/MemberBanner.test.tsx`

## Files to Modify
- None expected

## Acceptance Criteria

- [ ] 7 new test files with ~38 tests total
- [ ] ~630 frontend tests passing, zero regressions
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Zero act() warnings in new tests
- [ ] All tests use real component rendering (no hook mocking)

## Test Coverage Roadmap (after Session 17)

| Session | Focus | Est. Tests Added | Cumulative |
|---------|-------|-----------------|------------|
| 16 | Root components batch 1 (Case, CRM, Benefit) | 45 | 592 |
| **17** | **Root components batch 2 (Scenario, DRO, Payment, Member)** | **~38** | **~630** |
| 18 | Hook unit tests (useMember, useCRM, useBenefitCalc, etc.) | ~40 | ~670 |
| 19 | Remaining root components (CRMWorkspace, ContactSearch, ConversationPanel, etc.) | ~35 | ~705 |
| 20 | ErrorBoundary + UI components + coverage gaps | ~20 | ~725 |
