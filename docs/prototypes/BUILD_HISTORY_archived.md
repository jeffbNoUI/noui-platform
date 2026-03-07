# NoUI DERP POC — Build History

## Purpose
This file tracks every significant decision, file created, issue encountered, and resolution made during the POC build. Use this to backtrack if anything goes wrong.

---

## Build Day 1 — February 18, 2026

### Session 1: Project Initialization

**Decision Log:**

1. **Project Structure:** Following the architecture designed in the planning sessions. Four-layer platform (Data Connector → Business Intelligence → Relevance Engine → Dynamic Workspace) built as containerized services on local Kubernetes.

2. **Technology Stack:** PostgreSQL, Go backend, React + TypeScript + Tailwind + shadcn/ui frontend, Claude API for AI features, Kubernetes + Helm infrastructure, Go test + Vitest for testing.

3. **Target:** DERP (Denver Employees Retirement Plan) — 3-tier municipal pension plan serving ~28,800 members. See CLAUDE.md for full plan provisions and tier details.

4. **Four Demo Cases:** See demo-cases/ for complete hand calculations and test fixtures.
   - Case 1: Robert Martinez — Tier 1, Rule of 75, leave payout
   - Case 2: Jennifer Kim — Tier 2, purchased service, early retirement with 30% reduction (3%/yr)
   - Case 3: David Washington — Tier 3, early retirement with 12% reduction
   - Case 4: Robert Martinez variant — Case 1 with DRO (40% of marital share)

### Files Created:

| File | Purpose | Status |
|------|---------|--------|
| BUILD_HISTORY.md | This file — tracks all decisions and changes | Active |

### Issues Encountered:
(none yet)

### Backtrack Points:
- **BT-001:** Project initialization. Clean slate. Return here to start completely over.

---

### Session 2: Architecture Decisions and Governing Principles

**Decision Log:**

5. **DECISION: Governing Principles Document Created**
   Created noui-architecture-decisions.docx as the binding governing document. Five core principles established in priority order: Separation of Concerns (AI vs. deterministic computation), Trust Progression (four phases), Rules Governance SDLC, Source of Truth (governing documents only), and Auditability.

6. **DECISION: AI Does Not Execute Business Rules (ADR-001)**
   All business rules, benefit calculations, eligibility determinations, and financial computations are implemented as deterministic code executing version-controlled, human-certified rule configurations. AI is architecturally prohibited from the calculation path. If AI is unavailable, every calculation still works.

7. **DECISION: Trust Progression Has Four Phases (ADR-001 context)**
   Four phases defined: Transparent → Verified → Supervised Automation → Autonomous for Routine. Each phase requires demonstrated accuracy before advancing. The system earns trust by showing its work, not by automating approvals.

8. **DECISION: Rules Governance SDLC Required (ADR-002)**
   All rule changes follow a full SDLC: AI drafts → human reviews → system generates tests → tests execute → human certifies → controlled deployment. AI self-builds and self-tests, but humans validate results and authorize promotion to production. No rule reaches production without human approval.

9. **DECISION: AI Learns Orchestration, Not Rules (ADR-003)**
   AI learns from transaction history how work gets done (task patterns, data access sequences, workflow flows). AI does not derive business rules from transaction patterns. Rules come from governing documents only. Transaction history is a validation oracle, not a rule source.

10. **DECISION: "Self-Healing" Terminology Retired (ADR-004)**
    Replace all references to "self-healing tests" with "AI-accelerated change management." Test failures are defects to investigate, never auto-resolve. The system prepares complete change packages for human review; it does not silently accept changes.

11. **DECISION: Data Quality Findings Require Human Resolution (ADR-005)**
    In Phase 1, no data quality issue is auto-resolved. All findings surfaced and presented for human resolution. Resolution categories: proposed correction (awaiting review), requires research, requires agency decision. Remove "auto-resolvable" from all documentation.

12. **DECISION: POC Is Exclusively Phase 1 — Transparent (ADR-006)**
    Every output is presented for human verification. Demo narrative emphasizes "here is exactly what the system did, check its work" rather than "the system handles this automatically." Future phases described as roadmap, not current capability.

13. **DECISION: Integration Testing Moved Earlier**
    Begin integration test harness on Day 4-5 when first two services are running. Continuous integration from Day 5 forward. Do not wait until Day 11 for integration testing.

### Files Created:

| File | Purpose | Status |
|------|---------|--------|
| noui-architecture-decisions.docx | Governing principles and architecture decision records (ADR-001 through ADR-006) | Active — Governing Document |
| ARCHITECTURE_REFERENCE.md | Updated with AI boundaries, rules governance, terminology corrections | Active |
| CLAUDE.md | Updated with governing principles, controlled terminology, AI boundary rules | Active |
| BUILD_PLAN.md | Updated with earlier integration testing, Phase 1 language, terminology corrections | Active |
| BUILD_HISTORY.md | Updated with this session's decisions | Active |

### Backtrack Points:
- **BT-001:** Project initialization. Clean slate. Return here to start completely over.
- **BT-002:** Architecture principles established. All governing documents created. Return here to restart build with principles intact but no code yet.

---

## Build Day 2 — February 19, 2026

### Session 3: Graceful Degradation Architecture

**Decision Log:**

14. **DECISION: Six-Level Degradation Hierarchy (ADR-007)**
    Created ADR-007 defining Level 0 (Normal) through Level 5 (Complete Outage) with trigger conditions, system behaviors, and staff-visible indicators. Three architectural requirements: static fallback workspaces, orchestration state persistence, and health check cascading with staff-visible indicators.

15. **DECISION: AI Data Governance Policy Created**
    Created noui-ai-data-governance-policy.docx establishing five data classification levels (Restricted, Confidential, Sensitive, Internal, Public) with specific rules for what data AI services may access. Foundational principle: "AI never touches the money."

### Files Created:

| File | Purpose | Status |
|------|---------|--------|
| ADR-007-Graceful-Degradation-and-Disaster-Recovery.docx | Six-level degradation hierarchy, failure mode analysis, POC implementation requirements | Active |
| noui-ai-data-governance-policy.docx | Data classification, AI data flow governance, trust progression governance | Active |

### Issues Encountered:
(none new)

---

## Build Day 2 — February 20, 2026

### Session 4: Document Cleanup Audit

**Decision Log:**

16. **DECISION: Document Cleanup Required**
    Comprehensive audit of all project documents found terminology violations (ADR-004), inconsistencies between documents, and outdated content. Updated: ARCHITECTURE_REFERENCE.md, CLAUDE.md, BUILD_PLAN.md, BUILD_HISTORY.md.

### Files Updated:

| File | Changes | Status |
|------|---------|--------|
| ARCHITECTURE_REFERENCE.md | Removed legacy "Self-Healing Testing" section; fixed "Auto-resolvable" to "Proposed correction (awaiting review)"; fixed LeavePayoutCalculator typo; added ADR-007 six-level degradation hierarchy; added Governing Document reference and AI Role Boundaries table | Active |
| CLAUDE.md | Merged Session 2 updates: added Governing Principles (1-4), Controlled Terminology section, Principle 4 Source of Truth; added step 4 to development workflow | Active |
| BUILD_PLAN.md | Added Governing Principles Reminder; added Phase 1 language to Days 9-10; added AI-Accelerated Change Management Demo Preparation; added controlled terminology review to Day 14; fixed LeavePayoutCalculator typo | Active |
| BUILD_HISTORY.md | Trimmed duplicated plan summary to references; added Session 2, 3, and 4 decisions that were missing from file | Active |

---

### Session 5: Project Knowledge Audit and Issue Resolution

**Decision Log:**

17. **DECISION: Standardize J&S Placeholder Factors**
    Established consistent placeholder actuarial factors across all demo cases. Factors are based on standard actuarial principles for member/beneficiary age differences. All cases now use the same factor table. Test fixtures updated to match.

    | Option | Factor | Notes |
    |--------|--------|-------|
    | Maximum (Single Life) | 1.0000 | Baseline |
    | 100% J&S | 0.8850 | Younger beneficiary = larger reduction |
    | 75% J&S | 0.9150 | — |
    | 50% J&S | 0.9450 | Smallest survivor benefit = smallest reduction |

    These factors assume member age ~63, beneficiary age ~60. Actual factors depend on specific ages and DERP actuarial tables.

18. **DECISION: Early Retirement Reduction Uses Completed Years**
    For POC purposes, early retirement reduction uses completed years under age 65, not monthly proration. This is the more conservative interpretation and matches most pension plan practices. Example: age 63 years 11 months = 2 years under 65 = 12% reduction. Document this assumption in demo materials; verify with DERP practice before production.

19. **DECISION: Payment Options Explicitly Scoped as Illustrative**
    All payment option calculations in demo cases use placeholder actuarial factors and are explicitly labeled as "ILLUSTRATIVE — ACTUAL FACTORS FROM DERP ACTUARIAL TABLES." Demo materials must include this disclaimer. This does not affect benefit formula accuracy (AMS, multiplier, reduction) — only J&S option amounts.

