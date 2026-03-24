# Release Governance — NoUI Platform

**Date:** 2026-03-22
**Type:** Process Document
**Status:** Defining release process for client tenant deployments
**Applies to:** All NoUI platform services deployed to client environments

---

## 1. Release Types

### 1.1 Quarterly Release (Major)

**Cadence:** Spring (April) and Fall (October) — two per year minimum.

**Content:** New features, significant enhancements, schema migrations,
dependency upgrades, new service additions.

**Timeline:**

| Milestone | Lead Time | Action |
|-----------|-----------|--------|
| T-6 weeks | Feature freeze | No new features accepted for this release |
| T-4 weeks | Release notes draft | Client receives feature preview and migration impact |
| T-3 weeks | Staging deployment | Release deployed to client staging environment |
| T-2 weeks | UAT window opens | Client technical contact + NoUI engineer verify |
| T-1 week | UAT sign-off deadline | Go/no-go decision with client |
| T-0 | Production deployment | Coordinated deployment with client notification |
| T+3 days | Rollback window closes | After this, forward-fix only |

**Approval:** Client technical contact + NoUI release manager.

**Gate requirements:**
- All Tier 1 tests pass (Go `-short` + frontend unit)
- Docker E2E suite: full pass (currently 166/166 across 5 suites)
- No unresolved CRITICAL or HIGH security findings
- Schema migration tested against staging-scale data
- Performance baseline: response times within 10% of prior release

### 1.2 Monthly Patch

**Cadence:** Second Tuesday of each month.

**Content:** Bug fixes, non-breaking improvements, dependency security patches,
performance optimizations. No schema migrations. No new API endpoints.

**Timeline:**

| Milestone | Lead Time | Action |
|-----------|-----------|--------|
| T-1 week | Patch notes | Client receives list of fixes |
| T-0 | Deployment | Rolling update, zero downtime |
| T+1 day | Verification | NoUI engineer confirms all services healthy |

**Approval:** NoUI release manager.

**Gate requirements:**
- All existing tests pass (no regressions)
- No schema changes
- No breaking API changes (additive only)

### 1.3 Emergency Patch

**Triggers** (any one is sufficient):
- Security vulnerability with CVSS >= 7.0
- Data integrity risk (incorrect benefit calculation, data corruption)
- Service outage affecting member-facing or employer-facing operations
- Regulatory compliance violation discovered in production

**Timeline:**

| Milestone | Lead Time | Action |
|-----------|-----------|--------|
| T-0 | Immediate | Incident notification to client with severity and scope |
| T+0 to T+4h | Deployment | Patch deployed after minimal targeted testing |
| T+4h | Rollback window | Revert if patch introduces regressions |
| T+48h | RCA delivery | Root cause analysis document delivered to client |

**Approval:** NoUI CTO or designated delegate. Client notification required but
client approval is NOT a gate for emergency patches — safety takes priority.

**Post-incident:** Emergency patch triggers a prevention rule addition to
`docs/SECURITY_FINDINGS.md` following the What/Why/Impact/Fix/Prevention pattern.

---

## 2. Version Numbering

**Scheme:** `YYYY.Q.patch`

| Component | Meaning | Example |
|-----------|---------|---------|
| YYYY | Calendar year | 2026 |
| Q | Quarter (1-4) | 2 (Spring release) |
| patch | Patch number within quarter (0 = initial release) | 3 |

**Examples:**
- `2026.2.0` — 2026 Q2 quarterly release (Spring)
- `2026.2.3` — Third monthly patch after the Q2 release
- `2026.4.0` — 2026 Q4 quarterly release (Fall)

**Schema version:** Tracked separately as migration number (e.g., `035`).
Schema version is included in release notes but does not follow the
`YYYY.Q.patch` scheme because schema changes do not always align with
service releases.

**Git tags:** `v2026.2.0`, `v2026.2.3`, etc. Applied to the release commit
on the `main` branch.

---

