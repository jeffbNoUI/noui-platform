# Session 18 Starter: Hook Unit Tests

## Context

Session 17 (PR #TBD, merged) added 39 tests across 7 files covering props-based root components (ScenarioModeler, DROImpactPanel, PaymentOptionsComparison, DeathBenefitPanel, ServiceCreditSummary, EmploymentTimeline, MemberBanner). 631 frontend tests passing across 83 test files.

**Testing strategy (established Session 16):** Mock at the `fetch` boundary, not at the hook level. For hook unit tests, this means wrapping hooks in `renderHook()` with a React Query provider and intercepting `fetch` calls with URL-pattern matching.

**Test coverage audit (post Session 17):**

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
| Root-level components | 24 | 17 | 71% |
| UI components | 1 | 0 | 0% |
| **Hooks** | **14** | **1** | **7%** |

## Session 18 Goal

Add test coverage for hooks — the data-fetching layer that connects React Query to the backend APIs. Target: ~670 tests passing.

## Deliverables

### 1. Data-Fetching Hooks (Fetch Mocking Required)

These hooks use React Query (`useQuery`/`useMutation`) and call the API via `apiClient.ts`. Test with `renderHook()` wrapped in a QueryClientProvider, intercepting `globalThis.fetch`.

Use the `renderWithProviders` pattern from `src/test/helpers.tsx` or create a `renderHookWithProviders` wrapper.

#### `useMember.test.ts` (~6 tests)
- `useMember(memberId)` — fetches member by ID, returns Member
- `useMemberSearch(query)` — debounced search, returns array
- `useEmploymentHistory(memberId)` — returns EmploymentEvent[]
- `useServiceCredit(memberId)` — returns ServiceCreditSummary
- `useBeneficiaries(memberId)` — returns Beneficiary[]
- `useContributions(memberId)` — returns ContributionSummary

**Source:** `frontend/src/hooks/useMember.ts`
**API base:** `/api/v1/members/`

#### `useBenefitCalculation.test.ts` (~4 tests)
- `useBenefitCalculation(memberId, retDate)` — returns BenefitCalcResult
- `useEligibility(memberId, retDate)` — returns EligibilityResult
- `useScenario(memberId)` — returns ScenarioResult
- `usePaymentOptions(memberId, retDate)` — returns PaymentOptions

**Source:** `frontend/src/hooks/useBenefitCalculation.ts`
**API base:** `/api/v1/benefit/`

#### `useCRM.test.ts` (~6 tests)
- `useContact(contactId)` — returns CRM Contact
- `useContactByLegacyId(memberId)` — returns Contact by legacy member ID
- `useConversations(contactId)` — returns Conversation[]
- `useInteractions(conversationId)` — returns Interaction[]
- `useCreateInteraction()` — mutation, posts new interaction
- `useContactSearch(query)` — search contacts by name

**Source:** `frontend/src/hooks/useCRM.ts`
**API base:** `/api/v1/crm/`

#### `useCaseManagement.test.ts` (~5 tests)
- `useCases(filters)` — returns paginated cases list
- `useCase(caseId)` — returns single CaseDetail
- `useAdvanceStage(caseId)` — mutation, advances case stage
- `useCaseStats()` — returns CaseStats aggregation
- `useMemberCases(memberId)` — returns cases for a member

**Source:** `frontend/src/hooks/useCaseManagement.ts`, `frontend/src/hooks/useCaseStats.ts`
**API base:** `/api/v1/cases/`

#### `useCorrespondence.test.ts` (~4 tests)
- `useCorrespondenceHistory(memberId)` — returns Correspondence[]
- `useCaseCorrespondence(caseId)` — returns case-scoped correspondence
- `useCorrespondenceTemplates(stage?)` — returns templates, optional stage filter
- `useCorrespondenceSend()` — mutation, sends letter

**Source:** `frontend/src/hooks/useCorrespondence.ts`, `frontend/src/hooks/useCorrespondenceTemplates.ts`
**API base:** `/api/v1/correspondence/`

#### `useDataQuality.test.ts` (~3 tests)
- `useDQScore()` — returns org-wide quality score
- `useMemberDQIssues(memberId)` — returns member-specific issues
- `useAcknowledgeIssue()` — mutation, acknowledges a DQ issue

**Source:** `frontend/src/hooks/useDataQuality.ts`
**API base:** `/api/v1/dataquality/`

### 2. State-Only Hooks (No Fetch Mocking)

#### `useProficiency.test.ts` (~3 tests)
- Returns current proficiency level from localStorage
- `setProficiency()` updates localStorage and state
- Default proficiency is 'standard' when localStorage is empty

**Source:** `frontend/src/hooks/useProficiency.ts`

#### `useSpawnAnimation.test.ts` (~3 tests)
- Returns `{ isAnimating, triggerSpawn }`
- `triggerSpawn()` sets isAnimating true
- isAnimating resets to false after animation duration

**Source:** `frontend/src/hooks/useSpawnAnimation.ts`

#### `useLogCall.test.ts` (~2 tests)
- Thin wrapper around `useCreateInteraction` for phone_inbound
- Calls CRM API with correct channel and direction

**Source:** `frontend/src/hooks/useLogCall.ts`

### 3. Shared Test Helper

Create `frontend/src/test/hookHelpers.ts` if needed:
- `renderHookWithProviders(hook)` — wraps `renderHook` with QueryClientProvider (retry: false, cacheTime: 0)

### 4. Verify (Required)

After all tests are written:
- `npx tsc --noEmit` — TypeScript clean
- `npm test -- --run` — All tests passing (target: ~670)
- Zero act() warnings
- No regressions in existing tests

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Hook test wrapper | renderHook + manual provider vs. shared helper | **Shared helper** — avoids duplicating QueryClient setup in every test file |
| Fetch mock pattern | vi.fn() on global.fetch vs. msw | **global.fetch vi.fn()** — consistent with Session 16 `setupFetch()` pattern, no new dependency |
| Mutation testing | Fire mutation + check fetch args vs. check result | **Both** — verify fetch was called with correct URL/body AND that result is returned |
| Debounced hooks | Test with real timers vs. fake timers | **Fake timers** (`vi.useFakeTimers`) for useMemberSearch debounce |

## Files to Create
- `frontend/src/hooks/__tests__/useMember.test.ts`
- `frontend/src/hooks/__tests__/useBenefitCalculation.test.ts`
- `frontend/src/hooks/__tests__/useCRM.test.ts`
- `frontend/src/hooks/__tests__/useCaseManagement.test.ts`
- `frontend/src/hooks/__tests__/useCorrespondence.test.ts`
- `frontend/src/hooks/__tests__/useDataQuality.test.ts`
- `frontend/src/hooks/__tests__/useProficiency.test.ts`
- `frontend/src/hooks/__tests__/useSpawnAnimation.test.ts`
- `frontend/src/hooks/__tests__/useLogCall.test.ts`

## Files to Modify
- None expected (possibly `frontend/src/test/helpers.tsx` to add hook helper)

## Acceptance Criteria

- [ ] 9 new test files with ~36 tests total
- [ ] ~670 frontend tests passing, zero regressions
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Zero act() warnings in new tests
- [ ] All hooks tested with real React Query + fetch mocking (no hook mocking)

## Test Coverage Roadmap (after Session 18)

| Session | Focus | Est. Tests Added | Cumulative |
|---------|-------|-----------------|------------|
| 16 | Root components batch 1 (Case, CRM, Benefit) | 45 | 592 |
| 17 | Root components batch 2 (Scenario, DRO, Payment, Member) | 39 | 631 |
| **18** | **Hook unit tests (useMember, useCRM, useBenefitCalc, etc.)** | **~36** | **~670** |
| 19 | Remaining root components (CRMWorkspace, ContactSearch, ConversationPanel, etc.) | ~35 | ~705 |
| 20 | ErrorBoundary + CollapsibleSection + ServiceMap + coverage gaps | ~20 | ~725 |
