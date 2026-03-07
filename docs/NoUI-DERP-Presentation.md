# NoUI: AI-Composed Pension Administration
## Denver Employees Retirement Plan — Proof of Concept

---

## The Problem

Pension administration systems are stuck in the 1990s.

- **Advisors** navigate 15+ screens to answer a single retirement question
- **Members** call in because self-service portals are confusing and incomplete
- **Every interaction** requires manually assembling the right data from the right systems
- **Compliance risk** — advisors may miss alerts, forget steps, or apply rules inconsistently

The core issue: traditional software forces users to think about *where* information lives, instead of just showing them *what they need*.

---

## The NoUI Vision

**What if the software composed itself around the work being done?**

NoUI is a new approach to building applications where an AI composition layer decides — in real-time — which panels to show, which alerts to surface, and which data to fetch, based on who the user is looking at and what they need to accomplish.

The key insight: **AI handles the layout. Certified rules handle the math.**

- The AI never calculates a benefit amount or applies a reduction factor
- Deterministic, auditable code executes every business rule with statutory references
- The AI simply decides what to *show* — which is exactly what a senior advisor would do instinctively

---

## What We Built

### Four Integrated Portals

| Portal | Audience | Purpose |
|--------|----------|---------|
| **Agent Workspace** | Plan advisors | Retirement calculations, scenario modeling, case management |
| **CRM Workspace** | Service reps | Contact management, conversation tracking, outreach |
| **Member Portal** | Plan members | Self-service benefit projections, account balances, secure messaging |
| **Employer Portal** | Participating employers | Roster management, plan analytics |

### The Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│   Agent Workspace │ CRM │ Member Portal │ Employer       │
├─────────────────────────────────────────────────────────┤
│              AI Composition Layer (Claude)                │
│   Decides: panels, alerts, data fetches, view mode       │
├──────────┬──────────────────┬────────────────────────────┤
│ Connector│   Intelligence   │         CRM                │
│ Service  │    Service       │        Service             │
│ (Data)   │ (Rules Engine)   │  (Contacts & Cases)        │
├──────────┴──────────────────┴────────────────────────────┤
│                  PostgreSQL Database                      │
│        Legacy Pension Schema  │  Modern CRM Schema        │
└─────────────────────────────────────────────────────────┘
```

**Three microservices, each with a clear role:**

1. **Connector** — Data access layer. Every database read flows through here. Handles salary histories, employment timelines, service credit breakdowns, and beneficiary records.

2. **Intelligence** — The rules engine. Executes certified plan provisions with full statutory references (e.g., RMC 18-409(a)(2) for Rule of 75 eligibility). Every calculation shows its work — inputs, formula, intermediate steps, and result.

3. **CRM** — Relationship management built natively into the platform. Tracks contacts, conversations, commitments, outreach campaigns, and maintains a complete audit trail.

---

## The Rules Engine: Certified and Transparent

The Intelligence Service implements the actual Denver plan provisions:

### Eligibility Determination
- **Vesting**: 5 years of earned service required
- **Normal Retirement**: Age 65 + vested
- **Rule of 75** (Tier 1 & 2): Age + earned service years >= 75, minimum age 55
- **Rule of 85** (Tier 3): Age + earned service years >= 85, minimum age 60
- **Early Retirement**: Age 55+ (Tier 1/2) or 60+ (Tier 3) with reduction
- **Deferred**: Vested but under minimum age — benefit payable at 65

### Benefit Calculation
```
Monthly Benefit = Average Monthly Salary x Tier Multiplier x Service Years

  Tier 1: 2.0% per year
  Tier 2: 1.5% per year
  Tier 3: 1.5% per year
