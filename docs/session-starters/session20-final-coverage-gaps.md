# Session 20 Starter: Final Coverage Gaps — Hooks, Components, Lib Utilities

## Context

Session 19 (PR #TBD, merged) added 78 tests across 12 files — CRM workspace components, pure function utilities, gap-fill components, and stretch hook tests. 748 frontend tests passing across 104 test files.

**Testing strategy (established Session 16):** Mock at the `fetch` boundary, not at the hook level. Component tests render the full component with a QueryClientProvider and intercept `fetch` calls.

**Coverage audit (post Session 19):**

| Category | Total | Tested | Coverage |
|----------|-------|--------|----------|
| Components (all dirs) | 84 | 82 | 97.6% |
| Hooks | 14 | 12 | 85.7% |
| Lib utilities (with logic) | 8 | 8 | 100% |
| Lib API clients | 8 | 0 | 0% |
| Lib config/data | 3 | 0 | 0% |

## Session 20 Goal

Close remaining gaps: 2 untested components, 2 untested hooks, and optionally start API client layer tests. Target: ~780 tests passing.

## Deliverables

### 1. Untested Components (~8 tests)

#### `components/__tests__/ErrorBoundary.test.tsx` (~4 tests)
- Source: `src/components/ErrorBoundary.tsx`
- React error boundary — test with a component that throws
- Tests:
  - Renders children when no error
  - Catches render error and shows fallback UI
  - Error message displayed to user
  - Reset/retry mechanism (if implemented)

#### `components/workflow/__tests__/shared.test.tsx` (~4 tests)
- Source: `src/components/workflow/shared.tsx`
- Shared workflow utilities/components
- Tests: depends on what's exported — read source first

### 2. Untested Hooks (~8 tests)

#### `hooks/__tests__/useCaseStats.test.ts` (~4 tests)
- Source: `src/hooks/useCaseStats.ts`
- Read source to understand what it aggregates
- Likely needs case management API mocking
- Tests: return shape, loading state, computed stats

#### `hooks/__tests__/useCorrespondenceTemplates.test.ts` (~4 tests)
- Source: `src/hooks/useCorrespondenceTemplates.ts`
- Read source to understand template fetching
- Tests: template list, filtering, loading state, error handling

### 3. API Client Layer Tests (~16 tests, stretch)

The lib API clients are thin wrappers around `fetchAPI`/`fetchPaginatedAPI`/`postAPI`. Testing them verifies URL construction and parameter serialization. Pick the 2 most complex:

#### `lib/__tests__/apiClient.test.ts` (~8 tests)
- Source: `src/lib/apiClient.ts`
- Core infrastructure — test the fetch wrapper, enum normalization, retry logic
- Tests:
  - `fetchAPI` extracts `.data` from response
  - `fetchPaginatedAPI` returns `{ items, pagination }`
  - `postAPI` uppercases enum fields in request body
  - Enum normalization: UPPERCASE → lowercase on response
  - Enum normalization: lowercase → UPPERCASE on request
  - Retry logic on 5xx errors
  - Error handling on non-ok responses
  - Request ID header generation

#### `lib/__tests__/crmApi.test.ts` (~8 tests)
- Source: `src/lib/crmApi.ts`
- Verify URL construction and parameter passing for key endpoints
- Tests:
  - `searchContacts` builds correct query string
  - `getContact` hits correct URL
  - `createInteraction` sends POST with body
  - `listConversations` passes pagination params
  - `createNote` sends correct payload
  - `getContactByLegacyId` hits legacy endpoint
  - `listCommitments` with filter params
  - `updateConversation` sends PATCH

### 4. Optional: Config/Data File Tests

Low priority — these are mostly static data:
- `channelMeta.ts` — channel metadata lookups
- `designSystem.ts` — design token exports
- `helpContent.ts` — help article content

Only test if they contain logic (branching, computation). Skip if they're pure data exports.

## Implementation Notes

### ErrorBoundary Testing Pattern

React error boundaries need a child component that throws during render:

```tsx
function ThrowingComponent() {
  throw new Error('Test error');
}

// Suppress console.error during error boundary tests
const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
render(
  <ErrorBoundary>
    <ThrowingComponent />
  </ErrorBoundary>
);
spy.mockRestore();
```

### API Client Testing Pattern

For apiClient.ts, mock `globalThis.fetch` directly and verify:
- The URL passed to fetch
- The headers set (Content-Type, X-Request-ID)
- The body serialization
- The response transformation

```typescript
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: { id: 1 }, meta: { request_id: 'test' } }),
}));

const result = await fetchAPI('/v1/test');
expect(result).toEqual({ id: 1 }); // .data extracted
expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/v1/test'), expect.any(Object));
```

### fetchPaginatedAPI vs fetchAPI Reminder

- `fetchAPI<T>(url)` → calls `request()` → returns `body.data` (type T)
- `fetchPaginatedAPI<T>(url)` → calls `rawRequest()` → returns `{ items: body.data, pagination: body.pagination }`
- `postAPI<T>(url, payload)` → uppercases enums in payload → calls `request()` → returns `body.data`

Mock responses must match the raw JSON shape (before apiClient transforms it).

## Verification

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm test -- --run` — ~780 tests passing
- [ ] Zero regressions in existing 748 tests
- [ ] ErrorBoundary and shared.tsx have tests
- [ ] useCaseStats and useCorrespondenceTemplates have tests

## Estimated Test Distribution

| File | Tests | Running Total |
|------|-------|---------------|
| ErrorBoundary.test.tsx | 4 | 752 |
| shared.test.tsx | 4 | 756 |
| useCaseStats.test.ts | 4 | 760 |
| useCorrespondenceTemplates.test.ts | 4 | 764 |
| apiClient.test.ts | 8 | 772 |
| crmApi.test.ts | 8 | 780 |
| **Total new** | **32** | **780** |