## 3. Promotion Pipeline

### 3.1 Environments

```
Development (dev)
  │
  ├── Developer workstations + Docker Compose
  ├── Full E2E test suite runs here
  └── Feature branches merged to main via PR
        │
        ▼
Staging (staging)
  │
  ├── Client-specific tenant configuration
  ├── Production-scale data (anonymized)
  ├── Client UAT access
  └── Soak period: 2 weeks (quarterly) / 3 days (monthly)
        │
        ▼
Production (prod)
  │
  ├── Client tenant with real data
  ├── Monitored via healthagg (8091)
  └── Rollback window: 72 hours (quarterly) / 24 hours (monthly)
```

### 3.2 Promotion Gates

#### Dev to Staging

| Gate | Requirement | Verification |
|------|-------------|-------------|
| Build | All 21 services compile without errors | `go build ./...` per service |
| Unit tests | All Tier 1 tests pass | `go test ./... -short` per service |
| Frontend | TypeScript compiles, all tests pass | `npx tsc --noEmit && npm test -- --run` |
| E2E | Full Docker E2E suite passes | `tests/e2e/*.sh` — all suites |
| Security | No unresolved CRITICAL findings | `docs/SECURITY_FINDINGS.md` review |
| Layer boundaries | No cross-layer imports | PostToolUse hooks verify automatically |

#### Staging to Production

| Gate | Requirement | Verification |
|------|-------------|-------------|
| Soak period | 2 weeks without regression (quarterly) / 3 days (monthly) | Healthagg monitoring |
| Client UAT | Client technical contact sign-off (quarterly releases) | Written approval |
| Performance | Response times within 10% of production baseline | Load test results |
| Rollback test | Rollback procedure exercised successfully in staging | Documented result |
| Migration | Schema migration tested, reversible | UP + DOWN scripts verified |

---

## 4. Plane-Specific Update Procedures

NoUI operates on a three-plane architecture. Each plane has different
update characteristics and risk profiles.

### 4.1 Plane 1: Shared AI Layer (NoUI Cloud)

**Scope:** Federated model aggregator, cross-tenant pattern library.
No client data in this plane.

**Update characteristics:**
- Updated independently from tenant services
- Zero-downtime deployment (rolling pods)
- AI service degradation triggers Level 1 fallback (Tier 1+2 composition only)
- No client notification required for AI-only updates
- No client data affected — AI layer has no access to tenant databases

**Rollback:** Instant — revert to previous model version. No data migration involved.

### 4.2 Plane 2: Tenant Services (Per Client)

**Scope:** All 21 platform services + PostgreSQL database per tenant.

**Update characteristics:**
- All services deployed as a coordinated unit per tenant
- Schema migrations run before service deployment (idempotent, ordered)
- Healthagg (8091) validates all services healthy before traffic routing
- Client notification required for all Plane 2 updates
- Rollback requires both service revert AND schema DOWN migration

**Deployment order:**
1. Database backup (point-in-time recovery enabled)
2. Schema migrations (UP scripts, numbered, idempotent)
3. Service deployment (rolling update, one service at a time)
4. Health verification (healthagg fan-out to all services)
5. Traffic routing (switch when all services report healthy)

**Rollback order:**
1. Traffic routing (switch back to previous version)
2. Service rollback (Helm rollback)
3. Schema rollback (DOWN scripts, reverse order)
4. Health verification

### 4.3 Plane 3: Client Systems (Connector)

**Scope:** Legacy database connection, CDC tap, schema discovery.

**Update characteristics:**
- Connector config changes require client coordination
- Schema mapping changes tested against client's legacy DB replica
- Separate change window from Plane 2 platform updates
- Legacy system availability constraints (maintenance windows)

**Risk mitigation:**
- Connector is read-only against legacy DB (no writes)
- Schema discovery is non-destructive (SELECT-only)
- CDC tap uses read replica where available

---

## 5. Rollback Procedures

### 5.1 Service-Only Rollback

