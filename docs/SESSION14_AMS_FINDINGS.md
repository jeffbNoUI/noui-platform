# Session 14 Findings — AMS Competitive Analysis Reference

**Date:** 2026-03-22
**Type:** Reference Document — NOT an engineering backlog
**Research:** Application Management Services across five pension/enterprise platforms
**Decision:** No action items created. Deferred items have trigger conditions.

---

## 1. Research Context

### 1.1 What Was Analyzed

Five platforms compared against NoUI's architecture and capabilities:

| Platform | Type | Key Strength |
|----------|------|-------------|
| **Sagitec Xelence / Neospin** | Vertical pension | Foundation services model, rule impact simulation |
| **Vitech V3locity** | Vertical pension | Business events framework, SaaS delivery, 77% TCO claim |
| **TELUS Health Ariel** | Vertical pension/benefits | 5,000+ configurable parameters, 30-year longevity |
| **Mendix** | Horizontal low-code | Governance Value Framework, CoE model, AI guardrails |
| **OutSystems** | Horizontal low-code | Unified ops console, automatic instrumentation, impact analysis |

### 1.2 Why This Analysis Was Done

Competitive positioning exercise to:
- Identify genuine capability gaps that would block a live client engagement
- Distinguish real gaps from marketing-driven feature claims
- Understand where NoUI's architecture is genuinely superior
- Document deferred items with trigger conditions for future planning

### 1.3 Methodology

Feature-by-feature comparison across six AMS domains: Portfolio Governance,
Environment Pipeline, Runtime Monitoring, Security & Access Control,
Change Management, and Feedback Loops. Each gap assessed against the
actual NoUI codebase (18 services, 166 E2E tests, 43 RLS policies).

---

## 2. Gap Register — With NoUI Reality Assessment

The original analysis identified 13 gaps. This register adds the engineering
assessment of each gap against what's actually built.

### Status Legend

- **Built** — capability exists in the codebase today
- **Partial** — foundation exists, enhancement needed
- **Genuine Gap** — not yet addressed, needed before stated phase
- **Wrongly Timed** — real need, but building it now would be premature
- **Process** — requires a document or decision, not software

---

### Infrastructure Gaps (F-A Series)

| # | Gap | Original Severity | NoUI Assessment | Status |
|---|-----|:-:|---|---|
| G1 | **Batch Execution Engine** | Critical | No async job processing infrastructure. Migration batches run inline. Security service has `gocron` for session cleanup only. | **Genuine Gap — Phase 4** |
| G2 | **Communications Dispatch Service** | Critical | Correspondence service (8085) exists with templates, merge fields, letter generation, status tracking, and send effects. Missing: multi-channel dispatch (email/SMS) and async delivery. | **Partial** |
| G3 | **Document Services Layer** | Critical | Dataaccess service (8081) has document CRUD + ECM provider integration. Case management has document attachment. Missing: retention policy enforcement, member-level document repository. | **Partial** |
| G4 | **Event-Driven Notification Bus** | High | WebSocket exists in migration service only. No cross-service event propagation. No pub/sub infrastructure. | **Genuine Gap — Phase 4** |

**Assessment:** G1 and G4 are the same underlying gap — NoUI lacks asynchronous
infrastructure (job queue + event propagation + scheduler). Fixing this one
infrastructure gap unlocks batch processing, async notifications, communications
dispatch, and scheduled jobs. G2 and G3 are enhancements of existing services,
not missing services.

**Trigger condition for G1/G4:** When Phase 4 (Migration) batch processing
requires background job execution. The migration batch engine is the first
real consumer — build the async infrastructure there, prove the pattern,
then extend to other services.

### Architectural Gaps (F-B Series)

| # | Gap | Original Severity | NoUI Assessment | Status |
|---|-----|:-:|---|---|
| G5 | **Integration Broker / API Gateway** | Critical | Employer services handle inbound file processing and validation. No external system integrations exist yet to broker. | **Wrongly Timed — Phase 3** |
| G6 | **Plan Configuration Layer (PCL)** | High | Intelligence service loads plan config from YAML (`/data/plan-config.yaml`) with built-in defaults. Evolution to DB-backed, effective-dated parameters is the right direction. | **Partial — Phase 2 enhancement** |
| G7 | **Data Lineage Tracking** | High | Migration service has lineage table (`migration_lineage`): source field, transformation, result, analyst decision. Missing: extension to operational calculations. | **Partial — extend when rules engine ships** |

