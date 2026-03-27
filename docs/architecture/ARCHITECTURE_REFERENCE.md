# NoUI — Complete Architecture Reference

## Governing Document

This architecture is governed by **NoUI Architecture Decisions & Governing Principles** (noui-architecture-decisions.docx). All design and implementation must conform to the principles and decisions recorded there. In the event of any conflict, the governing document takes precedence.

## System Overview

NoUI is a middleware platform with four layers:

1. **Data Connector** — Abstracts legacy databases into a clean domain model
2. **Business Intelligence** — Deterministic rules engine, process orchestrator, knowledge base
3. **Relevance Engine** — Prioritizes information by task and situation
4. **Dynamic Workspace** — Composes UI components based on context

### AI Role Boundaries

AI serves three distinct roles in NoUI. These boundaries are enforced architecturally, not by convention.

| Layer | AI Does | AI Does NOT |
|-------|---------|-------------|
| Data Connector | Proposes schema mappings (human approves) | Execute queries, transform data, perform calculations |
| Business Intelligence | Drafts rule configurations from governing documents; generates test cases from certified rules | Evaluate rules, execute formulas, determine eligibility, calculate benefits |
| Relevance Engine | Learns task patterns from transactions; prioritizes information by context | Derive business rules from transactions; filter required regulatory information |
| Dynamic Workspace | Composes context-sensitive UI; determines which components to show | Generate the data displayed in components (all values come from the deterministic rules engine) |

**The deterministic path for any function that produces a number, eligibility determination, or dollar amount:**

Certified Rule Definition (YAML) → Deterministic Rules Engine (Go) → Auditable Output with full calculation trace

No AI model, LLM, or probabilistic system is in this path. If the AI service is unavailable, every calculation still produces the correct result.

## Domain Model Entities

### Member
Identity, demographics, contact information, status (Active/Retired/Terminated/Deceased/Deferred/Disability), tier, hire date, termination date.

### Employment
Service periods: department, position, employment type (full/part/temp), FTE percentage, effective/end dates, action type (hire/transfer/promotion/separation/rehire).

### Compensation (Salary History)
Per-pay-period records: gross pay, pensionable pay, overtime, leave payout amount, furlough deduction, employee contribution, employer contribution.

### Contributions
Member/employer payment tracking with running balance. Tracks contribution rate applied.

### Service Credit
By type: Employment (earned), Purchased, Military, Leave. Months of credit, cost (for purchases), payment status. CRITICAL: purchased service is tracked separately because it has different applicability rules.

### Beneficiaries
Designations with primary/contingent type, allocation percentage, effective date, superseded date. Only current (non-superseded) designations are active.

### DRO (Domestic Relations Orders)
Alternate payee information, marriage/divorce dates, division method (percentage or amount), division value, status.

### Benefit Payment
For retirees: benefit type, payment option, gross/net amounts, deductions (tax, insurance, DRO, garnishment), effective date.

### Work Items (Cases)
Case type, member, open/close dates, status, assignment, notes.

### Transactions
Audit log: type, date, detail, user. Immutable append-only.

## Data Connector Service

### Supported Database Platforms

The Data Connector supports the following database platforms for legacy system integration:

| Platform | Status | Notes |
|----------|--------|-------|
| PostgreSQL | Supported | Also used for modern NoUI data model |
| SQL Server | Supported | Common in municipal/state systems |
| Oracle | Supported | Common in larger state systems |
| DB2 | Supported | Legacy IBM environments |

Connection methods: JDBC, ODBC, or native drivers depending on platform and customer environment.

**Known Limitation:** Vendor-hosted systems with no direct database access require case-by-case evaluation. Some vendors may provide API access or batch export capabilities.

### Purpose
Read from legacy database, serve normalized domain model data through a REST API. Handle the translation between messy legacy schema and clean domain entities.

### Key Capability: AMS Calculation
The Average Monthly Salary calculation is the most computationally significant function:
- Sliding window algorithm over salary history
- Window size: 36 months (Tiers 1/2) or 60 months (Tier 3)
- Must handle gaps, partial months, and leave payout boost
- Returns: AMS amount, window dates, monthly breakdown

