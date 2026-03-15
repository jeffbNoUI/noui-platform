# Session 13 Starter: Portal Tests + Dashboard Card Coverage

## Context

Session 12 (PR pending) added 10 CSR Hub tests and replaced VendorPortal fake enrollment queue with a Coming Soon overlay. 368 frontend tests passing across 38 test files.

**Test coverage audit (from Session 12 analysis):**

| Category | Components | Tested | Gap |
|----------|-----------|--------|-----|
| Workflow stages | 7 | 7 | None |
| Staff dashboards | 3 (Supervisor, Executive, CSR Hub) | 3 | None |
| Dashboard cards | 11 | 6 | **5 untested** |
| Portal components | 7 | 0 | **7 untested** |
| Root components | 20+ | 5 | Many |
| Hooks | 12 | 0 | All |

**The biggest bang-for-effort gaps are the 5 untested dashboard cards (small, props-only components) and the 3 portal components (customer-facing, API-wired).**

## Session 13 Goal

Add test coverage for the 5 untested dashboard cards and the 3 portal components. Remove `DEMO_BENEFICIARY` fallback from MemberPortal.

## Deliverables

### 1. Dashboard Card Tests (Required)

These are small presentational components (80-170 lines each, props-only, no hooks). Fast to test.

**Create test files:**

#### `ActiveWorkCard.test.tsx` (~5 tests)
- Renders case list with member names, stages, SLA badges
- Shows commitment items with due dates
- Shows empty state when no cases or commitments
- Handles `onCaseClick` callback
- Displays correct SLA color coding (on-track/at-risk/overdue)

#### `BeneficiaryCard.test.tsx` (~3 tests)
- Renders beneficiary name, relationship, allocation percentage
- Shows "No beneficiary" warning when data is null/empty
- Click triggers drill-down callback

#### `MemberSummaryCard.test.tsx` (~3 tests)
- Renders member name, tier badge, department, status
- Shows hire date formatted correctly
- Handles missing optional fields gracefully

#### `ServiceCreditCard.test.tsx` (~3 tests)
- Renders earned years, purchased years, military years
- Shows total service credit
- Handles zero purchased/military years (doesn't show them)

#### `ReferenceCard.test.tsx` (~3 tests)
- Renders KB articles relevant to current stage
- Shows "No references" when empty
- Click triggers article detail callback

**Mock pattern:** These are pure presentational components — pass props directly, no hook mocking needed. Follow the pattern from existing `CorrespondenceHistoryCard.test.tsx`.

### 2. Portal Component Tests (Required)

These are larger components (80-1500 lines) that use hooks. Follow the mock pattern from `SupervisorDashboard.test.tsx`.

#### `VendorPortal.test.tsx` (~3 tests)
- Renders nav bar with "Vendor Portal" title and user name
- Renders stats cards (Pending Enrollments, Enrolled This Month, Avg IPR)
- Shows "Coming Soon" enrollment queue placeholder
- `onChangeView` callback fires when "Back to Staff" is clicked

#### `EmployerPortal.test.tsx` (~5 tests)
- Renders organization selector and tab navigation
- Enrollment tab shows member list from live API
- Correspondence tab renders history
- Reporting tab shows "Coming Soon" overlay
- `onChangeView` callback works

#### `MemberPortal.test.tsx` (~6 tests)
- Renders member header with name, tier, department
- Shows benefit summary card with estimated monthly benefit
- Shows contribution summary (employee + employer totals)
- Shows beneficiary information
- Messaging tab renders conversation thread
- Letters tab shows correspondence history

**Hooks to mock for MemberPortal:**
- `useMember`, `useServiceCredit`, `useContributions`, `useBeneficiaries` from `@/hooks/useMember`
- `useBenefitCalculation` from `@/hooks/useBenefitCalculation`
- `useCorrespondenceHistory` from `@/hooks/useCorrespondence`
- CRM hooks from `@/hooks/useCRM`

**Hooks to mock for EmployerPortal:**
- CRM hooks from `@/hooks/useCRM`
- `useCorrespondenceHistory` from `@/hooks/useCorrespondence`

### 3. Remove DEMO_BENEFICIARY from MemberPortal (Nice to Have)

`MemberPortal.tsx` has 4 `DEMO_*` constants used as fallback when APIs are unavailable. The `DEMO_BENEFICIARY` can be removed — when no beneficiaries exist, show "No beneficiary on file" instead of fake data.

**Current pattern (line 403):**
```typescript
const primaryBeneficiary = beneficiaries?.[0] ?? (useDemo ? DEMO_BENEFICIARY : null);
```

**Target pattern:**
```typescript
const primaryBeneficiary = beneficiaries?.[0] ?? null;
```

**Note:** The other `DEMO_*` constants (`DEMO_MEMBER`, `DEMO_CONTRIBUTIONS`, `DEMO_MONTHLY_BENEFIT`) serve as a complete fallback experience when APIs are down. Removing them all at once would make the portal show nothing on API failure. Consider keeping them as graceful degradation or replacing with proper loading/error states in a future session.

### 4. Verify (Required)

After changes:
- `npx tsc --noEmit` — TypeScript clean
- `npm test -- --run` — All tests passing (target: 395+ with new tests)
- Zero act() warnings
- No regressions in existing tests

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Dashboard card test approach | Props-only vs. integration | **Props-only** — cards are presentational |
| Portal test approach | Full render vs. shallow + mocks | **Full render + hook mocks** — follow CSR Hub pattern |
| MemberPortal DEMO_* removal | Remove all vs. remove one | **Remove DEMO_BENEFICIARY only** — keep others as graceful degradation |
| VendorPortal test depth | Test Coming Soon vs. skip | **Test it** — validates the placeholder renders correctly |

## Files to Create
- `frontend/src/components/dashboard/__tests__/ActiveWorkCard.test.tsx`
- `frontend/src/components/dashboard/__tests__/BeneficiaryCard.test.tsx`
- `frontend/src/components/dashboard/__tests__/MemberSummaryCard.test.tsx`
- `frontend/src/components/dashboard/__tests__/ServiceCreditCard.test.tsx`
- `frontend/src/components/dashboard/__tests__/ReferenceCard.test.tsx`
- `frontend/src/components/portal/__tests__/VendorPortal.test.tsx`
- `frontend/src/components/portal/__tests__/EmployerPortal.test.tsx`
- `frontend/src/components/portal/__tests__/MemberPortal.test.tsx`

## Files to Modify
- `frontend/src/components/portal/MemberPortal.tsx` — remove `DEMO_BENEFICIARY` (optional)

## Acceptance Criteria

- [ ] 5 dashboard card test files with 15+ tests total
- [ ] 3 portal test files with 12+ tests total
- [ ] 395+ frontend tests passing, zero regressions
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Zero act() warnings in new tests

## Test Coverage Roadmap (after Session 13)

| Session | Focus | Est. Tests Added |
|---------|-------|-----------------|
| **13** | **Dashboard cards + Portals** | **~30** |
| 14 | CRM components (Thread, Composer, Badge, Timeline) | ~20 |
| 15 | Workflow non-stage components (ModeToggle, StageCard, etc.) | ~40 |
| 16 | Root components batch 1 (CaseJournal, CommitmentTracker, etc.) | ~30 |
| 17 | Root components batch 2 (BenefitCalcPanel, IPR, Scenario) | ~30 |
| 18 | Hook unit tests (useMember, useCRM, useBenefitCalc, etc.) | ~40 |
