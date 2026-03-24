# NoUI Multi-Tenant Design Framework

**Document type:** Architecture — Tier 1 Governing Document
**Status:** Draft — awaiting Jeff review
**Created:** 2026-03-22
**Companion document:** `UNIVERSAL_PLAN_TIER_MODEL.md`
**Scope:** Multi-tenant design patterns applicable across all public pension agency deployments
**Feeds:** ADR-008 (multi-tenancy), Plan Configuration Registry, Analytics Bridge architecture

---

## Review Notes (2026-03-22 — Claude Code analysis)

Three items in this document were cross-referenced against the current codebase and
revised for accuracy. See inline `[REVISED]` markers in Sections 1 and the summary.

1. **Database isolation** — Production uses database-per-tenant; RLS enforces member-level
   isolation within each tenant's database. Both layers are required.
2. **Intelligence service** — Split into per-tenant Rules Engine (identified data) and shared
   Pattern Intelligence Service (de-identified structural patterns via Analytics Bridge).
3. **Connector deployment** — Supports multiple topologies including on-premises appliance mode.
   The connector binary is deployment-topology-agnostic.

---

## Design Principle

Multi-tenancy in NoUI is not a deployment convenience — it is the architectural moat. Patterns learned from one agency's operations compound into value for every subsequent agency, without PII ever crossing tenant boundaries. The "configure, don't rebuild" thesis becomes more defensible with each deployment. A new entrant starting from scratch cannot replicate the cross-tenant intelligence accumulated across 50 deployments.

---

## Section 1 — Tenant Isolation

### Isolation model

| Layer | Isolation mechanism | Rationale | Type |
|---|---|---|---|
| Database | Separate database per tenant (production). RLS enforces member-level isolation within each tenant's database | `[REVISED]` Two-layer model: DB-per-tenant is the agency boundary; RLS (with FORCE ROW LEVEL SECURITY) is the member boundary within. Both are database-enforced, not application-level | Per-tenant (DB) + Shared (RLS) |
| Encryption | Separate encryption key per tenant — KMS-managed, agency-owned rotation rights | Key compromise is limited to one agency. Fiduciary obligation: agency data is agency-owned | Per-tenant |
| Compute | Separate container namespace per tenant (rules engine execution) | Prevents runaway calculation jobs in one tenant from degrading others | Per-tenant |
| Storage | Separate storage buckets per tenant (documents, audit logs, exports) | Audit log integrity — no cross-contamination of audit trails | Per-tenant |
| Logging | Separate log streams per tenant with tenant-specific retention policies | Jurisdictions vary: some require 7-year retention, others indefinite. Cannot share log infrastructure | Per-tenant |
| Data Connector | Supports multiple deployment topologies; PII stays within tenant boundary regardless of where source DB is hosted | `[REVISED]` See Connector Deployment Topologies below. The connector binary is topology-agnostic; the isolation guarantee is "PII never leaves the tenant boundary," not "PII never leaves the building" | Per-tenant |
| Row-level security | PostgreSQL RLS policies enforce member-sees-own-data at DB layer; staff bypass via role | Defense-in-depth: even if application layer has a bug, DB layer blocks cross-member data access | Shared (within tenant DB) |
| Rules Engine | Per-tenant; runs inside tenant boundary; uses identified member data; loads tenant's plan-config.yaml | `[REVISED]` The rules engine is deterministic calculation code that requires identified data (DOB, salary, service credit). It runs per-tenant, not as shared infrastructure | Per-tenant |
| Pattern Intelligence Service | Cloud-hosted; receives only de-identified structural patterns via Analytics Bridge | `[REVISED]` Separated from Rules Engine. Accumulates cross-tenant learning (schema patterns, process benchmarks, data quality signatures). Zero member PII | Shared |
| Rule definitions (YAML) | Per-tenant rule set; governed by agency's own governing documents | Each agency has its own statutory authority | Per-tenant |
| Workspace templates | Base templates shared; agency-specific overrides layered on top | Service retirement workspace looks similar across agencies; branding and field set differ | Hybrid |

### Key decisions established

**Database-per-tenant** is the production deployment model. Each agency receives its own PostgreSQL database instance. The shared-database model is used in development and testing environments only.

