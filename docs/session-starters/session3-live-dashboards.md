# Session 3 Starter: Wire Live Dashboards + Member Search UI

## Context

PR #50 (merged) completed Session 2 of the Production Foundations roadmap. The backend now has:
- `GET /api/v1/cases/stats` — case metrics aggregation (by stage, status, priority, assignee)
- `GET /api/v1/cases/stats/sla` — SLA health (on-track/at-risk/overdue, avg processing days)
- `GET /api/v1/cases?stage=X` — stage filter on ListCases
- `GET /api/v1/members/search?q={query}&limit=10` — member search by name or ID
- Migration 012 (member search index)
- 86 casemanagement tests, 44 dataaccess tests, all passing

**Problem:** Both `SupervisorDashboard` and `ExecutiveDashboard` use **hardcoded static arrays** for all metrics. The APIs exist but nothing consumes them yet. There is no member search UI anywhere in the app.

## Session 3 Goal

Replace hardcoded dashboard data with live API calls. Add a member search component to the StaffPortal.

## Deliverables

### 1. Case API Client Extensions
Add to `frontend/src/lib/caseApi.ts`:
- `getCaseStats()` → calls `GET /api/v1/cases/stats`
- `getSLAStats()` → calls `GET /api/v1/cases/stats/sla`
- Update `listCases` params to accept `stage?: string`

TypeScript types needed (add to `frontend/src/types/Case.ts`):
```typescript
export interface CaseStats {
  totalActive: number;
  completedMTD: number;
  atRiskCount: number;
  caseloadByStage: { stage: string; count: number }[];
  casesByStatus: { status: string; count: number }[];
  casesByPriority: { priority: string; count: number }[];
  casesByAssignee: { assigneeId: string; assigneeName: string; caseCount: number; avgDaysOpen: number }[];
}

export interface SLAStats {
  onTrack: number;
  atRisk: number;
  overdue: number;
  avgProcessingDays: number;
  thresholds: { urgentDays: number; highDays: number; standardDays: number };
}
```

### 2. Member Search API Client
Create `frontend/src/lib/memberSearchApi.ts`:
- `searchMembers(query: string, limit?: number)` → calls `GET /api/v1/members/search?q={query}&limit={limit}`
- Uses the dataaccess service URL (VITE_DATA_URL or `/api`)

Type needed:
```typescript
export interface MemberSearchResult {
  memberId: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  statusCode: string;
  tierCode: string;
}
```

### 3. Dashboard Hooks
Create `frontend/src/hooks/useCaseStats.ts`:
- `useCaseStats()` — fetches CaseStats on mount, returns `{ stats, loading, error }`
- `useSLAStats()` — fetches SLAStats on mount, returns `{ sla, loading, error }`

Create `frontend/src/hooks/useMemberSearch.ts`:
- `useMemberSearch()` — debounced search (300ms), returns `{ results, loading, query, setQuery }`

### 4. Wire SupervisorDashboard to Live Data
In `frontend/src/components/staff/SupervisorDashboard.tsx`:
- Replace `CASELOAD_BY_STAGE` constant with `useCaseStats().stats.caseloadByStage`
- Replace `totalCases`, `avgProcessing`, `atRisk`, `completed` with stats values
- Replace `TEAM_MEMBERS` with `stats.casesByAssignee` (map assignee data to team table)
- Replace `APPROVAL_QUEUE` with live `caseAPI.listCases({ stage: 'certification' })` or equivalent
- Show loading skeleton while fetching
- Show error state if API fails (graceful degradation back to empty state, not crash)

### 5. Wire ExecutiveDashboard to Live Data
In `frontend/src/components/staff/ExecutiveDashboard.tsx`:
- Replace hardcoded KPIs with SLA stats (On-Time Rate from onTrack/total, Avg Processing from avgProcessingDays)
- Keep Data Quality KPI as-is (already wired to DQ API)
- Keep system health and volume chart as static for now (no API exists yet)
- Add SLA breakdown card (on-track/at-risk/overdue visual)

### 6. Member Search Component
Create `frontend/src/components/staff/MemberSearchBar.tsx`:
- Search input with debounced query
- Dropdown results list (name, member ID, tier, status)
- Click result → navigate to member dashboard (`/member/{id}`)
- Empty state: "Type to search by name or member ID"
- No results state: "No members found"
- Keyboard navigation (arrow keys + Enter)

Add `MemberSearchBar` to `StaffPortal.tsx` header area.

### 7. Tests (~10-15 new tests)
- `frontend/src/hooks/__tests__/useCaseStats.test.ts` — loading, success, error states
- `frontend/src/hooks/__tests__/useMemberSearch.test.ts` — debounce, results, empty
- `frontend/src/components/staff/__tests__/SupervisorDashboard.test.tsx` — renders with API data
- `frontend/src/components/staff/__tests__/MemberSearchBar.test.tsx` — input, results, selection

## Key Files to Create/Modify

### Create
- `frontend/src/hooks/useCaseStats.ts`
- `frontend/src/hooks/useMemberSearch.ts`
- `frontend/src/lib/memberSearchApi.ts`
- `frontend/src/components/staff/MemberSearchBar.tsx`
- Test files for the above

### Modify
- `frontend/src/lib/caseApi.ts` — add getCaseStats, getSLAStats, stage param
- `frontend/src/types/Case.ts` — add CaseStats, SLAStats types
- `frontend/src/components/staff/SupervisorDashboard.tsx` — wire to live data
- `frontend/src/components/staff/ExecutiveDashboard.tsx` — wire SLA stats
- `frontend/src/components/StaffPortal.tsx` — add MemberSearchBar

## Done When
- SupervisorDashboard renders data from `GET /api/v1/cases/stats` (no more hardcoded arrays)
- ExecutiveDashboard shows SLA stats from `GET /api/v1/cases/stats/sla`
- MemberSearchBar returns results from `GET /api/v1/members/search`
- All existing 327 frontend tests pass
- 10+ new tests for hooks, search bar, and dashboard wiring
- `npx tsc --noEmit` clean
- `npm run build` clean

## Cleanup First

Before starting Session 3, clean up the Session 2 worktree:

```bash
cd C:/Users/jeffb/noui-platform
git worktree remove .claude/worktrees/elegant-jepsen --force
git branch -D claude/elegant-jepsen 2>/dev/null
git push origin --delete claude/elegant-jepsen 2>/dev/null
git checkout main && git pull
```

Then start a fresh worktree for Session 3 work.

## Starter Command
```
Continue noui-platform development. PR #50 (merged to main) completed Session 2 of the Production Foundations roadmap: case stats aggregation, SLA stats, stage filter, member search API. State: 327 frontend tests, 86 casemanagement Go tests, 44 dataaccess Go tests, all builds clean.

Cleanup: worktree elegant-jepsen is from a merged PR and should be removed. Run: git worktree remove .claude/worktrees/elegant-jepsen --force && git branch -D claude/elegant-jepsen 2>/dev/null && git push origin --delete claude/elegant-jepsen 2>/dev/null && git pull

Then start Session 3: Wire Live Dashboards + Member Search UI. See docs/session-starters/session3-live-dashboards.md for full context. Both SupervisorDashboard and ExecutiveDashboard currently use hardcoded static data — wire them to the new case stats APIs. Add a MemberSearchBar component that calls the member search API.
```
