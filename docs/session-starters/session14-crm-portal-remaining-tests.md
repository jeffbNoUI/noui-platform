# Session 14 Starter: CRM Components + Remaining Portal Tests

## Context

Session 13 (PR #63, merged) added 45 tests across 7 files covering all untested dashboard cards and portal components. Removed `DEMO_BENEFICIARY` fallback from MemberPortal. 426 frontend tests passing across 47 test files.

**Test coverage audit (post Session 13):**

| Category | Total | Tested | Coverage |
|----------|-------|--------|----------|
| Dashboard cards | 10 | 10 | 100% |
| Detail panels | 5 | 5 | 100% |
| Staff dashboards | 4 | 4 | 100% |
| Workflow stages | 8 | 7 | 88% |
| Portal components | 10 | 6 | 60% |
| Admin components | 4 | 3 | 75% |
| CRM components | 4 | 0 | **0%** |
| Root-level components | 24 | 4 | 17% |
| Workflow non-stage | 15 | 0 | 0% |
| UI components | 1 | 0 | 0% |
| **Hooks** | **14** | **1** | **7%** |

**Session 13 brought Dashboard, Detail, and Staff to 100%.** The next highest-impact gap is CRM (0% tested, 4 components used across all portals) and the remaining 4 untested portal sub-components.

## Session 14 Goal

Add test coverage for the 4 CRM components and 4 remaining portal sub-components. These are the last customer-facing components without tests. Target: 460+ tests passing.

## Deliverables

### 1. CRM Component Tests (Required)

CRM components are shared across Staff, Member, and Employer portals. They handle conversation rendering, message composition, and notification badges.

#### `ConversationThread.test.tsx` (~5 tests)
- Renders interaction messages in chronological order
- Shows sender name, timestamp, and message body
- Applies theme styling (staff vs employer vs member)
- Handles empty conversation state
- Scrolls to latest message on load

**Source file:** `frontend/src/components/crm/ConversationThread.tsx`
**Props to investigate:** Read the component to understand its props interface before writing tests.

#### `MessageComposer.test.tsx` (~4 tests)
- Renders text input and send button
- Calls `onSend` callback with message text on submit
- Clears input after send
- Disables send button when input is empty
- Applies theme styling

**Source file:** `frontend/src/components/crm/MessageComposer.tsx`

#### `CrmNotificationBadge.test.tsx` (~3 tests)
- Shows unread count when > 0
- Hides badge when count is 0
- Applies urgency styling for high counts

**Source file:** `frontend/src/components/crm/CrmNotificationBadge.tsx`

#### `PortalTimeline.test.tsx` (~3 tests)
- Renders timeline entries with dates and descriptions
- Groups entries by date
- Shows empty state

**Source file:** `frontend/src/components/crm/PortalTimeline.tsx`

**Mock pattern:** Read each component first. If they're presentational (props-only), test like dashboard cards. If they use hooks, mock like EmployerPortal.

### 2. Remaining Portal Sub-Component Tests (Required)

These 4 portal sub-components are currently untested:

#### `AIChatPanel.test.tsx` (~3 tests)
- Renders chat interface with message history
- Shows typing indicator during AI response
- Handles send message callback

**Source file:** `frontend/src/components/portal/AIChatPanel.tsx`

#### `EmployerCorrespondenceTab.test.tsx` (~3 tests)
- Renders correspondence list for employer
- Shows empty state when no correspondence
- Handles letter selection callback

**Source file:** `frontend/src/components/portal/EmployerCorrespondenceTab.tsx`

#### `MemberCorrespondenceTab.test.tsx` (~3 tests)
- Renders correspondence list for member
- Shows letter previews
- Handles download/view actions

**Source file:** `frontend/src/components/portal/MemberCorrespondenceTab.tsx`

#### `RingGauge.test.tsx` (~2 tests)
- Renders SVG ring with correct fill percentage
- Shows label text in center

**Source file:** `frontend/src/components/portal/RingGauge.tsx`

### 3. ScenarioStage Test (Nice to Have)

The only untested workflow stage. Would bring stage coverage to 100%.

#### `ScenarioStage.test.tsx` (~4 tests)
- Renders scenario comparison table
- Shows base vs. alternative scenarios
- Handles scenario selection
- Displays monthly benefit differences

**Source file:** `frontend/src/components/workflow/stages/ScenarioStage.tsx`

### 4. Verify (Required)

After changes:
- `npx tsc --noEmit` — TypeScript clean
- `npm test -- --run` — All tests passing (target: 460+)
- Zero act() warnings
- No regressions in existing tests

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| CRM test approach | Props-only vs. hook mocks | **Read components first** — likely props-only since they're shared UI |
| AIChatPanel depth | Full AI mock vs. static | **Static render** — test UI structure, not AI behavior |
| RingGauge SVG testing | Snapshot vs. attribute checks | **Attribute checks** — verify `stroke-dasharray` or percentage text |
| ScenarioStage priority | Required vs. nice-to-have | **Nice-to-have** — CRM + portal components have higher customer impact |

## Files to Create
- `frontend/src/components/crm/__tests__/ConversationThread.test.tsx`
- `frontend/src/components/crm/__tests__/MessageComposer.test.tsx`
- `frontend/src/components/crm/__tests__/CrmNotificationBadge.test.tsx`
- `frontend/src/components/crm/__tests__/PortalTimeline.test.tsx`
- `frontend/src/components/portal/__tests__/AIChatPanel.test.tsx`
- `frontend/src/components/portal/__tests__/EmployerCorrespondenceTab.test.tsx`
- `frontend/src/components/portal/__tests__/MemberCorrespondenceTab.test.tsx`
- `frontend/src/components/portal/__tests__/RingGauge.test.tsx`
- `frontend/src/components/workflow/stages/__tests__/ScenarioStage.test.tsx` (nice to have)

## Files to Modify
- None expected

## Acceptance Criteria

- [ ] 4 CRM test files with 15+ tests total
- [ ] 4 portal sub-component test files with 11+ tests total
- [ ] 460+ frontend tests passing, zero regressions
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Zero act() warnings in new tests
- [ ] CRM coverage goes from 0% → 100%
- [ ] Portal coverage goes from 60% → 100%

## Test Coverage Roadmap (after Session 14)

| Session | Focus | Est. Tests Added | Cumulative |
|---------|-------|-----------------|------------|
| 13 | Dashboard cards + Portals | 45 | 426 |
| **14** | **CRM + Portal sub-components** | **~30** | **~460** |
| 15 | Workflow non-stage components (ModeToggle, StageCard, views) | ~40 | ~500 |
| 16 | Root components batch 1 (CaseJournal, CommitmentTracker, CRM panels) | ~30 | ~530 |
| 17 | Root components batch 2 (BenefitCalcPanel, IPR, Scenario, DRO) | ~30 | ~560 |
| 18 | Hook unit tests (useMember, useCRM, useBenefitCalc, etc.) | ~40 | ~600 |
