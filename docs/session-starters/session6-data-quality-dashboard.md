# Session 6 Starter: Data Quality Dashboard & Issue Management

## Context

Sessions 4 & 5 completed case notes/documents UI and knowledge base integration. The frontend now has:
- `CaseNotesPanel` + `CaseDocumentsPanel` wired into RetirementApplication (Session 4: `83500c0..26353c4`)
- `KnowledgeBasePanel` + `RuleReferenceCard` in StaffPortal 'kb' tab (Session 5: `bf0ba2b..65e8a52`)
- 367 frontend tests passing, zero regressions

**Key discovery:** Unlike previous sessions, the DQ frontend infrastructure is **largely complete**. Before writing new code, inventory what already exists.

## What Already Exists (DO NOT REBUILD)

### Types — `frontend/src/types/DataQuality.ts`
All 5 types are complete: `DQCheckDefinition`, `DQCheckResult`, `DQIssue`, `DQScore`, `DQScoreTrend`.

### API Client — `frontend/src/lib/dqApi.ts`
7 methods, all wired to `fetchAPI`/`putAPI`:
- `listChecks(params?)` — GET /v1/dq/checks
- `getCheck(checkId)` — GET /v1/dq/checks/{id}
- `listResults(params?)` — GET /v1/dq/results
- `getScore()` — GET /v1/dq/score
- `getScoreTrend(days?)` — GET /v1/dq/score/trend
- `listIssues(params?)` — GET /v1/dq/issues
- `updateIssue(issueId, req)` — PUT /v1/dq/issues/{id}

### Hooks — `frontend/src/hooks/useDataQuality.ts`
6 hooks complete:
- `useDQScore()` — org-wide score (5min staleTime)
- `useDQScoreTrend(days=30)` — trend data points
- `useDQChecks()` — check definitions with latest results
- `useDQIssues(params?)` — issues with severity/status filters
- `useUpdateDQIssue()` — mutation with cache invalidation on `['dq', 'issues']` + `['dq', 'score']`
- `useMemberDQIssues(memberId)` — client-side filter of open issues for a specific member

### Admin Panel — `frontend/src/components/admin/DataQualityPanel.tsx`
Full admin panel (420 lines) already wired into StaffPortal 'dq' tab:
- Score summary (4 KPI cards: overall score, active checks, open issues, critical issues)
- Category scores with progress bars
- Expandable check definitions with latest results
- Open issues list with severity filter, severity summary pills
- Issue actions: Acknowledge, False Positive, Resolve (with note)
- Refresh button

### Other DQ Components
- `frontend/src/components/dashboard/DataQualityCard.tsx` — compact member dashboard card
- `frontend/src/components/detail/DQIssueDetail.tsx` — drill-down overlay for individual issues

## What's Actually Missing

### 1. Score Trend Chart (Primary Gap)
`useDQScoreTrend()` fetches `DQScoreTrend[]` data (date + score) but **nothing renders it**. The DataQualityPanel shows KPI cards and category bars, but no time-series chart.

**Deliverable:** A `DQScoreTrendChart` component using Recharts `LineChart`.

```typescript
// Recharts is already in the project — check existing chart usage patterns:
// - frontend/src/components/staff/ExecutiveDashboard.tsx (bar chart)
// - frontend/src/components/staff/SupervisorDashboard.tsx (bar chart)
```

### 2. Category Breakdown Chart (Enhancement)
The category scores are shown as progress bars in DataQualityPanel. A donut/pie chart or stacked bar chart would make the breakdown more visually scannable.

**Deliverable:** A `DQCategoryChart` component — could be Recharts `PieChart` or `BarChart`.

### 3. Tests for Existing DQ Components
No tests exist for:
- `DataQualityPanel.tsx` — the most complex DQ component (420 lines, issues with actions)
- `DataQualityCard.tsx` — the member dashboard card
- Existing `DQIssueDetail.test.tsx` exists, so follow its patterns

### 4. Check Result History (Optional Enhancement)
`dqAPI.listResults(params?)` exists but no UI consumes it. Could add a "Run History" expandable section to each check definition row.

## Session 6 Goal

Add the missing DQ visualizations (trend chart, category chart) to the DataQualityPanel and write tests for the existing + new DQ components.

## Deliverables (in priority order)

### 1. DQ Score Trend Chart
Create `frontend/src/components/admin/DQScoreTrendChart.tsx`:
- Recharts `LineChart` or `AreaChart` showing score over time
- Props: `data: DQScoreTrend[]`, optional `days` prop for label
- Reference line at 95% (target threshold)
- Tooltip showing date + score
- Responsive via `ResponsiveContainer`

### 2. Wire Trend Chart into DataQualityPanel
Add the chart between the KPI cards and the category scores sections. Use `useDQScoreTrend()` hook.

### 3. DQ Category Chart (Optional)
Create `frontend/src/components/admin/DQCategoryChart.tsx`:
- Recharts `PieChart` or horizontal `BarChart` for category score breakdown
- Wire into DataQualityPanel alongside or replacing the progress bars

### 4. Tests (~10-15 new)
- `DataQualityPanel.test.tsx` — score rendering, check list, issue actions, severity filter, empty states
- `DQScoreTrendChart.test.tsx` — renders chart, handles empty data, shows reference line
- `DataQualityCard.test.tsx` — renders score, handles loading

## Acceptance Criteria

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — clean
- [ ] All existing 367 tests still pass (zero regressions)
- [ ] 10-15 new tests passing
- [ ] Trend chart visible in DQ panel when trend data available
- [ ] Chart renders gracefully with empty data
- [ ] No duplicate code — reuse existing hooks and types

## Files to Touch

**New files (~4-5):**
- `frontend/src/components/admin/DQScoreTrendChart.tsx`
- `frontend/src/components/admin/DQCategoryChart.tsx` (optional)
- `frontend/src/components/admin/__tests__/DataQualityPanel.test.tsx`
- `frontend/src/components/admin/__tests__/DQScoreTrendChart.test.tsx`
- `frontend/src/components/dashboard/__tests__/DataQualityCard.test.tsx`

**Modified files (~1):**
- `frontend/src/components/admin/DataQualityPanel.tsx` — wire in trend chart + category chart

## Pattern Reference

Follow the same patterns established in Sessions 2-5:
- Chart components: reference `ExecutiveDashboard.tsx` for Recharts patterns (ResponsiveContainer, Bar/Line, XAxis/YAxis, Tooltip)
- Tests: `vi.mock` hooks, `renderWithProviders`, mock data matching `DQScoreTrend` / `DQScore` shapes
- Existing DQ test: `DQIssueDetail.test.tsx` for DQ-specific mock patterns
