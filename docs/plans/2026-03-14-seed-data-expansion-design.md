# Seed Data Expansion — Design

**Date:** 2026-03-14
**Session:** 9
**Goal:** Expand demo data from 3 members / 4 cases to 10 members / 16 cases for realistic dashboards.

## Decision: Full Depth

Every new member gets complete history (employment, salary, contributions, service credit, beneficiary) so any member clicked in search renders a fully populated dashboard.

## Decision: Relative Dates

All `created_at` timestamps on cases use `NOW() - INTERVAL` so SLA calculations stay fresh across Docker rebuilds. No absolute dates that go stale.

## New Members (10004–10010)

| ID | Name | Tier | Dept | Status | Hire Date | Notable |
|----|------|------|------|--------|-----------|---------|
| 10004 | Maria Santos | 1 | DFD (Fire) | A | 1998-04-01 | Married, 28yr service |
| 10005 | James Wilson | 2 | DHS (Human Svc) | A | 2006-08-15 | Purchased service (2yr) |
| 10006 | Lisa Park | 3 | DTD (Tech Svc) | A | 2015-01-12 | Early career, 11yr |
| 10007 | Thomas O'Brien | 1 | DPD (Police) | T | 2000-03-01 | Terminated, deferred vested |
| 10008 | Angela Davis | 2 | DAS (Aviation) | A | 2009-07-01 | Near tier boundary |
| 10009 | Richard Chen | 3 | DWW (Water) | A | 2013-06-01 | Married |
| 10010 | Patricia Moore | 1 | DCA (City Atty) | A | 2001-11-01 | Leave-payout eligible |

Tier distribution: 3×T1, 2×T2, 2×T3 (new) + existing 1×T1, 1×T2, 1×T3 = 4×T1, 3×T2, 3×T3.

## New Cases (12 new → 16 total)

**Priority distribution:** 2 urgent, 3 high, 5 standard, 2 low
**Stage distribution:** 2-3 per stage (7 stages)
**Assignees:** Sarah Chen (4), Michael Torres (3), Lisa Park (3), James Wilson (2)
**SLA:** ~7 on-track, 3 at-risk, 2 overdue
**Flags:** mix of early-retirement, purchased-service, leave-payout, dro

## New CRM Interactions (~18)

2-3 per new member, varied channels (phone, email, message, in-person) and directions (inbound, outbound). Some with commitments.

## Files

| File | Description |
|------|-------------|
| `domains/pension/seed/013_expanded_members.sql` | 7 members with full history |
| `domains/pension/seed/014_expanded_cases.sql` | 12 cases with flags + stage history |
| `domains/pension/seed/015_expanded_crm.sql` | CRM interactions for new members |
| `docker-compose.yml` | 3 new volume mounts |

## Acceptance Criteria

- 10+ members returned by member search
- 15+ cases with multi-stage, multi-priority, multi-assignee distribution
- SLA stats show at least 1 at-risk AND 1 overdue case
- SupervisorDashboard charts show varied stage counts
- ExecutiveDashboard SLA bar shows multi-color breakdown
- Docker stack starts cleanly
- 355+ frontend tests passing, zero regressions