20. **DECISION: Business Plan Terminology Updated**
    Updated NoUI_Business_Plan to replace all "self-healing" references with "AI-accelerated change management" per ADR-004. Replaced "generates its own business rules" with "drafts rule configurations for human certification" per ADR-001.

21. **DECISION: Rounding Strategy Documented**
    Established rounding strategy for benefit calculations:
    - Carry full precision through all intermediate calculations
    - Round only the final monthly benefit amount to cents (2 decimal places)
    - Use banker's rounding (round half to even) for consistency
    - AMS and intermediate formula results: full precision
    - J&S factors: 4 decimal places
    - Final monthly benefit: round to cents as last step

### Files Updated:

| File | Changes | Status |
|------|---------|--------|
| BUILD_HISTORY.md | Added Session 5, documented decisions 17-21 | Active |
| case1-robert-martinez-test-fixture.json | Added illustrative disclaimer, rounding strategy, standardized structure | Active |
| case2-jennifer-kim-test-fixture.json | Added reduction method note, purchased service demonstration section | Active |
| case3-david-washington-test-fixture.json | Updated J&S factors to standardized table (50% J&S: 0.9350 → 0.9450) | Active |
| case4-robert-dro-test-fixture.json | Updated J&S factors to standardized table, added DRO test points | Active |
| NoUI_Business_Plan_Rev3_Premium.docx | Terminology corrections per ADR-001/ADR-004; now Rev 4 | Active |

### Backtrack Points:
- **BT-001:** Project initialization. Clean slate. Return here to start completely over.
- **BT-002:** Architecture principles established. All governing documents created. Return here to restart build with principles intact but no code yet.
- **BT-003:** All issues resolved. Project knowledge complete and consistent. Return here to restart Day 1 build tasks with clean documentation foundation.

---

## Pre-Build Session: Rule Verification and Scope Decisions — February 21, 2026

### Session: Research Verification and Correction

**Critical Finding — CRITICAL-001: Early Retirement Reduction Rate**

Research against DERP's public sources revealed that the early retirement reduction rate for Tiers 1 and 2 is 3% per year under age 65, NOT 6% as stated in all project documents. Tier 3 correctly uses 6%.

**Sources verified (all consistent):**
- DERP Active Member Handbook (Revised January 2024), p.17
- DERP Pension Benefit web page
- DERP FAQ, p.43

**Impact:** Case 2 (Jennifer Kim) monthly benefit increases from $933.18 to $1,633.07. Demo narrative shifts from "shocking 60% penalty" to "meaningful 30% penalty with threshold proximity detection."

Full verification history and recalculation in CRITICAL-001-resolution.md.

**Decision Log:**

22. **DECISION: CRITICAL-001 — Early Retirement Reduction Rates Corrected**
    Tiers 1 & 2: 3% per year under age 65 (was incorrectly 6%)
    Tier 3: 6% per year under age 65 (was already correct)
    Verified against three independent DERP-published sources. RMC direct text verification pending (§18-408 not accessible via web fetch) but probability of error in all three member-facing sources is effectively zero.
    All project files updated to reflect corrected rates.

23. **DECISION: Lump-Sum Death Benefit — INCLUDED in POC Scope**
    The lump-sum death benefit is part of the DERP retirement application (Part C, irrevocable election). Including it demonstrates the system handles the complete application workflow.
    Rules added:
    - RULE-DEATH-BENEFIT-NORMAL: $5,000 for normal/Rule of 75/85 retirement
    - RULE-DEATH-BENEFIT-EARLY-T12: $5,000 minus $250 per completed year under 65
    - RULE-DEATH-BENEFIT-EARLY-T3: $5,000 minus $500 per completed year under 65
    - RULE-DEATH-BENEFIT-ELECTION: Irrevocable choice of 50 or 100 monthly installments
    Workspace component: DeathBenefitElection in Stage 4 (Election and Certification).

24. **DECISION: Retirement Application Timing Rules — FULL ENFORCEMENT**
    Three timing rules modeled with validation errors (not just warnings):
    - RULE-APPLICATION-DEADLINE: Application within 30 calendar days of last day worked. Violation blocks progression past intake.
    - RULE-NOTARIZATION-REQUIRED: Notarized signature required before advancing past Stage 1.
    - RULE-PAYMENT-PROCESSING-CUTOFF: Complete package by 15th of month prior to effective date → first payment on time. After 15th → combined first/second payment following month.
    All four demo cases assigned clean timelines (all pass all rules). Edge case scenarios deferred to future iteration.

