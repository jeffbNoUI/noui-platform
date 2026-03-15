# Session 19 Starter: CRM Workspace Tests + Coverage Gap-Fill

## Context

Session 18 (PR #TBD, merged) added 39 hook unit tests across 9 files using fetch-level mocking. 670 frontend tests passing across 92 test files.

**Testing strategy (established Session 16):** Mock at the `fetch` boundary, not at the hook level. Component tests render the full component with a QueryClientProvider and intercept `fetch` calls.

**Test coverage audit (post Session 18):**

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
| Root-level components | 24 | 18 | 75% |
| UI components | 1 | 0 | 0% |
| Hooks | 14 | 12 | 86% |
| Lib utilities (with logic) | 8 | 6 | 75% |

## Session 19 Goal

Test the 6 untested CRM workspace components (a natural cluster sharing fetch mock patterns), fill remaining gaps in admin/UI/lib coverage. Target: ~728 tests passing.

## Deliverables

### 1. Pure Function Tests (Warm-Up, No Fetch Mocking)

#### `lib/__tests__/formatters.test.ts` (~8 tests)
Pure functions, no mocking needed. Fast to write.
- `formatCurrency(amount)` — dollars, cents, negative, zero
- `formatPercent(value)` — decimal-to-percent, edge cases
- `formatDate(iso)` / `formatDateShort(iso)` — locale formatting
- `formatServiceYears(years)` — singular/plural
- `tierLabel(tier)` / `statusLabel(status)` / `eligibilityLabel(elig)` — lookup correctness

#### `lib/__tests__/crmSummary.test.ts` (~6 tests)
`composeCrmSummary()` is a substantial pure function with branching logic:
- Sentiment scoring aggregation
- SLA flag detection
- Topic aggregation from interactions
- Overdue commitment detection
- Empty/null input handling

### 2. CRM Workspace Component Cluster (~35 tests)

All 6 untested root components are CRM-related and share fetch mock setup. Implement in this order (increasing complexity):

#### `ContactSearch.test.tsx` (~6 tests)
- Debounced input rendering
- Dropdown results from `useContactSearch`
- Selection callback
- Empty/no-results state
- Loading state

#### `ConversationPanel.test.tsx` (~7 tests)
- Renders conversation list from `useConversations`
- Status badges (open/closed/pending)
- SLA indicator display
- Click-to-select behavior
- Empty state when no conversations

#### `ConversationDetailOverlay.test.tsx` (~5 tests)
- Renders overlay with conversation details
- Shows interaction history
- Close button behavior
- Loading/error states

#### `NoteEditor.test.tsx` (~6 tests)
- Form field rendering (category, outcome, sentiment selectors)
- Text input for narrative
- Submit calls `useCreateNote` mutation
- Validation (required fields)
- Success/error feedback

#### `CrmNoteForm.test.tsx` (~5 tests)
- Similar to NoteEditor but uses `useCreateStructuredNote`
- Renders with conversation context
- Submit triggers sequential API calls (interaction then note)
- Form reset after success

#### `CRMWorkspace.test.tsx` (~6 tests)
- Orchestrating composite — test composition/routing, not child behavior
- Renders contact search + conversation panel
- Selecting a contact loads conversations
- Selecting a conversation shows detail overlay
- Note creation flow triggers from workspace
- Empty/loading states

### 3. Small Gap-Fill (~9 tests)

#### `components/ui/__tests__/CollapsibleSection.test.tsx` (~5 tests)
- Expand/collapse toggle
- Badge/count display
- Animation class application
- Children rendering when expanded
- Default collapsed state

#### `components/admin/__tests__/ServiceMap.test.tsx` (~4 tests)
- Renders service entries
- BUILD/HYBRID/BUY badge filtering
- POC indicator display
- Status indicators

### 4. Optional Stretch: Remaining Hook Gaps (~6 tests)

If time permits after the primary deliverables:

#### `hooks/__tests__/useMemberDashboard.test.ts` (~3 tests)
- Aggregates data from multiple hooks
- Returns dashboard summary shape

#### `hooks/__tests__/useMemberSearch.test.ts` (~3 tests)
- Debounced search query
- Disabled when query is empty/short

## Implementation Notes

### CRM Workspace Fetch Mock Pattern

The CRM cluster shares a common `setupFetch()` that handles:
- `GET /v1/crm/contacts?query=...` — contact search (paginated)
- `GET /v1/crm/contacts/:id` — contact by ID
- `GET /v1/crm/conversations?contactId=...` — conversations (paginated)
- `GET /v1/crm/interactions?conversationId=...` — interactions (paginated)
- `POST /v1/crm/interactions` — create interaction
- `POST /v1/crm/notes` — create note

Consider extracting a shared `setupCrmFetch()` helper if 3+ test files need the same mock setup. Place in `src/test/crmTestHelpers.ts`.

### Enum Normalization Reminder

All CRM types use UPPERCASE enums from the Go backend. `apiClient.ts` normalizes to lowercase. Mock responses MUST return UPPERCASE; assertions check lowercase.

Key CRM enum fields: `contactType`, `status`, `channel`, `direction`, `visibility`, `preferredChannel`, `category`, `sentiment`, `anchorType`.

### Component Test Pattern

```tsx
const { getByText, queryByText } = renderWithProviders(
  <ComponentUnderTest prop1="value" />
);
await waitFor(() => {
  expect(getByText('Expected text')).toBeInTheDocument();
});
```

Use `renderWithProviders` from `src/test/helpers.tsx` (wraps with QueryClientProvider).

## Verification

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm test -- --run` — ~728 tests passing
- [ ] Zero regressions in existing 670 tests
- [ ] All CRM workspace components have at least basic render + interaction tests
- [ ] `formatters.ts` and `crmSummary.ts` have pure function tests

## Estimated Test Distribution

| File | Tests | Running Total |
|------|-------|---------------|
| formatters.test.ts | 8 | 678 |
| crmSummary.test.ts | 6 | 684 |
| ContactSearch.test.tsx | 6 | 690 |
| ConversationPanel.test.tsx | 7 | 697 |
| ConversationDetailOverlay.test.tsx | 5 | 702 |
| NoteEditor.test.tsx | 6 | 708 |
| CrmNoteForm.test.tsx | 5 | 713 |
| CRMWorkspace.test.tsx | 6 | 719 |
| CollapsibleSection.test.tsx | 5 | 724 |
| ServiceMap.test.tsx | 4 | 728 |
| **Total new** | **58** | **728** |
