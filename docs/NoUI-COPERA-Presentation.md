# NoUI: AI-Composed Pension Administration
## A Modern Platform for COPERA

---

## The Problem

Public pension administration systems are built on decades-old technology with decades-old assumptions.

- **Advisors** navigate 15+ screens to answer a single retirement question — toggling between member data, salary history, eligibility rules, and case notes
- **Members** call in because self-service portals are confusing, incomplete, or built as an afterthought on top of batch-era systems
- **Every interaction** requires manually assembling the right data from the right systems, in the right order, for the right person
- **Compliance risk** — advisors may miss alerts, forget steps, or apply rules inconsistently across 600,000+ members
- **Modernization feels impossible** — the legacy data is deeply embedded, conversion projects take years, and the risk of getting a calculation wrong is existential

The core issue: traditional software forces users to think about *where* information lives, instead of just showing them *what they need*.

---

## The NoUI Vision

**What if the software composed itself around the work being done?**

NoUI is a new approach to building applications where an AI composition layer decides — in real-time — which panels to show, which alerts to surface, and which data to fetch, based on who the user is looking at and what they need to accomplish.

The key insight: **AI handles the layout. Certified rules handle the math.**

- The AI never calculates a benefit amount or applies a reduction factor
- Deterministic, auditable code executes every business rule with statutory references
- The AI simply decides what to *show* — which is exactly what a senior advisor would do instinctively
- If the AI is ever unavailable, the system falls back to static page layouts — members and advisors are never blocked

This isn't AI replacing pension expertise. It's AI *amplifying* it — making sure every advisor performs like the best advisor, every time.

---

## What We Built (Proof of Concept)

We built a working proof of concept using Denver's pension plan rules as the domain. The architecture, platform, and approach are designed from day one to be portable to COPERA's scale and complexity.

### Four Integrated Portals

| Portal | Audience | Purpose |
|--------|----------|---------|
| **Agent Workspace** | Plan advisors | Retirement calculations, scenario modeling, case management |
| **CRM Workspace** | Service reps | Contact management, conversation tracking, outreach |
| **Member Portal** | Plan members | Self-service benefit projections, account balances, secure messaging |
| **Employer Portal** | Participating employers | Roster management, plan analytics |