25. **DECISION: Social Security Make-Up Benefit — OUT OF SCOPE**
    Acknowledged as a real DERP benefit (Tier 1/2, born 1938+, age 62+). Not calculated in POC. Placeholder rule RULE-SS-MAKEUP added with status: placeholder. Retirement application intake stage still notes the benefit exists. Case 1 (Robert Martinez) marked as potentially eligible.

26. **DECISION: Employer Contribution Rate Updated**
    DERP Handbook (Jan 2024) states 17.95% employer contribution. Previous project documents stated 11% (a historical rate). CLAUDE.md updated. Seed data generator should use era-appropriate rates: ~11% for pre-2012 hire dates, scaling to 17.95% for current.

27. **DECISION: Demo Case Application Timelines Assigned**
    All four cases assigned specific dates for notification, application receipt, notarization, package completion, and first payment. All cases pass all timing rules cleanly.
    
    | Case | Last Day | App Received | Before 15th? | First Payment |
    |------|----------|--------------|--------------|---------------|
    | 1 — Robert | Mar 31 | Mar 10 | Mar 10 < Mar 15 ✓ | Apr 1 |
    | 2 — Jennifer | Apr 30 | Apr 8 | Apr 8 < Apr 15 ✓ | May 1 |
    | 3 — David | Mar 31 | Mar 12 | Mar 12 < Mar 15 ✓ | Apr 1 |
    | 4 — Robert+DRO | Mar 31 | Mar 10 | Mar 10 < Mar 15 ✓ | Apr 1 |

### Files Updated:

| File | Changes | Status |
|------|---------|--------|
| case2-jennifer-kim-calculation.md | Full rewrite: 3% rate, $1,633.07 benefit, death benefit, timeline, revised scenarios | Active |
| case1-robert-martinez-test-fixture.json | Added timeline, death benefit ($5,000), SS makeup placeholder, timing test points | Active |
| case2-jennifer-kim-test-fixture.json | Corrected reduction (30%), added timeline, death benefit ($2,500), timing test points | Active |
| case3-david-washington-test-fixture.json | Added timeline, death benefit ($4,000), Tier 3 distinction notes, timing test points | Active |
| case4-robert-dro-test-fixture.json | Added timeline, death benefit ($5,000), SS makeup placeholder, timing test points | Active |
| CLAUDE.md | Corrected quick reference table (3%/3%/6%), employer rate 17.95%, added death benefit row | Active |
| BUILD_HISTORY.md | This session — decisions 22-27 | Active |
| CRITICAL-001-resolution.md | Full verification history and recalculation | Reference |
| noui-derp-service-retirement-process.md | Already created with verified rates (no changes needed) | Active |

### Backtrack Points:
- **BT-001:** Project initialization. Clean slate. Return here to start completely over.
- **BT-002:** Architecture principles established. All governing documents created. Return here to restart build with principles intact but no code yet.
- **BT-003:** All original issues resolved. Project knowledge complete and consistent (but with incorrect 6% rate). Superseded by BT-004.
- **BT-004:** All corrections applied. CRITICAL-001 resolved. Scope decisions made. Process definition complete. Return here to restart Day 1 build tasks with verified documentation foundation.

---

## Open Items

| Item | Description | Priority | Next Step |
|------|-------------|----------|-----------|
| Actuarial Tables | Obtain actual DERP J&S factors | Low (POC) | Request from DERP or use illustrative disclaimer |
| RMC Direct Verification | Verify 3%/6% against §18-408 text | Low | Three DERP sources already agree; verify during engagement |
| Employer Rate History | Era-appropriate rates for seed data | Medium | Use ~11% pre-2012, scale to 17.95% current |
| Timing Edge Cases | Demo a late-filing or post-15th scenario | Low | Future iteration — all current cases pass cleanly |

---

## Ready for Day 1 Build Tasks

All prerequisite documentation is complete, verified, and consistent. Corrections applied per CRITICAL-001. Scope decisions finalized. Proceed to BUILD_PLAN.md Day 1:
- Step 1.1: Legacy Database Schema
- Step 1.2: Data Generation Script (note: update EMPLOYER_CONTRIB_RATE)
- Step 1.3: Four Demo Case Members
- Step 1.4: Deliberate Data Quality Issues
- Step 1.5: Verification