**Assessment:** G5 is speculative — building an integration broker with no
external systems to integrate produces untestable infrastructure. G6 is an
incremental evolution of what exists (YAML to DB). G7's foundation exists
in migration; extend the same pattern when operational calculations go live.

**Trigger condition for G5:** When the first external integration is needed
(employer payroll system, actuarial data exchange, treasury disbursement).
Design the broker interface from a real integration, not from theory.

### Governance Gaps (F-C Series)

| # | Gap | Original Severity | NoUI Assessment | Status |
|---|-----|:-:|---|---|
| G8 | **Rule Impact Simulator (RIS)** | Critical | Rules engine doesn't exist yet (designed, not built). Building RIS before the engine is premature. When built, RIS should be a mode of the intelligence service, not a separate system. | **Wrongly Timed — rules engine sprint** |
| G9 | **Platform Release Management** | High | Release process document needed. No software to build. | **Process — addressed by `docs/RELEASE_GOVERNANCE.md`** |
| G10 | **RBAC Framework** | High | JWT auth with RLS on 47 policies. Auth middleware on all endpoints. What was missing: formalized role matrix. | **Partial — addressed by `docs/RBAC_MATRIX.md`** |
| G11 | **SLA & Health Monitoring Dashboard** | High | Healthagg service (8091) does concurrent fan-out health checks. Missing: SLA metrics, trending, breach alerting. | **Partial — enhance healthagg** |

**Assessment:** G8 is the most important to get right — and the most important
to defer. The intelligence service runs deterministic calculations with full
traces. Impact simulation = run the calculation twice with different parameters
and diff the results. Building a standalone RIS that guesses at the rules engine
interface would be rewritten when the engine ships.

G9 and G10 are addressed by documents written in this session. G11 is an
enhancement of the existing healthagg service, not a new build.

### Portal Gaps (F-D Series)