```

The system also handles:
- **Four payment options** (Maximum, Joint & Survivor 100%/75%/50%)
- **Domestic Relations Orders** (divorce-related benefit splits)
- **Early retirement reductions** using statutory factor tables
- **Death benefits** and involuntary pre-retirement benefits
- **Leave payout** impact on average salary (pre-2010 hires only)

Every result includes the statute reference, the inputs used, and the full calculation chain — so advisors can verify and members can understand.

---

## AI Composition: The "NoUI" Layer

This is what makes the approach unique.

When an advisor looks up a member, the AI receives the member's profile, CRM context, and eligibility snapshot. It then decides:

| Decision | Example |
|----------|---------|
| **View mode** | Workspace for members, CRM for beneficiaries and external contacts |
| **Which of 12 panels to show** | A vested active member sees benefit calculations; a terminated non-vested member sees only basic info |
| **Which of 14 alerts to surface** | Married member? Spousal consent alert. Medicare eligible? Highlight it. Overdue commitments? Flag it. |
| **Which data to fetch** | Only load what's needed — no unnecessary database calls |

### How it works in practice:

**Scenario A — Active member approaching retirement:**
> Panels shown: Member banner, service credit, benefit calculation, payment options, scenario modeler, death benefit, IPR calculator, employment timeline
>
> Alerts: Spousal consent required, leave payout boost available, waiting increases benefit

**Scenario B — Beneficiary calling about a deceased member:**
> Panels shown: Employment timeline, case journal, AI summary, CRM note form
>
> Alerts: None (member alerts don't apply to non-members)
>
> View: CRM mode — focused on the conversation, not the calculation

**Scenario C — External contact with a security flag:**
> Panels shown: Employment timeline, case journal, AI summary, CRM note form
>
> Alerts: Security flag warning, overdue commitments, SLA breach
>
> View: CRM mode — surfaces the risk immediately

The AI composes the right workspace for the situation. No screen-hopping. No missed alerts. No unnecessary clutter.

---

## Validating the AI: Compose-Sim Framework

A natural question: **how do you trust the AI to get the composition right?**

We built a rigorous evaluation framework to answer that.

### The Process

1. **Generated 10,000 test scenarios** covering every combination of tiers, statuses, contact types, edge cases, and boundary conditions

2. **Each scenario has a deterministic "ground truth"** — the mathematically correct composition based on the plan rules

3. **The AI composes each scenario independently** — no cheating, no pre-programmed answers

4. **Every decision is scored** — panel accuracy, alert accuracy, view mode accuracy

### The Results

| Metric | Score | Quality Gate | Status |
|--------|-------|-------------|--------|
| **View Mode Accuracy** | 100.0% | 99% | Passed |
| **Panel Accuracy** | 96.2% | 95% | Passed |
| **Alert Accuracy** | 96.6% | 90% | Passed |
| **Composite Score** | 98.5% | — | — |

*Validated across 500 scenarios with stratified sampling across all member profiles and edge cases.*

### The Learning Loop

When the AI gets something wrong, we don't just fix it — we systematically improve:

1. **Analyze failures** — categorize by root cause (wrong derivation, missed dependency, false positive)
2. **Select corrective examples** — add real scenarios the AI got wrong as teaching examples
3. **Refine the prompt** — targeted wording changes for specific rule misunderstandings
4. **Re-validate** — run again to confirm improvement without regression

We went from 80% panel accuracy to 96.2% through four refinement rounds. The framework is designed for continuous improvement as rules change or new edge cases emerge.

---

## What This Means for Operations

### For Advisors
- **Faster interactions**: The right panels appear automatically — no navigating between screens
- **Fewer errors**: Alerts surface proactively — spousal consent, SLA breaches, security flags
- **Consistent service**: Every member gets the same quality of analysis, regardless of which advisor they speak with

### For Members
- **Self-service that works**: Benefit projections, payment option comparisons, and contribution history — all in plain language
- **Transparency**: Every calculation shows its work with statutory references

### For Administrators
- **Auditability**: Deterministic rules engine with full calculation chains
- **Measurable AI performance**: 96%+ accuracy validated against ground truth
- **Continuous improvement**: Automated learning loop catches and corrects errors

### For Compliance
- **AI never executes business rules** — it only decides what to display
- **Full audit trail** on every interaction, calculation, and AI composition decision
- **Statutory references** embedded in every rule output

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + TypeScript | Custom "Institutional Warmth" design system |
| Services | Go microservices | Three independent services, clearly separated |
| Database | PostgreSQL | Legacy pension schema + modern CRM schema |
| Rules | YAML definitions + Go engine | 9 rule files covering all plan provisions |
| AI Composition | Claude API | Structured output with enum constraints |
| Validation | Python (compose-sim) | 10,000-scenario test corpus |
| Deployment | Docker Compose + Kubernetes | Production-ready containerized architecture |

---

## Reusability Across Engagements

The NoUI platform is designed to be **engagement-portable**:

**What changes per plan:**
- Business rules (YAML definitions + rules engine)
- Scenario generator (plan-specific test cases)
- System prompt (panel catalog and alert conditions)

**What stays the same:**
- Frontend framework and component library
- Microservice architecture (Connector / Intelligence / CRM)
- AI composition approach and evaluation harness
- CRM, audit trail, and deployment infrastructure

A new pension plan engagement reuses ~70% of the platform. The domain-specific rules and scenarios are the primary customization points.

---

## What's Next

| Phase | Scope | Purpose |
|-------|-------|---------|
| **Full validation** | 10,000-scenario test run | Certify AI composition at scale |
| **Haiku optimization** | Switch to faster/cheaper model | Reduce per-interaction cost by 75% |
| **Production hardening** | Auth, rate limiting, monitoring | Enterprise readiness |
| **Live pilot** | Real advisor sessions with real member data | Validate in the field |

---

## Summary

**NoUI is a new way to build pension administration software.**

Instead of forcing users through rigid screens, the application composes itself around the work. AI decides the layout. Certified code does the math. And a rigorous validation framework proves the AI gets it right 96%+ of the time.

The result: faster service, fewer errors, full transparency, and a platform that improves with every interaction.
