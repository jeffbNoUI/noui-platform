# Session 7 Starter: Wire Live Dashboards + Member Search UI

## Context

Session 6 (PR #51, merged) completed DQ Dashboard visualizations and Recharts migration. The frontend now has:
- Recharts standardized as the charting library (all hand-rolled SVG charts migrated except RingGauge)
- `DQScoreTrendChart` + `DQCategoryChart` wired into DataQualityPanel
- 334 frontend tests passing, zero regressions
- Design system "Institutional Warmth" palette used consistently across all charts

**Prior backend work (Session 2, PR #50)** built the APIs that this session will consume:
- `GET /api/v1/cases/stats` — case metrics aggregation (by stage, status, priority, assignee) with at-risk count
- `GET /api/v1/cases/stats/sla` — SLA health (on-track/at-risk/overdue, avg processing days)
- `GET /api/v1/cases?stage=X` — stage filter on ListCases
- `GET /api/v1/members/search?q={query}&limit=10` — member search by name or ID
- 86 casemanagement tests, 44 dataaccess tests, all passing

**Problem:** Both `SupervisorDashboard` and `ExecutiveDashboard` use **hardcoded static arrays** for all metrics. The APIs exist but nothing consumes them yet. There is no member search UI anywhere in the app.

## Session 7 Goal

Replace hardcoded dashboard data with live API calls. Add a member search component to the StaffPortal. Use Recharts for any new chart visualizations (already installed and standardized in Session 6).

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
- Existing Recharts bar chart should continue working — just swap the data source
- Show loading skeleton while fetching
- Show error state if API fails (graceful degradation back to empty state, not crash)

### 5. Wire ExecutiveDashboard to Live Data
In `frontend/src/components/staff/ExecutiveDashboard.tsx`:
- Replace hardcoded KPIs with SLA stats (On-Time Rate from onTrack/total, Avg Processing from avgProcessingDays)
- Keep Data Quality KPI as-is (already wired to DQ API via `useDQScore()`)
- Keep system health and volume chart as static for now (no API exists yet)
- Add SLA breakdown card (on-track/at-risk/overdue visual) — use Recharts if charting
- Consider using the design system palette (sage, coral, gold) for SLA status colors

### 6. Member Search Component
Create `frontend/src/components/staff/MemberSearchBar.tsx`:
- Search input with debounced query
- Dropdown results list (name, member ID, tier, status)
- Click result → navigate to member dashboard (`/member/{id}`)
- Empty state: "Type to search by name or member ID"
- No results state: "No members found"
- Keyboard navigation (arrow keys + Enter)
- Follow "Institutional Warmth" design system for styling

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

## Charting Notes

Recharts is now the standard charting library (installed in Session 6). Patterns to follow:
- `DQScoreTrendChart.tsx` — AreaChart with gradient fills, reference lines, custom tooltip
- `DQCategoryChart.tsx` — horizontal BarChart with per-category colors
- `BenefitProjectionChart.tsx` — multi-series AreaChart with gradient fills
- All charts use `ResponsiveContainer` wrapper
- Design system colors: sage (`#5B8A72`), coral (`#D4725C`), gold (`#C4A24E`), sky (`#5B8AB5`)
- Recharts + jsdom: test container presence (`.recharts-responsive-container`), not SVG text content

## Acceptance Criteria

- [ ] SupervisorDashboard renders data from `GET /api/v1/cases/stats` (no more hardcoded arrays)
- [ ] ExecutiveDashboard shows SLA stats from `GET /api/v1/cases/stats/sla`
- [ ] MemberSearchBar returns results from `GET /api/v1/members/search`
- [ ] All existing 334 frontend tests pass (zero regressions)
- [ ] 10+ new tests for hooks, search bar, and dashboard wiring
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` clean
