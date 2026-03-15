# Session 15 Starter: Workflow Non-Stage Component Tests

## Context

Session 14 (PR #TBD, merged) added 39 tests across 9 files covering all 4 CRM components, 4 remaining portal sub-components, and ScenarioStage. CRM and portal coverage both reached 100%. Workflow stages also reached 100%. 465 frontend tests passing across 56 test files.

**Test coverage audit (post Session 14):**

| Category | Total | Tested | Coverage |
|----------|-------|--------|----------|
| Dashboard cards | 10 | 10 | 100% |
| Detail panels | 5 | 5 | 100% |
| Staff dashboards | 4 | 4 | 100% |
| Workflow stages | 8 | 8 | 100% |
| Portal components | 9 | 9 | 100% |
| CRM components | 4 | 4 | 100% |
| Admin components | 4 | 3 | 75% |
| Workflow non-stage | 14 | 0 | **0%** |
| Root-level components | 24 | 4 | 17% |
| UI components | 1 | 0 | 0% |
| **Hooks** | **14** | **1** | **7%** |

**Session 14 brought CRM, Portal, and Workflow Stages to 100%.** The next highest-impact gap is workflow non-stage components (0% tested, 14 components that form the workflow navigation/view layer).

## Session 15 Goal

Add test coverage for the workflow non-stage components. These are the view modes, navigation controls, and UI chrome that wrap the workflow stages. Target: 505+ tests passing.

## Deliverables

### 1. Workflow View Components (Required)

These components implement the three workflow viewing modes and their navigation.

#### `ModeToggle.test.tsx` (~3 tests)
- Renders toggle buttons for each mode (Guided, Expert, Orbit)
- Highlights the active mode
- Calls onChange callback when a different mode is clicked

**Source file:** `frontend/src/components/workflow/ModeToggle.tsx`

#### `StageCard.test.tsx` (~4 tests)
- Renders stage name and status indicator
- Shows completed/active/pending visual states
- Calls onClick when clicked
- Shows lock icon or disabled state when appropriate

**Source file:** `frontend/src/components/workflow/StageCard.tsx`

#### `ProgressIndicator.test.tsx` (~3 tests)
- Renders progress bar or step indicators
- Shows correct completion percentage
- Highlights current stage

**Source file:** `frontend/src/components/workflow/ProgressIndicator.tsx`

#### `GuidedView.test.tsx` (~3 tests)
- Renders the guided (step-by-step) workflow layout
- Shows current stage content
- Shows navigation controls (back/next)

**Source file:** `frontend/src/components/workflow/GuidedView.tsx`

#### `ExpertView.test.tsx` (~3 tests)
- Renders the expert (all-stages-visible) layout
- Shows all stage cards
- Allows direct stage selection

**Source file:** `frontend/src/components/workflow/ExpertView.tsx`

#### `DeckView.test.tsx` (~3 tests)
- Renders the deck/card-stack layout
- Shows current card with swipe/navigation affordances
- Handles empty state

**Source file:** `frontend/src/components/workflow/DeckView.tsx`

#### `OrbitView.test.tsx` (~3 tests)
- Renders the orbital navigation layout
- Shows stages in a radial arrangement
- Handles stage selection

**Source file:** `frontend/src/components/workflow/OrbitView.tsx`

### 2. Workflow Support Components (Required)

#### `ContextualHelp.test.tsx` (~3 tests)
- Renders help content for the current stage
- Shows/hides based on toggle
- Displays stage-specific guidance text

**Source file:** `frontend/src/components/workflow/ContextualHelp.tsx`

#### `LiveSummary.test.tsx` (~3 tests)
- Renders running summary of completed stage data
- Updates when stage data changes
- Shows placeholder when no data available

**Source file:** `frontend/src/components/workflow/LiveSummary.tsx`

#### `PreviewStack.test.tsx` (~2 tests)
- Renders preview cards for upcoming stages
- Shows stage titles and brief descriptions

**Source file:** `frontend/src/components/workflow/PreviewStack.tsx`

#### `NavigationModelPicker.test.tsx` (~2 tests)
- Renders navigation model options
- Calls onSelect with chosen model

**Source file:** `frontend/src/components/workflow/NavigationModelPicker.tsx`

#### `ProficiencySelector.test.tsx` (~2 tests)
- Renders proficiency level options
- Highlights current selection
- Calls onChange callback

**Source file:** `frontend/src/components/workflow/ProficiencySelector.tsx`

### 3. Workflow Correspondence Components (If time allows)

#### `CorrespondencePanel.test.tsx` (~3 tests)
- Renders correspondence templates for current stage
- Handles template selection
- Shows empty state

**Source file:** `frontend/src/components/workflow/CorrespondencePanel.tsx`

#### `StageCorrespondencePrompt.test.tsx` (~2 tests)
- Shows prompt to send correspondence after stage advance
- Handles dismiss action

**Source file:** `frontend/src/components/workflow/StageCorrespondencePrompt.tsx`

### 4. Verify (Required)

After changes:
- `npx tsc --noEmit` — TypeScript clean
- `npm test -- --run` — All tests passing (target: 505+)
- Zero act() warnings
- No regressions in existing tests

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| View component depth | Full render vs. shallow | **Read components first** — if they compose stage components, mock those children |
| OrbitView SVG testing | Snapshot vs. structural | **Structural** — check key elements exist, don't snapshot SVG paths |
| Components with hooks | Mock vs. integrate | **Mock hooks** — follow established pattern from dashboard/portal tests |
| Prioritization | All 14 vs. highest-impact subset | **All 14** — they're a cohesive group and most are small presentational components |

## Files to Create
- `frontend/src/components/workflow/__tests__/ModeToggle.test.tsx`
- `frontend/src/components/workflow/__tests__/StageCard.test.tsx`
- `frontend/src/components/workflow/__tests__/ProgressIndicator.test.tsx`
- `frontend/src/components/workflow/__tests__/GuidedView.test.tsx`
- `frontend/src/components/workflow/__tests__/ExpertView.test.tsx`
- `frontend/src/components/workflow/__tests__/DeckView.test.tsx`
- `frontend/src/components/workflow/__tests__/OrbitView.test.tsx`
- `frontend/src/components/workflow/__tests__/ContextualHelp.test.tsx`
- `frontend/src/components/workflow/__tests__/LiveSummary.test.tsx`
- `frontend/src/components/workflow/__tests__/PreviewStack.test.tsx`
- `frontend/src/components/workflow/__tests__/NavigationModelPicker.test.tsx`
- `frontend/src/components/workflow/__tests__/ProficiencySelector.test.tsx`
- `frontend/src/components/workflow/__tests__/CorrespondencePanel.test.tsx` (if time allows)
- `frontend/src/components/workflow/__tests__/StageCorrespondencePrompt.test.tsx` (if time allows)

## Files to Modify
- None expected

## Acceptance Criteria

- [ ] 12+ workflow non-stage test files with 35+ tests total
- [ ] 505+ frontend tests passing, zero regressions
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Zero act() warnings in new tests
- [ ] Workflow non-stage coverage goes from 0% → 85%+ (100% if correspondence components included)

## Test Coverage Roadmap (after Session 15)

| Session | Focus | Est. Tests Added | Cumulative |
|---------|-------|-----------------|------------|
| 13 | Dashboard cards + Portals | 45 | 426 |
| 14 | CRM + Portal sub-components + ScenarioStage | 39 | 465 |
| **15** | **Workflow non-stage components** | **~40** | **~505** |
| 16 | Root components batch 1 (CaseJournal, CommitmentTracker, CRM panels) | ~30 | ~535 |
| 17 | Root components batch 2 (BenefitCalcPanel, IPR, Scenario, DRO) | ~30 | ~565 |
| 18 | Hook unit tests (useMember, useCRM, useBenefitCalc, etc.) | ~40 | ~605 |