**RLS (Row-Level Security)** enforces member-level isolation within each tenant's database. Staff users see all members; member-portal users see only their own records. This is a separate concern from tenant isolation — it is intra-tenant access control.

**Intelligence layer split:** The Rules Engine (deterministic benefit calculation) runs per-tenant inside the tenant boundary with full access to identified member data. The Pattern Intelligence Service (cross-tenant learning) runs as shared infrastructure and receives only de-identified structural patterns validated by the Analytics Bridge.

**Open design questions for multi-tenant scale:**
- How workspace template inheritance works (base + override vs. full per-tenant copy)
- Analytics Bridge architecture — the component that validates and routes cross-tenant pattern data

### Connector deployment topologies

The connector binary is the same in all topologies. The isolation guarantee is **"PII never leaves the tenant boundary"** — the tenant boundary is a logical construct enforced by encryption, credential isolation, and network architecture. Where source data physically resides determines which topology applies.

| Topology | Source DB | NoUI Platform | PII transit path | Isolation mechanism |
|----------|----------|--------------|------------------|-------------------|
| **Cloud-to-cloud** | Cloud-hosted PAS (Sagitec SaaS, AWS, Azure Gov) | Cloud-hosted | Cloud → Cloud (encrypted) | TLS in transit, VPC peering or private endpoints, tenant-scoped credentials, no public internet exposure |
| **On-prem to cloud** | Legacy mainframe or on-prem database | Cloud-hosted | On-prem → Cloud (encrypted tunnel) | Site-to-site VPN or on-prem connector appliance with reverse tunnel; PII encrypted before traversing public network |
| **Fully on-prem** | Legacy DB | Agency-hosted NoUI instance | Never leaves agency network | Physical network isolation; strongest guarantee but highest operational cost |
| **Cloud to on-prem** | Cloud-hosted PAS | Agency-hosted NoUI instance | Cloud → On-prem (encrypted) | Same TLS + credential isolation as cloud-to-cloud; agency controls the destination |