### Schema Mapping
Configuration-driven mapping from legacy table/column to domain model field. Supports:
- Direct field mapping
- Value transformation (status code translation, date format conversion)
- Computed fields (derived from multiple source fields)
- Join-based mapping (data assembled from multiple tables)

## Intelligence Service

### Rules Engine
Loads rule definitions from YAML configuration. Evaluates conditions, executes formulas, applies reductions.

Rules are organized by category:
- Membership (tier determination)
- Contribution (rates)
- Vesting (5-year threshold)
- Eligibility (6+ retirement paths)
- Benefit Calculation (3 tier formulas + reductions)
- Payment Options (4 options with actuarial factors)
- Service Purchase (cost, applicability exclusions)
- DRO (marital share calculation)
- Refund (non-vested, contributions + interest)
- IPR (insurance premium reduction)
- Re-employment (suspension rules)

### Process Orchestrator
Defines process templates as stages with:
- Entry criteria (what must be true to enter this stage)
- Required data (what information is needed)
- Applicable rules (which rules run at this stage)
- Exit criteria (what must be true to advance)
- Routing (who handles this stage, approval thresholds)

### Composition Engine
Determines which workspace components to show for a given member/process/stage combination.

Tiered approach:
- **Tier 1 (Deterministic):** Process configuration defines mandatory components. No inference.
- **Tier 2 (Rule-Based):** Conditional logic adds/removes components. "If DRO present → add DRO panel."
- **Tier 3 (AI):** Claude API for novel situations. Infrequent. System works without it.

### Tier 3 AI Composition — Triggers and Fallback

**Explicit Triggers for Tier 3:**

Tier 3 AI composition is invoked ONLY when:
1. Combination of factors not covered by Tier 2 rules (e.g., member has DRO + purchased service + early retirement + disability claim simultaneously)
2. First-time encounter with a scenario not yet encoded in Tier 2 rules
3. User explicitly requests AI assistance for workspace layout
4. Process orchestrator flags case as "complex" based on defined criteria

**What Tier 3 Does NOT Do:**
- Execute calculations (all calculations are deterministic, never AI)
- Determine eligibility (rules engine only)
- Make decisions about benefits (human + rules engine only)
- Access data that Tier 1+2 cannot access

**Fallback Behavior:**

If Tier 3 AI is unavailable, times out, or returns an error:
1. System falls back to Tier 2 composition automatically
2. Workspace renders with all potentially relevant panels (inclusive rather than optimized)
3. User sees fully functional workspace — just less optimized for their specific situation
4. System logs the fallback for later analysis
5. No calculation, determination, or benefit is affected

**Critical Principle:** AI affects what you see, never what the numbers are. The system is fully functional without AI. AI improves the experience; it does not enable the capability.

## Dynamic Workspace Components

### Identity & Context
- **MemberBanner:** Persistent header — name, ID, age, tier (color-coded), status, department, service credit
- **AlertBar:** Contextual warnings — DRO present, early retirement penalty, data quality issues

### Data Display
- **EmploymentTimeline:** Visual chronology of employment periods, gaps, transfers
- **SalaryTable:** Compensation history with AMS window highlighted (36 or 60 months)
- **ServiceCreditSummary:** Breakdown by type with purchased service distinction noted
- **BenefitCalculationPanel:** Full formula, every input, step-by-step math, final result
- **PaymentOptionsComparison:** Side-by-side all four options with amounts and factors
- **DROImpactPanel:** Marital period, fraction, share, split amounts

### Analysis
- **ScenarioModeler:** Compare benefit at different retirement dates; shows when Rule of 75/85 is met
- **LeavePayoutCalculator:** Impact of leave payout on AMS (Tier 1/2 pre-2010 only)
- **EarlyRetirementReductionCalculator:** Years under 65, reduction percentage, reduced amount
- **IPRCalculator:** Service years × per-year rate by Medicare status

### Operational
- **DataQualityDashboard:** Issues found by severity, drill-down to individual findings
- **TransactionAnalysisDashboard:** Processing patterns, exception frequencies, trends

