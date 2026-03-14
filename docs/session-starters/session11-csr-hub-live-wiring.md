# Session 11 Starter: CSR Context Hub — Live Member Wiring + Portal Polish

## Context

Session 10 (PR #57, merged) wired the SupervisorDashboard team table and ExecutiveDashboard volume chart to live APIs. Both dashboards now show real data from the casemanagement service with graceful empty states.

**Remaining static data inventory (from Session 10 analysis):**

| Component | Data | Priority | API Exists? |
|-----------|------|----------|-------------|
| `CSRContextHub.tsx` | `MEMBERS` array (3 hardcoded) | **High** | Yes — `/members/search` + `/members/{id}` |
| `EmployerPortal.tsx` | `DEMO_REPORTING_PERIODS` (6 periods) | Medium | No — would need new endpoint |
| `VendorPortal.tsx` | `ENROLLMENT_QUEUE` (4 records) | Medium | No — would need new endpoint |
| `ExecutiveDashboard.tsx` | `STATIC_HEALTH` (4 items) | Low | Partial — keep as config |
| `MemberPortal.tsx` | `DEMO_MEMBER` etc. | Done | Already wired (fallback only) |

## Session 11 Goal

Wire the CSR Context Hub to live member data and clean up remaining test warnings. The CSR Hub is a primary staff workflow — it's where agents look up members during phone calls. The hardcoded 3-member list should be replaced with the existing member search API.

## Deliverables

### 1. Wire CSR Context Hub Member Search (Required)

Replace the `MEMBERS` static array with the live member search API.

**Current state:** `CSRContextHub.tsx` has a hardcoded `MEMBERS` array of 3 members. The component renders a list of member cards with static context data.

**Available APIs:**
- `GET /api/v1/members/search?q={query}&limit=10` — returns `MemberSearchResult[]` with `memberId`, `firstName`, `lastName`, `tier`, `department`, `status`
- `GET /api/v1/members/{id}` — returns full member details
- `useMemberSearch(query)` hook may already exist in `useMemberDashboard.ts` or similar

**Approach:**
- Add a search input at the top of the CSR Hub
- Replace `MEMBERS` array with results from `useMemberSearch(query)`
- Show member cards from search results (default: show recent/all members)
- When a member is selected, fetch full details via `useMember(memberId)`
- Wire context cards (service credit, contributions, beneficiary) to existing hooks
- Keep the existing card layout and styling

### 2. Clean Up act() Warnings in ExecutiveDashboard Tests (Required)

The ExecutiveDashboard tests produce 8 `act()` warnings due to the `useEffect` that fetches DQ score via `dqAPI.getScore()`. This is a pre-existing issue but was exacerbated by the Session 10 changes.

**Fix approach:** Wrap test assertions in `waitFor()` to account for the async DQ score fetch, consistent with the pattern used in `RetirementApplication.test.tsx` (see BUILD_HISTORY Session "Post-Correspondence Follow-Up").

### 3. EmployerPortal Reporting Tab — Wire or Stub (Nice to Have)

If time permits, either:
- **Option A:** Create a simple `GET /api/v1/employer/reporting-periods` endpoint with seed data
- **Option B:** Add a "Coming Soon" overlay to the Reporting tab instead of fake data

Recommendation: Option B — the reporting tab is not part of the core demo flow and a "Coming Soon" indicator is more honest than fake data.

### 4. Docker Rebuild + Verify (Required)

After changes:
```bash
docker compose down -v
docker compose up --build -d
```

Verify:
- CSR Hub shows real member search results
- Member selection loads live detail data
- No regressions in existing dashboard functionality
- Frontend tests pass with zero act() warnings in dashboard tests

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| CSR Hub data source | New endpoint vs. existing search | **Existing** — `/members/search` already returns what we need |
| Default member list | Show all vs. show recent vs. empty | **Show all** (limited to 10) — matches current behavior |
| Context card data | Wire to APIs vs. compute from member | **Wire to APIs** — hooks already exist |
| Employer reporting | New endpoint vs. "Coming Soon" | **"Coming Soon"** — not core demo flow |

## Files to Modify

### Modify
- `frontend/src/components/staff/CSRContextHub.tsx` — replace MEMBERS with search API
- `frontend/src/components/staff/__tests__/ExecutiveDashboard.test.tsx` — fix act() warnings
- `frontend/src/components/portal/EmployerPortal.tsx` — optional "Coming Soon" on reporting tab

### Possibly Create
- `frontend/src/hooks/useCSRHub.ts` — if CSR-specific hooks are needed (may reuse existing)

## Acceptance Criteria

- [ ] CSR Hub renders member list from live search API (12 members from seed data)
- [ ] Member search input filters results in real-time
- [ ] Selected member shows live detail data (contributions, beneficiary, service credit)
- [ ] ExecutiveDashboard tests produce zero act() warnings
- [ ] Docker stack starts cleanly
- [ ] 357+ frontend tests passing, zero regressions
- [ ] TypeScript clean (`npx tsc --noEmit`)
