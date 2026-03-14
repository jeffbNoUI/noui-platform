# Session 9 Starter: Seed Data Expansion + Demo Richness

## Context

Session 8 (PR #53, merged) verified end-to-end that all dashboards and member search render live API data. Docker stack rebuilt, zero integration issues. Repository cleaned up (5 worktrees, 11 remote branches removed).

**Problem:** The demo is thin. The database has only **3 members** and **6 cases** — every dashboard metric is a small number, search returns 1 result for any query, and charts look sparse. The SupervisorDashboard "Team Performance" table and ExecutiveDashboard "Processing Volume" + "System Health" still use hardcoded static arrays. The Employer Portal uses entirely demo data.

**Current seed data:**
- 3 members: Robert Martinez (10001, T1), Jennifer Kim (10002, T2), David Washington (10003, T3)
- 6 retirement cases (one per stage), all assigned to Sarah Chen
- 9 CRM interactions, 13 case notes, 9 case documents
- 6 correspondence history records
- 8 DQ issues (4 org-wide + 4 member-specific)
- 8 KB articles

## Session 9 Goal

Expand seed data to create a realistic demo environment. Add enough members, cases, and interactions that dashboards look populated, charts have visible distributions, and search returns multiple results. Optionally wire remaining static arrays to live data.

## Deliverables

### 1. Expand Member Seed Data (Required)

Add 7-10 new members to `domains/pension/seed/002_legacy_seed.sql` (or a new file `013_expanded_seed.sql`) covering:
- Multiple departments (Public Works, Finance, Parks, DIA, Human Services, IT, Water, Police)
- All 3 tiers represented
- Mix of active (A) and terminated (T) statuses
- Varied hire dates spanning the tier cutoff dates (pre-2004, 2004-2011, post-2011)
- At least 1-2 members with purchased service credit
- At least 1-2 married members (for DRO scenarios)

Target: 10-13 total members searchable via `/api/v1/members/search`.

### 2. Expand Case Seed Data (Required)

Add 10-15 new retirement cases to `domains/pension/seed/007_casemanagement_seed.sql` (or new file):
- Distribute across all 7 stages (not just 1 per stage)
- Mix of priorities: 2-3 urgent, 4-5 high, 6-8 standard, 2-3 low
- Multiple assignees (Sarah Chen, Michael Torres, Lisa Park, James Wilson, Amanda Roberts)
- Varied `created_at` dates for realistic SLA distribution:
  - Some on-track (created recently)
  - Some at-risk (nearing SLA threshold)
  - 1-2 overdue (past SLA deadline)
- Add case flags (early-retirement, purchased-service, leave-payout, dro) distributed realistically
- At least 2 cases at certification stage (so Pending Approvals shows content)

Target: 16-20 total cases, SLA breakdown showing on-track/at-risk/overdue distribution.

### 3. Expand CRM Seed Data (Nice to have)

Add interactions for the new members:
- 2-3 interactions per new member
- Mix of channels (phone, email, message, in-person)
- Mix of directions (inbound, outbound)
- Some with commitments (follow-up callbacks, document requests)

### 4. Wire Team Performance to Live Data (Optional)

The `TEAM_MEMBERS` array in `SupervisorDashboard.tsx` is static. The `/cases/stats` endpoint already returns `casesByAssignee` with `assignedTo`, `count`, and `avgDaysOpen`. Consider:
- Mapping `casesByAssignee` data to the team table
- Proficiency level and efficiency could remain static or be computed from case metrics
- This requires the case seed data to have multiple assignees (Deliverable #2)

### 5. Rebuild Docker + Verify (Required)

After seed changes:
```bash
docker compose down -v   # -v to clear volume so seeds re-run
docker compose up --build -d
```

Verify:
- `/api/v1/members/search?q=&limit=20` returns 10+ members
- `/api/v1/cases/stats` shows cases distributed across stages
- `/api/v1/cases/stats/sla` shows at-risk and overdue counts > 0
- SupervisorDashboard charts look populated
- ExecutiveDashboard SLA bar shows color variation (not 100% on-track)

### 6. Tests (Required)

- Existing 355 frontend tests must pass (zero regressions)
- `npx tsc --noEmit` clean
- All Go services start and respond on Docker

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Where to put new seeds | Modify existing seed files vs. new `013_expanded_seed.sql` | **New file** — keeps existing seeds clean, easy to extend |
| Member IDs | Continue from 10004+ | Start at 10004 to avoid conflicts |
| Case IDs | Continue from existing pattern | Use `RET-2026-XXXX` pattern, IDs > current max |
| SLA dates | Absolute dates vs. relative | **Relative** (`NOW() - INTERVAL`) so demos stay fresh |

## Files to Create/Modify

### Create
- `domains/pension/seed/013_expanded_members.sql` — 7-10 new members with salary history
- `domains/pension/seed/014_expanded_cases.sql` — 10-15 new cases with flags, stage history, notes
- `domains/pension/seed/015_expanded_crm.sql` — interactions for new members (optional)

### Modify
- `docker-compose.yml` — add new seed files to init volume mounts
- `BUILD_HISTORY.md` — update with Session 9 results
- Optionally `SupervisorDashboard.tsx` — wire Team Performance to casesByAssignee

## Acceptance Criteria

- [ ] 10+ members returned by member search
- [ ] 15+ cases with multi-stage, multi-priority, multi-assignee distribution
- [ ] SLA stats show at least 1 at-risk AND 1 overdue case
- [ ] SupervisorDashboard caseload chart shows varied stage counts (not all 1s)
- [ ] ExecutiveDashboard SLA bar shows multi-color breakdown
- [ ] Docker stack starts cleanly with expanded seeds
- [ ] 355+ frontend tests passing, zero regressions