## Data Quality Engine

### Discovery Mechanisms
- **Structural:** Valid formats, reasonable ranges, date logic, field constraints
- **Consistency:** Cross-table validation, status/date alignment, balance reconciliation
- **Calculation Verification:** Re-run benefit calculations, compare to stored amounts
- **Pattern Detection:** Anomalous clusters, impossible values, systematic errors

### Issue Classification
- **Severity:** Critical (active benefit wrong), High (affects future process), Medium (institutional risk), Low (cosmetic)
- **Root Cause:** Data entry error, process gap, system error, rule change without correction
- **Resolution:** Proposed correction (awaiting review), requires research, requires agency decision

In Phase 1 (Transparent), no data quality issue is auto-resolved. The system proposes corrections with supporting evidence; corrections are not applied without human approval.

## AI-Accelerated Change Management

### Test Generation
Tests generated from certified rule definitions:
- Standard case for every rule
- Boundary conditions (at threshold, below, above)
- Cross-rule interactions
- Historical validation against legacy calculations

Test suites are generated for human review as part of the rules governance SDLC. They are traceable to specific rule versions and source document provisions.

### Change Detection Workflow
When a rule definition is updated through the governed SDLC process:
1. System generates updated tests from the new certified rule definitions
2. Full regression suite executes against both old and new effective-dated rules
3. Results are packaged for human review: proposed rules, test cases, test results, before/after comparisons
4. Human reviews and approves the complete change package
5. Approved changes are promoted to production on their effective date

Test failures during regression are defects to investigate. They are never auto-resolved. The system prepares complete change packages for human review; it does not silently accept changes.

## Operational Learning

AI observes database transactions and workflow patterns to learn how work gets done — not what the rules are, but how tasks flow. This informs orchestration and workspace composition:

- Which data do analysts access for each task type?
- What sequence do they follow?
- Where do exceptions occur?
- What patterns indicate efficient vs. inefficient processing?

Insights from transaction analysis inform the Relevance Engine and Dynamic Workspace layers only. They never inform the Business Intelligence rules layer. Transaction-derived patterns are reviewed before affecting production workflows.

## Security Architecture

See **noui-security-architecture.md** for the complete security architecture specification.

Summary of key controls (Production — detailed design complete, implementation follows POC):
- Field-level encryption for SSN, bank accounts, medical info (AES-256-GCM)
- RBAC + ABAC (role-based + attribute-based access control)
- Break-glass access with justification and audit
- Delegated permissions with expiration
- Immutable audit logging (every read and write, 7-year retention)
- Medical records (disability) restricted to authorized roles only
- Multi-tenant isolation via database-per-tenant architecture
- SOC 2 Type I targeted before first production customer

## Degradation Strategy

The system implements a six-level degradation hierarchy (Level 0 through Level 5) with defined trigger conditions, system behaviors, and staff-visible indicators at each level. See **ADR-007: Graceful Degradation and Disaster Recovery** for the complete specification.

Summary of levels:
- **Level 0: Normal** — All services operational
- **Level 1: AI Degraded** — AI service unavailable; Tier 1+2 composition only (fully functional, less adaptive layout)
- **Level 2: Workspace Degraded** — Workspace composition service down; static fallback workspaces render all panels
- **Level 3: Intelligence Degraded** — Rules engine or orchestrator partially failing; affected processes halt, unaffected continue
- **Level 4: Data Degraded** — Database connection lost; serve from most recent sync/replica with staleness banner
- **Level 5: Complete Outage** — Documented fallback to legacy system; all in-flight case state persisted for recovery

**Critical:** All benefit calculations, eligibility determinations, and rule evaluations work correctly without any AI service. AI affects workspace composition and orchestration only.

## Service Inventory

All services are Docker-internal only — no host port mappings. All access goes through nginx at `localhost:3000`. See `infrastructure/ports.env` for the full port registry.