**Key principle:** Many agencies have already moved their legacy PAS to cloud-hosted platforms (Sagitec's Neospin is SaaS; Conduent offers hosted services). In these cases, PII has already left the agency's physical premises by the agency's own procurement decision. The NoUI isolation guarantee is that PII stays within the **tenant boundary** — a logically isolated set of infrastructure (database, encryption key, compute, storage) that no other tenant can access — regardless of whether that infrastructure is on-premises or cloud-hosted.

**Controls applied in all topologies:**
- Tenant-specific encryption key (KMS-managed, agency-owned rotation rights)
- Tenant-scoped source DB credentials (stored encrypted, never shared across engagements)
- Database-per-tenant (no cross-tenant data mixing in NoUI's storage)
- Audit logging of all connector data access (who accessed what, when)
- No persistent caching of source data outside the tenant's NoUI database

---

## Section 2 — Configuration Surfaces

Each item below is a configuration surface — something that varies from one pension agency to the next and must be configurable without code changes. The scope column indicates whether the value lives at the system, plan, tier, or employer level.

**Type key:**
- **Per-tenant** — unique per agency; full isolation required
- **Configurable** — shared structure, agency-specific values
- **Shared** — platform-wide; no tenant variance
- **Hybrid** — shared base structure with tenant-specific overlay

| Configuration surface | Scope | Variance across corpus | Type |
|---|---|---|---|
| Benefit formula type + parameters | Tier | Flat multiplier (DERP, COPERA, TRS TX), age factor table (CA systems), stepped bands (NYCERS, HMEPS), cash balance (HMEPS Group D) | Per-tenant |
| FAS / AMS / HAS strategy | Tier | 36 mo, 60 mo, 12 mo, 78 bi-weekly periods, 3 or 5 highest years, non-consecutive allowed (LACERA Plan E) | Per-tenant |
| Eligibility pathways | Tier | Rule of 75/80/85/88/90, age+service thresholds, service-only, age-only backstop | Per-tenant |
| Tier assignment rules + effective dates | Plan | Hire date range, vesting status at reform date, member election, employer+BU matrix, reciprocal retention | Per-tenant |
| Early retirement reduction schedule | Tier | Flat % per year (DERP), graduated HAS table (COPERA), actuarial table (STRS Ohio), null (no early option) | Per-tenant |
| COLA strategy + rate | Tier | Discretionary, CPI-capped no banking, CPI-banked (LACERA/SDCERA/OCERS), fixed statutory, investment-linked (HMEPS), board-variable (STRS Ohio) | Per-tenant |
| Contribution rate structure | Tier | Flat %, wage-band table (NYCERS T6), entry-age individualized (SDCERA/OCERS), 50/50 cost-sharing (PEPRA), non-contributory (LACERA Plan E), cessation at service threshold | Per-tenant |
| Payment options menu | Plan | Max/single-life, 100/75/50% J&S are universal; some plans add Pop-Up, custom multi-beneficiary (OCERS Option 4), PLOP (STRS Ohio) | Hybrid |
| J&S actuarial reduction factors | Plan | Plan-specific; depend on benefit formula and mortality assumptions; must be certifiable to plan's own actuary | Per-tenant |
| Vesting schedule | Tier | 5 years (universal in corpus); some use cliff vs. graded; occasionally 10 years for specific eligibility pathways | Configurable |
| Service credit types + exclusion rules | Plan | Earned, purchased, military, transferred; which types count for benefit vs. eligibility vs. Rule-of-N differs per plan | Per-tenant |
| IRC §415(b) / §401(a)(17) limits | System | Annual IRS limits; same federal values, but some plans have excess benefit plans for grandfathered members (OCERS) | Shared (base) |
| Fiscal year start/end | System | July 1 (most), December 31 (OCERS), September 1 (TRS Texas school year) | Configurable |
| Governing document references | Plan | RMC §18-391+ (DERP), C.R.S. §24-51 (COPERA), CA Gov Code §20000+ (CalPERS) — every rule must cite its statute | Per-tenant |
| Employer + bargaining unit routing matrix | System | Critical for OCERS (15 employers), COPERA (500+); trivial for DERP (1 employer) | Configurable |
| DROP availability + parameters | Plan | HMEPS, TRS TX, many CA systems offer DROP; DERP does not. Interest crediting method, duration cap, and exit rules vary | Configurable |
| Social Security participation flag | System | Covered (DERP, SDCERA, OCERS, OPERS) vs. non-covered (COPERA, LACERA, CalSTRS, TRS TX, HMEPS); drives PEPRA compensation cap logic | Per-tenant |
| Retiree health benefit structure | System | IPR (DERP: $6.25/$12.50 per yr service), closed plan (SDCERA), Medicare supplement, none | Configurable |
| DRO methodology | Plan | % of marital share (DERP), Majauskas formula (NYCERS — NYC statutory, cannot be genericized), offset vs. shared payment | Per-tenant |
| Working-after-retirement rules | System | Hour limits (DERP: 1,000 hrs/yr), earnings limits, separation minimums, benefit suspension triggers — highly variable | Per-tenant |
| Application deadlines and cutoffs | Plan | DERP: 30 days from last day worked; 15th of prior month for payment processing. Varies by plan | Per-tenant |
| Branding + terminology | System | "AMS" (DERP) vs. "HAS" (COPERA) vs. "FAS" (CA systems) — same concept, different agency labels | Per-tenant |
| Source plan code mapping | Engagement | Legacy plan codes to canonical tier IDs — per-source-system mapping for migration | Per-tenant |
| Membership segment synthesis rules | System | How the connector creates segments from legacy data lacking the segment concept | Per-tenant |

### High-surprise configuration surfaces

These three are most likely to cause implementation problems if treated as simple parameters:

**DRO methodology** — The Majauskas formula is NYC-statutory (RSSL) and cannot be expressed as a parameter of a generic DRO engine. It requires a dedicated calculation path. Any agency using the standard "percentage of marital share" approach is straightforward; Majauskas is a separate code path.

**J&S actuarial reduction factors** — Provaliant cannot set these values unilaterally. Each agency's actuary must certify the factors. The configuration surface must include an approval workflow: actuary provides factors → staff enters → supervisor reviews → certification recorded.

**COLA banking** — LACERA, SDCERA, and OCERS require a per-retiree COLA Bank balance that accumulates over years. This is stateful computation, not a one-time calculation. The data model requires a COLA Bank balance record per retiree that is updated annually at each COLA application cycle.

---

## Section 3 — Universal Process Catalog

Every pension agency in the corpus runs these 12 process domains. The workflow structure is universal; the rules inside each workflow are tenant-specific. This is the multi-tenant process library: build the workflow engine once, configure the rules per tenant.

| Process domain | Universal stages | Key tenant variance |
|---|---|---|
| Member enrollment / onboarding | Identity verification → tier assignment → contribution setup → beneficiary designation → welcome communication | Tier assignment rules; election window (choice-based); employer routing matrix |
| Service retirement | Application intake → eligibility verification → FAS/AMS calculation → payment option election → spousal consent → benefit finalization → payroll setup | Tier-specific formula; eligibility pathway logic; application deadlines; payment option menu |
| Benefit estimate | Member request → data pull → eligibility projection → benefit calculation → scenario modeling → communication | Multiple tier segments; early vs. unreduced pathways; purchase impact modeling |
| Disability retirement | Claim intake → medical evidence collection → eligibility determination → benefit formula application → periodic review → conversion to service retirement | Service-connected vs. non-service-connected distinction; medical review authority; plan-specific disability formula |
| Refund / termination | Separation confirmation → vesting check → separation wait period → contribution balance calculation → tax withholding election → payment | Separation wait period (DERP: 90 days); interest crediting method; rollover options; partial vesting treatment |
| Death / survivor benefit | Death notification → beneficiary identification → pre/post-retirement determination → survivor benefit calculation → payment setup → estate coordination | Active vs. retiree death rules differ; survivor annuity formulas; lump-sum death benefit parameters; J&S automatic continuation vs. optional |
| Domestic Relations Order (DRO) | Order receipt → legal review → plan qualification determination → marital share calculation → payment option → ongoing administration | Division method (% vs. amount vs. Majauskas); COLA treatment per order language; lump-sum death benefit impact |
| Service credit purchase | Eligibility determination by purchase type → documentation collection → cost calculation → quote issuance with expiry → payment processing → credit posting | Purchasable service types; actuarial cost methodology; installment plan options; exclusion rules (benefit vs. eligibility credit) |
| Employer reporting | Payroll submission → validation (member match, rate check, hours) → exception handling → contribution posting → employer communication | Submission format (COPERA: STARS portal; CalPERS: XML/CSV); validation rule set; correction workflows |
| Working after retirement | Rehire notification → limit monitoring → threshold alert → benefit suspension (if triggered) → reinstatement on re-separation | Hour vs. earnings limits; separation duration requirements; suspension vs. reduction treatment |
| Annual operations | COLA application (if triggered) → member statement generation → 1099-R production → actuarial data submission → GASB reporting → contribution rate update | COLA trigger mechanism; fiscal year calendar; statement content requirements; actuary firm interface |
| Member services (day-to-day) | Inbound contact → member lookup → context assembly → inquiry resolution → document issuance → follow-up tracking | Communication channel preferences; staff role taxonomy; verification letter formats; counseling scheduling |

### Design principle for process multi-tenancy

The workflow engine is a shared platform capability — build it once. Stage definitions, entry/exit criteria, required documents, and routing logic are all configuration. Rule execution within each stage calls the tenant's rule set. This applies the "configure, don't rebuild" thesis to process, not just formula. COPERA's BPI documents use the same stage structure for service retirement, refund, DRO, and death processing as DERP — stage names differ slightly; rules inside differ significantly; the engine is the same.

---

## Section 4 — Universal Data Model

These entity groups appear in every pension agency's data model. Column names and data types vary by legacy system; the entities and relationships are universal. The Data Connector maps each agency's legacy schema to this canonical model.

| Entity group | Core entities | Universal attributes | Common legacy variance |
|---|---|---|---|
| Member identity | Member, contact, identity verification | Member ID, SSN, DOB, name, gender, marital status, address history | SSN stored hashed vs. plain; member ID formats vary widely (numeric, alpha-numeric, legacy accession numbers) |
| Employment | Employment record, employer, position, separation | Hire date, employer code, position/class, separation date, separation reason, rehire indicator | Position codes highly system-specific; separation reason codes differ; rehire linkage often ad hoc |
| Membership segment | Segment, tier reference, status history | Segment start/end, tier code, active/inactive/retired/deferred status, reform-split flag | Most legacy systems have no segment concept — this is a canonical entity imposed by NoUI's data model |
| Salary history | Salary record, pay period, compensation components | Pay period start/end, base salary, gross pay, pay frequency, compensation type codes | Pay frequency varies (bi-weekly HMEPS, monthly, semi-monthly); overtime/bonus inclusion rules differ; legacy systems often mix pay components in single fields |
| Service credit | Service credit record, purchase record, credit type | Earned years (months precision), purchased years, credit type, effective date, exclusion flags | Purchased service type coding is highly plan-specific; exclusion tracking (not for Rule-of-N, not for IPR) often manual in legacy systems |
| Contributions | Contribution record, balance, interest credit | Period, employee contribution amount, employer contribution amount, interest credited, running balance | Interest crediting frequency varies; some systems store balance only, not period-by-period history |
| Beneficiary | Beneficiary designation, relationship, vital status | Beneficiary name, relationship code, DOB, SSN, designation type (primary/contingent), effective date, revocability flag | Spousal consent records often stored in paper only; vital status tracking frequently manual |
| Payment option election | Election record, J&S beneficiary, option type | Election date, option code, J&S beneficiary reference, actuarial reduction factor applied, irrevocability flag | J&S beneficiary DOB critical for factor calculation; often stored separately from beneficiary record in legacy systems |
| Benefit payment | Payment record, adjustment, suspension | Payment date, gross amount, net amount, withholding details, payment method, adjustment reason | Payment suspension/reinstatement history often in comment fields; DRO payment splits frequently tracked in spreadsheets |
| DRO / legal orders | DRO master, alternate payee, marital period, division calculation | Order date, marriage start/end, alternate payee identity, division method, marital fraction, payment effective date | Alternate payee as payment recipient (not a member) handled differently across systems — some treat as sub-account, some as separate payee record |
| Documents / case | Application, document, case status, communication | Case type, submitted date, status, assigned staff, required documents checklist, communication log | Document imaging systems vary widely (OnBase, Laserfiche, SharePoint, physical files); integration approach system-specific |
| Employer | Employer master, contribution report, certification | Employer ID, name, employer type, plan participation dates, reporting method, contact | Employer certification of final salary is a common weak point — many plans rely on manual employer sign-off with no system enforcement |
| Annual processes | COLA application, statement batch, 1099-R, actuarial census | Fiscal year, process type, run date, affected member count, exception list | COLA bank balance per retiree (CA systems) is a continuous running record — most legacy systems don't have this entity at all |

### The Membership Segment is the highest-risk missing entity

The Membership Segment is the canonical entity most likely to be absent from legacy systems. COPERA's BPI documents use it explicitly as an operational term; most legacy systems handle rehire and reform-split cases with ad hoc flags or comment fields. NoUI introduces Segment as a first-class entity, and the Connector must synthesize it from employment and status history records when importing from legacy systems that lack it.

The dual-status case (a retiree who suspends retirement and returns to active service) is the most operationally dangerous Segment variant — the COPERA BPI documents flag it explicitly as a pain point requiring a dedicated workflow. The system must identify simultaneous retired + active segments and route them through a dedicated dual-status workflow to ensure only the active portion is eligible for refund.

---

## Section 5 — Governance and Compliance

Every tenant shares the same regulatory framework skeleton. Values and authorities differ, but the obligations are structurally identical across all public pension agencies in the corpus.

| Obligation | Universal structure | Tenant-specific variance | NoUI implication |
|---|---|---|---|
| Governing document authority | Every rule traces to a statute, ordinance, or board policy. Ambiguities require written legal interpretation | DERP: Denver RMC §18-391+. COPERA: C.R.S. §24-51. CalPERS: CA Gov Code §20000+. NYCERS: NY RSSL | Rule YAML schema must carry `governing_document` and `section_reference` fields. Every deployed rule must be certified against the tenant's governing authority |
| Board governance structure | Trustee board with fiduciary duty, defined composition, quorum rules, and delegation authority | Board size ranges from 5 (small municipal) to 16 (COPERA). Elected vs. appointed mix varies. LACERA has dual boards | Board approval gates must be configurable — COLA grant, contribution rate change, rule interpretation — different decisions require different approval authorities per tenant |
| GASB 67/68 compliance | Annual: total pension liability, fiduciary net position, net pension liability, deferred inflows/outflows, schedule of changes | Discount rate, actuarial cost method, and valuation date differ (June 30 for most; December 31 for OCERS) | Reporting templates are universal; tenant-specific: discount rate, valuation date, actuarial firm interface. Shared reporting engine, tenant-specific parameter configuration |
| Actuarial valuation support | Annual data extract: active member census, inactive census, retiree census, contribution history, plan provisions summary | Actuarial assumptions differ per plan. Valuation date varies | Census extract format is universal (PPCC standards); tenant-specific: data cutoff date, assumption parameters, actuary firm contact and format preferences |
| Financial audit | Annual independent audit; ACFR publication; GFOA Certificate pursuit common | Audit firm differs. Some use in-house actuaries (NYCERS: NYC Office of the Actuary). Audit scope varies | Audit trail architecture is shared and immutable. Tenant-specific: audit firm access provisioning, data export format, retention period (7 years minimum, often indefinite) |
| IRC §415(b) benefit limit | Annual federal maximum benefit; applied to all DB plans; adjusted annually by IRS | Most plans comply directly; OCERS legacy members have excess benefit plans paying above §415 cap from a separate non-qualified fund | Shared annual limit table; tenant flag for excess benefit plan existence; separate payment routing if excess plan is active |
| IRC §401(a)(17) compensation limit | Annual federal compensation cap for benefit calculation ($350,000 in 2025) | Post-1/1/1994 members capped. Pre-1994 members may be grandfathered above cap (plan-specific) | Per-member grandfathering flag required. Shared annual limit table; tenant-specific grandfathering cohort definition |
| Section 218 Social Security status | State-level agreement with SSA determines whether members participate in Social Security | Covered: DERP, SDCERA, OCERS, OPERS. Non-covered: COPERA, LACERA, CalSTRS, TRS TX, HMEPS | System-level SS flag. Drives PEPRA compensation cap selection (covered vs. non-covered threshold). Affects total retirement income modeling |
| Records retention | Member records must be retained for the life of the benefit plus a statutory period | Colorado: specific retention schedule. California: varies by record type. NY: permanent for benefit records | Tenant-specific retention policy configuration. Deletion workflows must check retention rules before purging. Log streams must match retention policy |
| Tax reporting (1099-R) | Annual IRS 1099-R for all retirees; box codes, distribution codes, state tax withholding | State withholding rules differ. Distribution codes vary by benefit type | 1099-R generation is a shared batch process. Tenant-specific: state withholding tables, distribution code mapping, electronic filing credentials |
| Calculation traceability | Every benefit calculation must be traceable to the governing document provision that produced each input and output | The specific citations differ (RMC section vs. C.R.S. section vs. CA Gov Code section); the requirement is universal | Calculation trace format is universal — rule_id, source_reference, input_values, output_values. The `governing_document` field is tenant-specific content in a shared structure |

---

## Section 6 — Cross-Tenant Learning

The Analytics Bridge is the component that validates, anonymizes, and routes cross-tenant intelligence. It is a first-class architecture component — not an afterthought — because it is the mechanism by which multi-tenancy becomes a compounding advantage rather than just a cost-sharing model.

### What can cross tenant boundaries

| Data type | Example | Privacy control |
|---|---|---|
| Schema patterns | "Legacy SALARY_HIST tables with PAY_PERIOD_END_DATE column indicate bi-weekly pay systems — apply bi-weekly normalization adapter automatically" | Structural only; no member data |
| Process timing patterns | "Service retirement applications average 23 days from receipt to finalization; agencies at 45+ days have a bottleneck in employer certification stage" | Aggregated statistics; no individual cases |
| Data quality signatures | "Beneficiary allocation errors occur in ~2% of records migrated from Neospin systems — run allocation-sum validation on import" | Error pattern type; no specific records or agency names |
| Rule interpretations | "Ambiguity in 'consecutive months' language: furlough periods within the FAS window do not break consecutiveness unless exceeding 30 days" | Legal interpretation; no member data — requires attorney review before cross-tenant application |
| Calculation verification patterns | "Hand calculation discrepancies in J&S reduction factor most often trace to DOB-at-retirement vs. DOB-at-payment-start distinction" | Methodological finding; no specific member calculations |
| Staff productivity benchmarks | "CSR average handle time for benefit estimates: 12 min (small plan) vs. 8 min (large plan with self-service portal) — portal self-service reduces estimate requests by ~40%" | Aggregate operational metrics; no individual staff records |
| Legislative impact signatures | "Vesting-status-at-date tier splits (SB18-200-type reforms) affect ~15% of active members on average — flag member population for proactive communication" | Reform impact pattern; no specific member identities |

### What never crosses tenant boundaries

- Member PII: names, SSNs, dates of birth, addresses, relationship information
- Specific benefit amounts: salary values, benefit calculations, contribution balances, refund amounts
- Individual case details: application status, DRO specifics, disability determinations
- Rule configurations: a tenant's specific YAML rules, governing document interpretations, board policy documents — unless tenant explicitly consents to share
- Employer data: payroll files, employer contribution histories, employer contact information

### The compounding knowledge curve

| Deployment count | What the platform knows | Value to new tenants |
|---|---|---|
| 1 tenant (COPERA) | COPERA-specific patterns; baseline rules; schema map for Neospin/Sagitec | No cross-tenant value yet; value is in the platform itself |
| 3-5 tenants | Flat-multiplier rule library; 2-3 legacy schema families mapped; common data quality patterns emerging | New flat-multiplier plan configures ~70% of rules from library; schema mapping begins at "known patterns" not blank slate |
| 10-20 tenants | All four formula archetypes implemented; process benchmarks meaningful; legislative impact patterns from at least 2 reform cycles | Rule configuration accelerates significantly; benchmarks let boards compare operational efficiency against peers |
| 50+ tenants | Full formula coverage; multi-state regulatory patterns; employer reporting error signatures by payroll vendor; staff productivity norms | A new agency onboards against a near-complete configuration template; novel cases are genuinely rare |

### Analytics Bridge enforcement mechanism

The Analytics Bridge validates all outbound data against a structural schema before it is permitted to cross a tenant boundary:

- Fields that could contain PII are blocked by default — the field must be explicitly whitelisted as structural
- Numeric values are aggregated or removed — no specific salary or benefit amounts pass through
- Agency identifiers are replaced with anonymized system-type codes before patterns are stored in the shared knowledge base
- Enforcement is architectural (schema validation at the bridge) not policy-only

---

## Summary: The Three Structural Laws of NoUI Multi-Tenancy

**Law 1 — Hard isolation for three things:** Database, encryption key, and rule definitions are per-tenant without exception. No shared infrastructure option exists for these regardless of cost pressure or operational convenience.

**Law 2 — Configuration over code for everything else:** The 25 configuration surfaces identified above must all be expressible as data — YAML, database records, or configuration files — without requiring code changes. A new tenant onboarding must not require a software deployment.

**Law 3 — PII never crosses; patterns always can:** The Analytics Bridge is the invariant boundary. Anything that could identify a member, employer, or specific benefit amount stays within the tenant boundary permanently. Anything that describes structural patterns, process efficiency, or calculation methodology can cross that boundary and compound into platform intelligence.

---

## Document Governance

| Item | Value |
|---|---|
| Authority tier | Tier 1 — Governing Architecture Document |
| Supersedes | None (new document) |
| Companion document | `UNIVERSAL_PLAN_TIER_MODEL.md` |
| Related documents | `noui-security-architecture.md`, `noui-architecture-decisions.docx`, `progressive-migration-architecture.md`, pension plan profiles (all), COPERA BPI documents |
| Next action | Jeff review and approval; upon approval, feeds ADR-008 (multi-tenancy architecture decision record) and Plan Configuration Registry schema design |
| Claude Code | Not yet — analysis document; feeds future ADR-008 and S1 DDL design session when Plan Configuration Registry build begins |