### The Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      React Frontend                           │
│   Agent Workspace  │  CRM  │  Member Portal  │  Employer      │
├──────────────────────────────────────────────────────────────┤
│          AI Composition Layer  ←→  Static Fallback Pages      │
│    Decides: panels, alerts, data fetches, view mode           │
├───────────┬───────────────────┬───────────────────────────────┤
│ Connector │   Intelligence    │           CRM                 │
│ Service   │    Service        │          Service              │
│           │  (Rules Engine)   │   (Contacts & Cases)          │
├───────────┤                   │                               │
│ Auto-Map  │  Admin Rules      │    Multi-Tenant               │
│ Layer     │  Baseline         │    Isolation                  │
├───────────┴───────────────────┴───────────────────────────────┤
│                    PostgreSQL Database                         │
│    Legacy Schema (untouched)  →  Auto-Mapped Modern Model     │
└──────────────────────────────────────────────────────────────┘
```

**Three microservices, each with a clear role:**

1. **Connector** — Data access layer with automatic schema mapping. Every database read flows through here. The legacy database is never modified — instead, an auto-mapping layer translates legacy table structures into a clean, modern data model in real time.

2. **Intelligence** — The rules engine. Executes certified plan provisions with full statutory references. Every calculation shows its work — inputs, formula, intermediate steps, and result. Administrative rules serve as the deterministic baseline that the AI learns from.

3. **CRM** — Relationship management built natively into the platform. Tracks contacts, conversations, commitments, outreach campaigns, and maintains a complete audit trail. Designed for multi-tenant operation from day one.

---

## Zero Data Conversion: The Auto-Map Approach

One of the biggest risks in pension modernization is data conversion. Traditional projects spend 12-18 months migrating legacy data into a new schema — introducing risk, requiring extensive reconciliation, and creating a hard cutover date where everything must work perfectly on day one.

**We eliminate that risk entirely.**

### How It Works

```
┌─────────────────────┐         ┌─────────────────────┐
│   Legacy Database    │         │   Modern Data Model  │
│                      │         │                      │
│  MEMBER_MASTER       │──auto──▶│  member.profile      │
│  EMPLOYMENT_HIST     │  map    │  member.employment   │
│  SALARY_HIST         │  layer  │  member.salary       │
│  SVC_CREDIT          │         │  member.service      │
│  BENEFICIARY         │         │  member.beneficiaries│
│  DRO_MASTER          │         │  member.dro          │
│                      │         │                      │
│  (unchanged)         │         │  (virtual, real-time)│
└─────────────────────┘         └─────────────────────┘
```

- **The legacy database stays exactly as it is.** No schema changes, no data migration, no reconciliation projects.
- **The Connector Service reads legacy tables** and translates them into a clean, normalized model at query time.
- **The mapping layer learns the legacy schema** — column names, data types, relationships, even inconsistencies (like SSNs stored with and without dashes, or phone numbers in mixed formats).
- **New features write to modern tables** alongside the legacy data. Over time, the modern model grows while the legacy footprint shrinks naturally.

### Why This Matters for COPERA

COPERA's legacy systems contain decades of member data with all the accumulated quirks that implies — naming inconsistencies, nullable fields that shouldn't be null, redundant columns, format changes over time. A traditional conversion project would need to reconcile every one of these issues before go-live.

With auto-mapping, those issues are handled transparently by the Connector layer. The frontend and rules engine always see clean data. The legacy database is never at risk. And there's no big-bang cutover — you can run the new system alongside the old one, validating results side by side, for as long as needed.

---

## The Rules Engine: Administrative Rules as Baseline

The Intelligence Service implements plan provisions as a deterministic rules engine — the certified, auditable foundation that the AI composition layer learns from.

### How Rules Are Defined

Every business rule is defined in structured YAML with:
- **Statutory reference** (e.g., C.R.S. 24-51-101 et seq.)
- **Input parameters** with types and constraints
- **Logic conditions** expressed as clear decision trees
- **Test cases** — boundary conditions, edge cases, expected outputs
- **Version history** — who changed what, when, and why

### Eligibility Determination
- **Vesting**: 5 years of earned service required
- **Normal Retirement**: Age 65 + vested
- **Rule of 75/85**: Age + earned service meets threshold, with tier-specific minimum ages
- **Early Retirement**: Reduced benefit for members who meet age minimums but not full eligibility
- **Deferred**: Vested but under minimum age — benefit payable at 65

### Benefit Calculation
```
Monthly Benefit = Average Monthly Salary x Tier Multiplier x Service Years
```

The system handles the full complexity:
- **Multiple tier multipliers** with different formulas per hire-date cohort
- **Four payment options** (Maximum, Joint & Survivor 100%/75%/50%)
- **Domestic Relations Orders** (divorce-related benefit splits)
- **Early retirement reductions** using statutory factor tables — not approximations
- **Death benefits** and involuntary pre-retirement benefits
- **Leave payout** impact on average salary calculations

Every result includes the statute reference, the inputs used, and the full calculation chain — so advisors can verify and members can understand exactly how their benefit was determined.

### The Baseline Principle

These administrative rules serve a dual purpose:

1. **They execute the plan provisions** — deterministic, auditable, certified
2. **They define the ground truth that trains the AI** — the composition layer learns which panels, alerts, and data are appropriate by testing itself against thousands of rule-evaluated scenarios

The AI never invents rules. It learns from them.

---

## AI Composition: The "NoUI" Layer

This is what makes the approach fundamentally different from traditional pension software.

When an advisor looks up a member, the AI receives the member's profile, CRM context, and eligibility snapshot. In milliseconds, it decides:

| Decision | Example |
|----------|---------|
| **View mode** | Workspace for members, CRM for beneficiaries and external contacts |
| **Which panels to show** | A vested active member sees benefit calculations; a terminated non-vested member sees only basic info and service credit |
| **Which alerts to surface** | Married member? Spousal consent alert. Medicare eligible? Highlight it. Overdue commitments? Flag it. |
| **Which data to fetch** | Only load what's needed — no unnecessary database calls, faster response times |

### How It Works in Practice

**Scenario A — Active member approaching retirement:**
> Panels shown: Member banner, service credit, benefit calculation, payment options, scenario modeler, death benefit, IPR calculator, employment timeline
>
> Alerts: Spousal consent required, leave payout boost available, waiting increases benefit
>
> The advisor sees everything they need to walk through retirement options — nothing more, nothing less.

**Scenario B — Beneficiary calling about a deceased member:**
> Panels shown: Employment timeline, case journal, AI summary, CRM note form
>
> Alerts: None (member-specific alerts don't apply)
>
> View: CRM mode — focused on the conversation and the person, not the calculation.

**Scenario C — External contact with a security flag:**
> Panels shown: Employment timeline, case journal, AI summary, CRM note form
>
> Alerts: Security flag warning, overdue commitments, SLA breach
>
> View: CRM mode — the risk surfaces immediately, before the advisor says a word.

### Static Fallback: Always Available

If the AI composition layer is temporarily unavailable — network issue, API outage, high latency — the system automatically falls back to **pre-built static page layouts**.

These static pages are generated from the same administrative rules that train the AI. They show a sensible default layout for each contact type and member status. They won't be as precisely tailored as the AI-composed version, but they contain the right panels and alerts for the situation.

**No advisor is ever blocked. No member is ever turned away.** The AI enhances the experience; it doesn't gate it.

---

## Real-Time Learning and Continuous Improvement

The AI doesn't just compose workspaces — it gets measurably better over time.

### The Validation Framework

We built a rigorous evaluation system that continuously tests the AI's composition decisions:

1. **10,000 test scenarios** covering every combination of tiers, statuses, contact types, edge cases, and boundary conditions
2. **Deterministic ground truth** — each scenario has a mathematically correct composition based on the plan rules
3. **Automated scoring** — panel accuracy, alert accuracy, view mode accuracy, composite score
4. **Failure categorization** — every mistake is classified by root cause for targeted improvement

### Current Results

| Metric | Score | Quality Gate | Status |
|--------|-------|-------------|--------|
| **View Mode Accuracy** | 100.0% | 99% | Passed |
| **Panel Accuracy** | 96.2% | 95% | Passed |
| **Alert Accuracy** | 96.6% | 90% | Passed |
| **Composite Score** | 98.5% | — | — |

*Validated across 500 stratified scenarios. Full 10,000-scenario certification planned.*

### The Learning Loop

When the AI gets something wrong, the system doesn't just log it — it learns from it:

1. **Analyze** — categorize failures by root cause (wrong derivation, missed dependency, false positive alert)
2. **Select** — automatically choose the most instructive corrective examples from real failures
3. **Refine** — targeted improvements to the AI's instructions for specific rule misunderstandings
4. **Re-validate** — run the full test suite to confirm improvement without regression

We went from 80% panel accuracy to 96.2% through four refinement rounds. Each round takes hours, not weeks.

### Real-Time Knowledge Updates

When plan rules change — a new tier is introduced, reduction factors are updated, a new alert type is added — the system adapts through a defined process:

1. **Update the rule definitions** (YAML) in the Intelligence Service
2. **Regenerate the test scenarios** to include the new rules
3. **Run the validation suite** — the AI learns the new rules through the same training process
4. **Verify with quality gates** — no deployment until accuracy thresholds are met

There's no retraining a machine learning model. No waiting for a vendor release cycle. The rules update, the tests update, and the AI adapts — typically within a single business day.

---

## Multi-Tenant Architecture

The platform is designed from day one to support multiple pension plans on a single deployment.

### Tenant Isolation

```
┌─────────────────────────────────────────────┐
│              NoUI Platform                   │
├─────────────┬─────────────┬─────────────────┤
│  COPERA     │  Plan B     │  Plan C          │
│  Tenant     │  Tenant     │  Tenant          │
├─────────────┴─────────────┴─────────────────┤
│  Shared Infrastructure                       │
│  (Compute, CRM engine, AI composition)       │
├─────────────────────────────────────────────┤
│  Isolated Data                               │
│  (Schemas, rules, prompts, audit logs)       │
└─────────────────────────────────────────────┘
```

**What's shared across tenants:**
- Application infrastructure (compute, networking, deployment)
- CRM engine and workflow automation
- AI composition framework and validation harness
- Frontend component library and design system

**What's isolated per tenant:**
- Database schemas and member data (strict row-level or schema-level isolation)
- Business rules and plan provisions (each plan has its own YAML rule definitions)
- AI composition prompts (each plan's panel catalog, alert conditions, and view mode rules)
- Audit trails and compliance logs
- User access and role-based permissions

### What This Means

A new plan can be onboarded by defining:
1. Its legacy schema mapping (Connector auto-map configuration)
2. Its business rules (YAML definitions)
3. Its composition rules (panel catalog and alert conditions)
4. Its test scenarios (generated from the rules for validation)

The shared platform handles everything else — CRM, UI rendering, AI composition, deployment, monitoring. Estimated onboarding time for a new plan with comparable complexity: **8-12 weeks**, not 8-12 months.

---

## Data Sovereignty: Nothing Leaves Your Environment

A non-negotiable for public pension systems: **member data stays within COPERA's control at all times.**

### Deployment Model

The entire NoUI platform — frontend, microservices, database, rules engine — runs inside COPERA's own infrastructure. Nothing is hosted externally. Nothing phones home.

```
┌─────────────────────────────────────────────────┐
│           COPERA's Environment                   │
│  (On-premise data center or private cloud)       │
│                                                  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  NoUI        │  │  AI Composition          │  │
│  │  Platform    │  │  (Private LLM endpoint)  │  │
│  │  Services    │  │                          │  │
│  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                       │                │
│  ┌──────┴───────────────────────┴─────────────┐  │
│  │          COPERA's Database                  │  │
│  │          (Legacy + Modern)                  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Nothing crosses this boundary.                  │
└─────────────────────────────────────────────────┘
```

### Zero PII to the AI — By Architecture, Not Policy

The most important design decision: **no personally identifiable information is ever sent to the AI composition layer.**

The AI doesn't need to know *who* the member is to decide what panels to show. It only needs abstract characteristics:

| What the AI receives | What the AI never sees |
|---------------------|----------------------|
| Tier: `1` | Name: Robert Martinez |
| Status: `active` | SSN: 123-45-6789 |
| Marital status: `M` | Date of birth |
| Age at retirement: `62` | Home address |
| Vested: `true` | Phone number, email |
| Service years: `25.0` | Salary amounts |
| Has DRO: `true` | Benefit calculations |
| Open conversations: `2` | Account numbers |
| Contact type: `beneficiary` | Beneficiary names |

The AI sees "Tier 1, active, vested, married, age 62, 25 years service" — never "Robert Martinez, SSN 123-45-6789, born 03/15/1964." This isn't a policy control or a filter — it's how the system is built. The composition layer structurally cannot access PII because PII is never passed to it.

### Defense in Depth

Even beyond the zero-PII architecture:

- **Private LLM deployment** — the AI composition layer runs through Anthropic's private endpoint options (AWS Bedrock, Azure, or dedicated instance), all within COPERA's cloud boundary
- **Single-interaction context only** — each AI call contains the abstract profile for one member in one interaction. No bulk exports. No persistent storage outside the database.
- **No training on your data** — member data is never used to train or improve the underlying AI model. This is contractually guaranteed by Anthropic's enterprise terms.
- **No external API calls** — the Connector, Intelligence, and CRM services communicate only within the internal network. There are no outbound data flows.

### What This Means in Practice

- SSNs, benefit amounts, salary histories, DRO details — all stay inside COPERA's perimeter
- Audit logs record every AI composition request and response, stored in COPERA's database
- COPERA retains full control over data retention, access policies, and encryption standards
- The platform can run in an air-gapped environment if required — the static fallback pages ensure full functionality even without any external connectivity

---

## New Frontend, Legacy Backend: No Rip-and-Replace

A critical principle: **we never ask you to replace your backend systems.**

### The Integration Model

```
┌──────────────────────────────────────────┐
│         NoUI Frontend (New)               │
│  Modern React UI, AI-composed panels      │
├──────────────────────────────────────────┤
│         API Gateway / Connector           │
│  Auto-maps legacy data into modern model  │
├────────────────┬─────────────────────────┤
│  Legacy System │  Modern Extensions       │
│  (Unchanged)   │  (CRM, AI, new features) │
│                │                          │
│  Existing DB   │  New services run        │
│  Existing APIs │  alongside, not instead  │
│  Existing jobs │  of, existing systems    │
└────────────────┴─────────────────────────┘
```

- **Your legacy database stays running.** Batch jobs, existing integrations, reports — all unchanged.
- **The new frontend sits on top**, reading through the Connector's auto-map layer.
- **New capabilities** (CRM, AI composition, member portal) are added as modern services alongside the legacy stack.
- **Gradual transition** — you choose when and how to migrate individual functions. There's no cliff.

This approach eliminates the two biggest risks in pension modernization:
1. **Data conversion risk** — there is no data conversion
2. **Big-bang cutover risk** — there is no cutover. Old and new coexist.

---

## What This Means for Operations

### For Advisors
- **Faster interactions**: The right panels appear automatically — no navigating between screens
- **Fewer errors**: Alerts surface proactively — spousal consent, SLA breaches, security flags
- **Consistent service**: Every member gets the same quality of analysis, regardless of which advisor they speak with
- **Always available**: Static fallback pages ensure work continues even if AI services are temporarily down

### For Members
- **Self-service that works**: Benefit projections, payment option comparisons, and contribution history — all in plain language
- **Transparency**: Every calculation shows its work with statutory references
- **Modern experience**: Responsive design, clear navigation, no more green-screen aesthetics

### For IT and Operations
- **No data migration**: Auto-map layer reads legacy data in place
- **No big-bang cutover**: Run new and old side by side, transition at your pace
- **Measurable AI performance**: 96%+ accuracy validated against ground truth before deployment
- **Multi-tenant ready**: Single platform serves multiple plans with isolated data and rules

### For Compliance and Legal
- **AI never executes business rules** — it only decides what to display
- **Full audit trail** on every interaction, calculation, and AI composition decision
- **Statutory references** embedded in every rule output
- **Deterministic fallback** — if AI is unavailable, static pages derived from the same rules take over

---

## Build Timeline

### Phase 1: Foundation (Weeks 1-6)
- Legacy schema analysis and auto-map configuration
- Plan rule extraction and YAML definition (working with COPERA SMEs)
- Core Connector and Intelligence services configured for COPERA's data model
- Initial AI composition prompt with COPERA-specific panel and alert catalogs

### Phase 2: Core Application (Weeks 7-14)
- Agent Workspace with AI-composed layouts
- CRM Workspace with conversation and commitment tracking
- 10,000-scenario test corpus generation from COPERA's rules
- AI composition validation — iterative refinement to quality gate thresholds
- Static fallback page generation

### Phase 3: Member Experience (Weeks 15-20)
- Member Portal with self-service benefit projections
- Employer Portal with roster management
- Integration with COPERA's existing authentication and identity systems
- Accessibility compliance (WCAG 2.1 AA)

### Phase 4: Production Readiness (Weeks 21-26)
- Security hardening, penetration testing, SOC 2 alignment
- Performance testing at COPERA's scale (600,000+ members)
- Multi-tenant configuration and tenant isolation verification
- Parallel run: new system alongside existing, results compared daily
- Staff training and go-live support

### Total: ~6 months to production pilot

This is roughly **one-third the timeline** of a traditional pension system modernization — primarily because we eliminate data conversion, leverage AI for composition instead of hand-building every screen, and reuse the proven NoUI platform.

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + TypeScript | Custom design system, responsive, accessible |
| Services | Go microservices | Three independent services, horizontally scalable |
| Database | PostgreSQL | Legacy auto-mapped + modern CRM schema |
| Rules Engine | YAML definitions + Go | 9 rule categories, statutory references, test cases |
| AI Composition | Claude API | Structured output, prompt caching, sub-second response |
| Validation | Python (compose-sim) | 10,000-scenario automated test corpus |
| Static Fallback | Pre-rendered layouts | Generated from rules, zero AI dependency |
| Deployment | Docker + Kubernetes | Multi-tenant, auto-scaling, cloud-native |

---

## Why NoUI for COPERA

| Traditional Approach | NoUI Approach |
|---------------------|---------------|
| 18-24 month data conversion | Zero data conversion — auto-map in place |
| Big-bang cutover with rollback risk | Gradual transition, old and new coexist |
| Static screens built by developers | AI-composed layouts that adapt to context |
| Rules embedded in application code | Rules defined declaratively, auditable, versioned |
| Months to add a new screen or workflow | Hours to add a panel, days to add a workflow |
| AI as a chatbot bolted on | AI as the core composition engine, validated at 96%+ |
| Single-tenant, single-plan | Multi-tenant from day one |
| 12-18 months to first value | 6 months to production pilot |

---

## Summary

**NoUI is a fundamentally different approach to pension administration modernization.**

Instead of replacing your legacy systems, we sit on top of them — reading data through an auto-mapping layer, applying certified rules, and letting AI compose the right experience for every interaction.

Instead of building hundreds of static screens, the platform composes itself. AI decides the layout. Certified code does the math. Static pages stand by as a fallback. And a rigorous validation framework proves the AI gets it right 96%+ of the time — before a single member is affected.

The result: **faster service, fewer errors, full transparency, no data conversion risk, and a platform that gets smarter with every interaction.**

For COPERA's 600,000+ members and the advisors who serve them — this is what modern pension administration looks like.