| Service | Port | Directory | Purpose |
|---------|------|-----------|---------|
| Frontend (nginx) | 3000 | `frontend/` | React UI + reverse proxy |
| DataAccess | 8081 | `platform/dataaccess/` | Member/salary/benefit queries |
| Intelligence | 8082 | `platform/intelligence/` | Eligibility, benefit calculation, DRO |
| CRM | 8083 | `platform/crm/` | Contact management, interaction history |
| Correspondence | 8085 | `platform/correspondence/` | Template rendering, merge fields |
| Data Quality | 8086 | `platform/dataquality/` | Data quality checks, scoring |
| Knowledge Base | 8087 | `platform/knowledgebase/` | Articles, stage help, rule references |
| Case Management | 8088 | `platform/casemanagement/` | Case tracking, stage workflow |
| Preferences | 8089 | `platform/preferences/` | User preferences |
| Connector | 8090 | `connector/` | Schema introspection, concept tagging, monitoring |
| Health Aggregator | 8091 | `platform/healthagg/` | Health aggregation dashboard |
| Issues | 8092 | `platform/issues/` | Error self-reporting |
| Security | 8093 | `platform/security/` | Security events |
| Employer Portal | 8094 | `platform/employer-portal/` | Employer portal, divisions, alerts |
| Employer Reporting | 8095 | `platform/employer-reporting/` | File uploads, reporting |
| Employer Enrollment | 8096 | `platform/employer-enrollment/` | Member enrollment submissions |
| Employer Terminations | 8097 | `platform/employer-terminations/` | Termination certifications, refunds |
| Employer WARET | 8098 | `platform/employer-waret/` | WARET designations |
| Employer SCP | 8099 | `platform/employer-scp/` | Service credit purchase |
| Migration | 8100 | `platform/migration/` | Migration engine (profiling, mapping, loading) |
| Migration Intelligence | 8101 | `migration-intelligence/` | Migration ML service (Python) |

## Migration Service Layer

The migration pipeline (`platform/migration/`) provides end-to-end legacy system migration capabilities across 15 packages with 38 service contracts. The pipeline is designed for pension administration system migrations where data integrity is paramount — all monetary reconciliation uses `math/big.Rat` for exact arithmetic.

### Pipeline Data Flow

```
Profiling → Mapping → Transformation → Reconciliation → Parallel Run → Cutover → Go-Live
```

### Packages

| Package | Purpose |
|---------|---------|
| `profiler/` | 5-level progressive profiling (L1 inventory → L5 rules extraction) |
| `mapper/` | AI-assisted field + code mapping with acknowledgment workflow |
| `transformer/` | Batch ETL with exception handling + AI clustering |
| `reconciler/` | Tier-based scoring + rule-based execution engine (`math/big.Rat`) |
| `parallel/` | Full-dataset comparison with variance tracking |
| `cutover/` | Plan/step/rollback/go-live lifecycle management |
| `drift/` | Schema + data monitoring with scheduled runs |
| `schema_version/` | Immutable schema versions with diff capabilities |
| `phase_gate/` | Server-side metric evaluation with notification triggers |
| `audit/` | Immutable log with retention policies + PDF reports |
| `job_queue/` | Background execution with stale recovery |
| `recon_rules/` | Configurable reconciliation rules with versioning |
| `risk/` | Risk register with severity tracking |
| `certification/` | Gate certification workflow |
| `reports/` | Report generation and management |

### AI Boundaries in Migration

AI assists with schema mapping proposals and exception clustering during transformation. All AI-proposed mappings require human acknowledgment before use. Reconciliation and benefit calculations remain fully deterministic — no AI in the monetary path.

### Migration Intelligence Service

A separate Python service (`migration-intelligence/`, port 8101) provides ML-based signal scoring for schema mapping confidence and transformation exception clustering. It communicates with the Go migration service via REST API.

## Technology Stack
- **Backend:** Go for performance-critical services
- **Frontend:** React + TypeScript + Tailwind + shadcn/ui
- **Database:** PostgreSQL 16
- **Infrastructure:** Kubernetes, Helm, Docker
- **AI:** Claude API (cloud) or self-hosted models (on-premises)
- **Message Queue:** NATS (future, for event-driven workflows)
- **Document Storage:** MinIO/S3 (future, for scanned documents)
- **Search:** OpenSearch (future, for member search)