| # | Gap | Original Severity | NoUI Assessment | Status |
|---|-----|:-:|---|---|
| G12 | **Member Self-Service Portal (Scope)** | High | Frontend has MemberPortal with card-based dashboard (PR #100). Gap is defining which self-service actions to enable — product decision, not engineering. | **Process — product scope decision** |
| G13 | **Employer Contribution Portal** | High | **Six employer services built and passing 49/49 E2E tests:** employer-portal (8094), employer-reporting (8095), employer-enrollment (8096), employer-terminations (8097), employer-waret (8098), employer-scp (8099). | **Built** |

**Assessment:** G13 was incorrectly identified as "MISSING" in the original
analysis. The employer portal is one of the most thoroughly tested subsystems
in the platform with 49 E2E tests covering file upload, enrollment lifecycle,
termination certifications, refund calculations, WARET tracking, and service
credit purchase.

---

## 3. Architectural Decision: AFS Model NOT Adopted

### Decision

The Application Foundation Services (AFS) model — six standalone "engines"
modeled after Sagitec Xelence — is **not adopted** for NoUI.

### Rationale

NoUI's architecture already distributes these capabilities across 18 focused
microservices with shared middleware. The AFS model would require consolidating
services that are intentionally separated for:

1. **Independent deployment** — each service deploys without affecting others
2. **Independent scaling** — correspondence doesn't scale the same as intelligence
3. **Clear ownership boundaries** — each service owns its domain completely
4. **Layer isolation** — connector (Layer 1) has zero dependencies on platform (Layer 2)
5. **Testability** — each service has its own test suite, independently verifiable

The AFS "engine" pattern bundles disparate concerns (batch execution +
communications + integration + event bus) into a shared dependency that
every service would import. This creates exactly the coupling that caused
the original repository split and that the layer boundary rules prevent.

### What NoUI Does Instead

Instead of standalone engines, NoUI uses:
- **Shared middleware** (auth, dbcontext, apiresponse, CORS, logging) — imported by all services, thin and stable
- **Service-owned domain logic** — each service handles its own batch, communication, and event needs
- **Infrastructure primitives** (when added) — Redis queue, PostgreSQL LISTEN/NOTIFY — available to any service, owned by none

This is the microservices equivalent of AFS — same capabilities, better
isolation, no god-service risk.

---

## 4. NoUI Competitive Advantages

Six areas where NoUI's architecture is genuinely superior to the platforms reviewed.
These are differentiation points for enterprise sales.

### 4.1 Calculation Transparency

**Competitor approach:** Black-box rules engines (Xelence XML metadata,
V3locity configuration, Ariel parameters). Calculations produce results;
the calculation path is internal.

**NoUI advantage:** Deterministic Go code with full calculation trace.
Every benefit amount is traceable: certified rule definition (YAML) →
deterministic rules engine → auditable output with step-by-step breakdown.

**Why it matters:** Pension fund auditors and actuaries need to verify
calculation correctness. A plan administrator asking "how did you arrive
at this benefit amount?" gets a complete, human-readable trace — not a
reference to a rule ID in a configuration database.

**Code reference:** `platform/intelligence/` — all calculations in Go with
`big.Rat` precision, verified against demo-case expected values to the penny.

### 4.2 AI Boundary Enforcement

**Competitor approach:** AI mixed into business logic. Mendix Maia recommends
logic patterns. V3locity uses AI/ML for "just-in-time decision making."
Boundary between AI suggestion and deterministic execution is unclear.

**NoUI advantage:** Architectural (not policy) separation. The deterministic path
for any calculation: `Certified Rule Definition → Deterministic Rules Engine →
Auditable Output`. No AI model is in this path. AI composes the workspace
(what you see); the rules engine produces the numbers (what you get).

**Why it matters:** Fiduciary liability. If an AI model produces an incorrect
benefit calculation, the fund has a fiduciary exposure with no clear
accountability chain. NoUI's architecture makes this structurally impossible.

**Code reference:** `docs/architecture/ARCHITECTURE_REFERENCE.md` — AI role
boundaries table, Tier 3 composition triggers with fallback.

### 4.3 Migration Tooling as Product

**Competitor approach:** Data migration is a consulting engagement. Sagitec's
MPERA migration took 2+ years. Migration is a project cost, not a product feature.

**NoUI advantage:** Purpose-built migration engine with:
- Schema discovery + concept tagging (connector/ — 18 concepts, signal-based)
- AI-assisted field mapping with confidence scoring
- Reconciliation scoring with metric-gated progression (G-01 through G-06)
- Exception clustering with analyst decision tracking
- WebSocket real-time progress monitoring
- Coverage reporting + pattern detection (shipped Session 13)

**Why it matters:** Migration cost and risk are the primary barriers to pension
system modernization. Making migration a product feature — repeatable, measurable,
metric-gated — changes the economics of the entire engagement.

**Code reference:** `platform/migration/` (Go, port 8100) +
`platform/migration-intelligence/` (Python, port 8101). 23 migration E2E tests.

### 4.4 Graceful Degradation (Six Levels)

**Competitor approach:** Single-tier availability — system works or doesn't.
SaaS platforms (V3locity, OutSystems) rely on cloud provider SLAs.

**NoUI advantage:** Six defined degradation levels:

| Level | State | Impact |
|-------|-------|--------|
| L0 | Normal | Full AI-composed workspaces |
| L1 | AI Degraded | Tier 1+2 composition only — all calculations correct |
| L2 | Workspace Degraded | Static fallback workspaces — all data accessible |
| L3 | Intelligence Degraded | Rules/orchestrator partially failing |
| L4 | Data Degraded | Serve from replica with staleness banner |
| L5 | Complete Outage | Fallback to legacy system, case state persisted |

**Why it matters:** Pension administration is essential infrastructure — members
depend on it for retirement income. The L1 guarantee (AI failure doesn't affect
calculations) is a unique architectural property that no competitor documents.

### 4.5 Audit Architecture (Zero-Config)

**Competitor approach:** Bolt-on audit logging. Developers must remember to
call logging functions. Audit coverage depends on implementation discipline.

**NoUI advantage:**
- RLS on every content table (47 policies) — access control is structural
- Immutable transaction log with 7-year retention
- JWT-based identity on every query via dbcontext middleware
- X-Tenant-ID header stripping — tenant identity cannot be spoofed
- FORCE ROW LEVEL SECURITY — even table owners are subject to RLS

**Why it matters:** Regulatory examination of pension funds includes data
access audits. NoUI's approach means audit coverage is 100% by construction,
not by developer diligence.

### 4.6 Multi-Tenant Isolation (Defense in Depth)

**Competitor approach:** Application-level tenant filtering. Shared database
with WHERE clauses. Tenant ID from request headers or session state.

**NoUI advantage:** Four-layer isolation:
1. Database-level RLS policies (47 policies, PostgreSQL enforcement)
2. Per-request session variable injection (dbcontext middleware)
3. JWT claim extraction (tenant_id from signed token, not headers)
4. Header stripping (X-Tenant-ID removed by auth middleware)

**Why it matters:** A single application-level filtering bug exposes all
tenants' data. NoUI's approach requires failures at multiple independent
layers for a cross-tenant data leak.

---

## 5. Deferred Items with Trigger Conditions

Items from the gap analysis that are real needs but should not be built now.
Each has a specific trigger condition — the event that should prompt action.

| Item | Current Phase | Trigger Condition | What to Build |
|------|:---:|---|---|
| **Async infrastructure** (Redis + event bus + scheduler) | Phase 3 | Phase 4 migration batch processing requires background jobs | Redis queue + Go worker pool in migration service first, then extract to shared infrastructure |
| **Multi-channel correspondence** | Phase 3 | First client needs email/SMS notifications to members | Add dispatch channels to existing correspondence service (8085) |
| **Integration broker** | Phase 3 | First external system integration (employer payroll, actuarial, treasury) | Design API gateway from real integration contract, not theory |
| **Rule Impact Simulator** | Phase 3 | Rules engine is built and has a stable interface | Add simulation mode to intelligence service — same engine, candidate vs. current params |
| **Plan Configuration Layer** (DB-backed) | Phase 3 | Second client with different plan parameters than first client | Evolve intelligence service's YAML config to PostgreSQL with effective dates |
| **Data lineage extension** | Phase 3 | Operational calculations go live (rules engine producing benefit amounts) | Extend migration lineage pattern to calculation results |
| **SLA metrics + trending** | Phase 3 | First client in production for 30+ days | Enhance healthagg service with response time collection, SLA threshold alerting |
| **Field-level access control** (ABAC) | Phase 2+ | Client policy defines restricted-field access patterns (SSN, medical, bank) | Add field masking middleware per `docs/RBAC_MATRIX.md` Phase 3 roadmap |
| **Member self-service scope** | Phase 2 | Product requirements defined for member portal actions | Implement defined actions in existing MemberPortal frontend |

**Principle:** Build infrastructure when you have a real consumer that can
test it. Speculative infrastructure produces untestable code.

---

## 6. Competitive Intelligence Notes

For reference in commercial positioning and client presentations.

### 6.1 Sagitec

- Neospin live at Montana MPERA (2016): 8 retirement systems, 25K retirees, 42K active
- Neospin live at North Dakota TFFR (Feb 2025): 25K+ members, Azure Cloud
- MainePERS project in progress (awarded 2024-2025)
- Foundation services model: Rules, BPM, Communications, File Processing, Reporting, Job Scheduling
- Rule Population Impact Analysis is a first-class capability
- Neo# language for rule migration from C#

### 6.2 Vitech V3locity

- Modular: CoreAdmin + Digital + CampaignCenter + Analytics
- Business Events framework: event trigger → automated action (low/no-code)
- Intelligent workflow routing (skill + availability + workload)
- AWS-hosted SaaS, continuous updates
- Claims 77% lower TCO vs. on-premises for mid-sized organizations
- Spring/Fall release trains

### 6.3 TELUS Health Ariel

- 30+ years in production
- 5,000+ configurable parameters (plan behavior via config, not code)
- Three delivery modes: SaaS, co-sourced, fully outsourced
- Actuarial calculation as built-in platform service
- Multi-platform data consolidation (benefits, savings, HRIS)

### 6.4 Key Differentiator for NoUI Sales

NoUI's target market (2K-10K active members, small-to-mid public pension)
is underserved by Sagitec and Vitech, who focus on larger implementations.
TELUS serves larger Canadian funds. The competitive pitch:

- **Migration cost:** Product feature vs. consulting engagement
- **Transparency:** Full calculation traces vs. black-box engines
- **AI safety:** Structural boundary vs. policy boundary
- **Time to value:** Metric-gated waves vs. big-bang cutover
- **TCO:** Modern infrastructure (Docker, Kubernetes, PostgreSQL) vs.
  legacy stacks requiring specialized support

---

## 7. Document Maintenance

This document is a point-in-time reference. Update when:

- A deferred item's trigger condition is met → move to active planning
- A "genuine gap" is addressed → update status to "built" with code reference
- New competitive intelligence warrants addition
- A "built" assessment turns out to be wrong (capability gap discovered in testing)

Do not create action items or tickets from this document. The trigger conditions
in Section 5 define when each item becomes actionable.

---

*NoUI Platform — Session 14 AMS Findings Reference v1.0 — 2026-03-22 — Confidential*