**When:** Service code change causes errors; no schema changes involved.

**Procedure:**
1. Helm rollback to previous release tag
2. Healthagg verification — all services healthy
3. Time: < 1 hour

**Automated trigger:** If healthagg reports > 5% failure rate within 15 minutes
of deployment, automated rollback initiates.

### 5.2 Schema + Service Rollback

**When:** Schema migration causes data access errors or performance degradation.

**Procedure:**
1. Halt traffic (maintenance mode)
2. Service rollback (Helm)
3. Schema DOWN migrations (reverse order)
4. Health verification
5. Resume traffic
6. Time: < 4 hours

**Window:** Within 72 hours of quarterly deployment. After 72 hours,
forward-fix only (new migration to correct the issue).

### 5.3 Data Recovery

**When:** Data corruption or incorrect batch processing discovered.

**Procedure:**
1. Identify scope (which records, which time window)
2. Point-in-time recovery from PostgreSQL WAL (backup taken pre-deployment)
3. Selective restore (affected tables only where possible)
4. Reconciliation against audit trail (transaction_log)
5. Time: variable, depends on scope

**Prevention:** Pre-deployment backup is mandatory for every quarterly release.
Monthly patches do not include schema changes, so data recovery is simpler.

---

## 6. Client Notification Templates

### 6.1 Quarterly Release Notification (T-4 Weeks)

```
Subject: NoUI Platform Release [YYYY.Q.0] — Feature Preview

Release: [YYYY.Q.0]
Deployment Target: [date]
UAT Window: [start] — [end]

New Features:
- [feature 1]
- [feature 2]

Schema Changes:
- [migration NNN: description]

Impact Assessment:
- [affected workflows, if any]

Action Required:
- Review release notes
- Designate UAT tester(s)
- Confirm UAT window availability
```

### 6.2 Emergency Patch Notification (Immediate)

```
Subject: [URGENT] NoUI Security Patch — [severity]

Issue: [brief description]
Severity: [CRITICAL / HIGH]
Affected Services: [list]
Member Impact: [yes/no + scope]

Action Taken: Patch deployed [timestamp]
Rollback Window: [4 hours from deployment]

Root Cause Analysis: Will be delivered within 48 hours.
```

---

## 7. Migration Gate Independence

The migration wave gates (G-01 through G-06) operate on their own cadence,
independent of the platform release train. Migration gates are metric-gated
(not time-gated) and progress based on data quality and reconciliation thresholds.

| Gate | Trigger | Independence |
|------|---------|-------------|
| G-01 through G-06 | Metric thresholds met | Not tied to quarterly release |
| Platform release | Calendar cadence | Does not affect gate progression |
| Emergency patch | Security/integrity event | Does not reset gate state |

A platform release may include migration service improvements, but deploying
those improvements does not require re-running gates that have already passed.

---

## 8. Compliance Requirements

### 8.1 Audit Trail

Every deployment is an auditable event:
- Who initiated the deployment
- What version was deployed (git tag + schema version)
- When the deployment occurred (UTC timestamp)
- Which tenant(s) were affected
- Whether the deployment succeeded or was rolled back

Deployment records retained for 7 years (AUDIT_RETENTION_YEARS constant).

### 8.2 SOC 2 Type I Evidence

Each deployment generates evidence for SOC 2 audit:
- Change request record (PR or release ticket)
- Approval chain (who approved, when)
- Test results (E2E suite output)
- Deployment log (success/failure, timing)
- Rollback test results (for quarterly releases)

### 8.3 Colorado Compliance

- **Colorado Data Breach Notification Law:** If a deployment introduces a
  vulnerability that leads to a breach, 30-day notification window applies.
  Emergency patches for security issues take priority over release cadence.
- **Colorado Privacy Act:** Data Protection Assessments required before any
  deployment that changes how PII is processed, stored, or transmitted.

---

*NoUI Platform — Release Governance v1.0 — 2026-03-22 — Confidential*
