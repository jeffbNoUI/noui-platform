# NoUI DERP POC — Build Plan

## Overview
15 working days to a demo-ready proof of concept. Each day has specific deliverables and verification criteria. Do not proceed to the next day's work until the current day's verification passes.

### Governing Principles Reminder
This build plan is governed by the Architecture Decisions & Governing Principles document. Key constraints:
- AI does not execute business rules — all calculations are deterministic code
- All rule definitions follow a governed SDLC — no rule reaches production without human approval
- POC operates in Phase 1 (Transparent) — every output presented for human verification
- Data quality findings require human resolution — no auto-resolve in Phase 1
- "Self-healing" terminology is retired — use "AI-accelerated change management"

---

## Day 1: Database Schema and Seed Data

### Step 1.1: Legacy Database Schema
Create database/schema/001_legacy_schema.sql with these tables:
- DEPARTMENT_REF — department reference data (~30 Denver city departments)
- POSITION_REF — position/classification reference data (~50 positions)
- MEMBER_MASTER — core member table with demographics, status, tier, dates
- EMPLOYMENT_HIST — employment events (hire, transfer, promotion, separation, rehire)
- SALARY_HIST — per-pay-period salary records (biweekly, pensionable pay, OT, leave payout, furlough)
- CONTRIBUTION_HIST — member/employer contribution records with running balance
- BENEFICIARY — beneficiary designations with superseding logic
- SVC_CREDIT — service credit records by type (employment, purchased, military, leave)
- DRO_MASTER — domestic relations orders
- BENEFIT_PAYMENT — active benefit payments for retirees
- CASE_HIST — work item/case tracking
- TRANSACTION_LOG — audit log (with deliberately inconsistent formats across eras)

Design the schema to be deliberately messy like a real legacy system:
- Inconsistent naming (some fields abbreviated, some not)
- Redundant data between SALARY_HIST and CONTRIBUTION_HIST
- Nullable fields that shouldn't be nullable
- Status codes that are overloaded
- Missing foreign keys in places
- Fields added over time with different conventions

### Step 1.2: Data Generation Script
Create database/seed/generate_derp_data.py that generates:
- 10,000 members distributed across tiers (Tier 1: ~1,200, Tier 2: ~1,500, Tier 3: ~2,300 active; plus ~3,800 retired, ~800 deferred, ~400 terminated)
- Realistic Denver city departments and positions
- Complete salary histories (biweekly pay periods from hire to present/termination)
- Salary growth: 2-4% annual with occasional promotion bumps of 8-15%
- Starting salaries: $35,000-$75,000 based on position and era
- Contribution records at 8.45% employee, 11% employer
- Employment histories with transfers, promotions, some gaps
- Beneficiary designations (at least one per member, some with history)
- ~200 members with purchased service credit (1-5 years)
- ~300 members with DRO records
- ~3,800 retired members with BENEFIT_PAYMENT records calculated from actual data
- ~25,000 historical cases across 15 years

### Step 1.3: The Four Demo Case Members
Create the four specific members in the generator with EXACT data matching demo-cases/ specifications. These members must be identifiable and their data must produce the exact expected calculations.

### Step 1.4: Deliberate Data Quality Issues
Embed these specific problems:
- 12 members with STATUS_CD = 'A' but TERM_DATE populated
- 8 members with salary gaps (missing pay periods)
- 3 members with contribution balance mismatches (rounding errors)
- 5 beneficiary records where allocations don't total 100%
- 2 retired members with incorrect BENEFIT_PAYMENT amounts
- 15 members near tier boundaries with potentially wrong TIER_CD

### Step 1.5: Verification
- Deploy to PostgreSQL on local Kubernetes
- Run seed script
- Query each demo case member and verify data looks correct
- Run basic counts: member count by status, by tier, salary record count, etc.
- Document in BUILD_HISTORY.md

---

## Day 2: DERP Rule Definitions

### Step 2.1: Rule Definition Format
Create rules/definitions/schema.yaml defining the YAML structure for rules:
- rule_id, rule_name, category, description
- tier_applicability (which tiers this rule applies to)
- conditions (structured condition expressions)
- formula (for calculation rules)
- source_reference (governing document section)
- effective_date, end_date (for versioned rules)
- test_cases (inline basic test expectations)
- version, certified_by, certified_date (governance tracking)

### Step 2.2: Membership and Contribution Rules
Create rules/definitions/membership.yaml:
- Tier determination by hire date (3 rules)
- Automatic enrollment on first day of eligible employment
- Employee contribution rate: 8.45%
- Employer contribution rate: 11%
- Pretax treatment

### Step 2.3: Vesting and Eligibility Rules
Create rules/definitions/eligibility.yaml:
- Vesting: 5 years of service credit
- Normal retirement: age 65, 5 years service (all tiers)
- Rule of 75: age + service ≥ 75, min age 55 (Tiers 1, 2)
- Rule of 85: age + service ≥ 85, min age 60 (Tier 3)
- Early retirement Tiers 1/2: age 55, 5 years service
- Early retirement Tier 3: age 60, 5 years service
- Disability eligibility (basic definition for completeness)
- Deferred retirement eligibility

### Step 2.4: Benefit Calculation Rules
Create rules/definitions/benefit-calculation.yaml:
- Tier 1 formula: AMS(36) × 2.0% × service years
- Tier 2 formula: AMS(36) × 1.5% × service years
- Tier 3 formula: AMS(60) × 1.5% × service years
- AMS calculation: highest N consecutive months of pensionable compensation
- Leave payout inclusion: for members hired before Jan 1, 2010, add payout to final month salary
- Furlough day impact and purchase
- Early retirement reduction: 6% per year under age 65
- Rule of 75/85 exemption from reduction
- Benefit maximum (if any — verify from source docs)

### Step 2.5: Payment and Survivor Rules
Create rules/definitions/payment-options.yaml:
- Maximum single life benefit
- 100% Joint & Survivor (actuarial reduction)
- 75% Joint & Survivor (actuarial reduction)
- 50% Joint & Survivor (actuarial reduction)
- Spousal consent requirement for married members

### Step 2.6: Service Purchase Rules
Create rules/definitions/service-purchase.yaml:
- Eligibility for purchase types (military, leave of absence, prior service)
- Actuarial cost method
- Irrevocable and non-refundable
- CRITICAL: Counts for benefit calculation ONLY — excluded from Rule of 75/85 and IPR

### Step 2.7: DRO, Refund, IPR Rules
Create rules/definitions/dro.yaml, refund.yaml, ipr.yaml:
- DRO division methods (percentage, amount)
- Marital share calculation: (service during marriage / total service) × benefit
- Refund: non-vested, contributions + interest, 90-day wait
- IPR: $6.25/yr (Medicare), $12.50/yr (non-Medicare)

### Step 2.8: Verification
- Review every rule against the DERP source documents
- Ensure every rule has a source_reference
- Verify the four demo cases can be computed from these rules
- Document in BUILD_HISTORY.md

---

## Day 3: Hand Calculations for Demo Cases

### Step 3.1-3.4: One file per demo case
Create demo-cases/case1-robert-martinez/calculation.md through case4-robert-dro/calculation.md

Each file must contain:
- Every input value with its source
- Step-by-step calculation showing every intermediate result
- Final results to the penny for: gross benefit, reduction (if any), net benefit, all four payment options, DRO split (Case 4), IPR amount
- Scenario comparison calculations
- This is the Phase 1 (Transparent) requirement — the system says "here is exactly what I did, check my work."

### Step 3.5: Test Fixture Files
Create demo-cases/case{N}/test-fixture.json for each case with structured inputs and expected outputs for automated testing.

### Step 3.6: Verification
- Peer review every calculation against the rule definitions
- Cross-check the four cases cover all tier-specific provisions
- Document in BUILD_HISTORY.md

---

## Days 4-5: Backend Services (Connector + Intelligence)

### Day 4: Data Connector Service

### Step 4.1: Service Scaffold
Create services/connector/ with Go project structure:
- main.go with HTTP server, health check, graceful shutdown
- Dockerfile (multi-stage, distroless base)
- Helm values for the connector deployment

### Step 4.2: Member API
GET /api/v1/members/{id}
- Query MEMBER_MASTER, join with current EMPLOYMENT_HIST
- Map legacy schema to domain model
- Return: member profile with current employment info

### Step 4.3: Employment History API
GET /api/v1/members/{id}/employment
- Query EMPLOYMENT_HIST ordered by effective date
- Include service credit calculation (earned, purchased, military)
- Return: employment timeline with service credit breakdown

### Step 4.4: Salary History + AMS API
GET /api/v1/members/{id}/salary
- Query SALARY_HIST with optional date range
- Calculate AMS: sliding window over N consecutive months (36 or 60 based on tier)
- Handle leave payout inclusion in final month
- Return: salary records, AMS calculation with window details

### Step 4.5: Supporting APIs
- GET /api/v1/members/{id}/beneficiaries
- GET /api/v1/members/{id}/dro
- GET /api/v1/members/{id}/contributions
- GET /api/v1/members/{id}/service-credit

### Step 4.6: Integration Test Harness
Begin integration testing infrastructure — tests that exercise the connector against the seeded database. This runs continuously from now on.

### Step 4.7: Verification
- Query all four demo case members through the API
- Verify AMS calculations match hand calculations for each case
- Document in BUILD_HISTORY.md

### Day 5: Intelligence Service

### Step 5.1: Service Scaffold
Create services/intelligence/ with Go project structure (same pattern as connector).

### Step 5.2: Rule Loader
- Parse YAML rule definitions at startup
- Validate: every rule has required fields, formulas parse, tier applicability is valid
- Rules are immutable after load (no runtime modification)

### Step 5.3: Eligibility Evaluator
POST /api/v1/eligibility/evaluate
- Accept member ID and optional retirement date
- Fetch member data from connector service
- Evaluate every eligibility rule
- Return: list of retirement types with eligible/not-eligible status, conditions met/unmet, projected eligibility date for unmet rules

### Step 5.4: Benefit Calculator
POST /api/v1/benefit/calculate
- Accept member ID and retirement date
- Determine tier from hire date
- Fetch salary history, calculate AMS (calling connector's AMS endpoint)
- Calculate total service credit (earned + purchased for benefit formula)
- Apply tier-specific formula
- Apply early retirement reduction if applicable (and check Rule of 75/85 exemption)
- Handle leave payout inclusion for pre-2010 hires
- Return: complete calculation worksheet with every input, formula, intermediate result, and final benefit

### Step 5.5: Payment Options Calculator
POST /api/v1/benefit/options
- Accept member ID, retirement date, beneficiary DOB (for J&S calculations)
- Calculate maximum benefit
- Apply J&S reduction factors for 100%, 75%, 50% options
- Handle spousal consent flag
- If DRO present, apply DRO split BEFORE option reduction
- Return: all four option amounts with reduction factors

### Step 5.6: Scenario Calculator
POST /api/v1/benefit/scenario
- Accept member ID and array of retirement dates
- Run full calculation for each date
- Return: comparison array showing benefit at each date, eligibility status, reduction applied

### Step 5.7: DRO Calculator
POST /api/v1/dro/calculate
- Accept member ID
- Fetch DRO records and benefit calculation
- Calculate marital fraction: service during marriage / total service
- Calculate marital share and alternate payee amount
- Return: complete DRO impact breakdown

### Step 5.8: Verification
- Run all four demo cases through every endpoint
- Compare every result against hand calculations
- ALL FOUR CASES MUST MATCH EXACTLY before proceeding
- Document in BUILD_HISTORY.md

---

## Days 6-8: Frontend Components and Workspace

### Day 6: Foundation + Core Components
- React project setup with TypeScript, Vite, Tailwind, shadcn/ui
- Application shell with workspace layout
- MemberBanner component
- AlertBar component
- EmploymentTimeline component
- SalaryTable component (supporting both 36 and 60 month highlighting)

### Day 7: Calculation + Analysis Components
- BenefitCalculationPanel (centerpiece — shows full formula and calculation)
- PaymentOptionsComparison (side-by-side four options)
- ScenarioModeler (interactive retirement date comparison)
- DROImpactPanel
- ServiceCreditSummary (with purchased service distinction)
- LeavePayoutCalculator
- EarlyRetirementReductionCalculator
- IPRCalculator

### Day 8: Workspace Composition + Integration
- Workspace composition engine (Tier 1 deterministic + Tier 2 rule-based)
- Wire all components to backend APIs
- Verify all four demo cases render correctly with right components
- Verify WRONG components don't appear (no leave payout for Tier 3, no DRO for non-DRO cases)
- AI (Tier 3) composition is optional — system must be fully functional without it

---

## Days 9-10: Data Quality + Operational Learning

### Day 9: Data Quality Engine
- Structural checks (contradictory status, allocation errors, balance mismatches)
- Calculation verification (re-run retired member benefits and compare to BENEFIT_PAYMENT)
- Data quality dashboard UI showing findings classified by severity
- All findings presented for human review — proposed corrections with supporting evidence, not auto-resolution
- Resolution workflow: proposed correction (awaiting review), requires research, requires agency decision
- Verify engine finds all embedded problems from Step 1.4

### Day 10: Operational Pattern Analysis
- Processing time analysis by case type and tier
- Exception frequency analysis
- Workflow pattern detection (task sequences, data access patterns)
- Analysis dashboard UI
- Insights inform orchestration and workspace composition only — not business rules
- All operational patterns presented as observations for human review

---

## Days 11-12: Testing and Validation

### Day 11: Comprehensive Test Suite
- Calculation tests for every rule across all tiers (generated from certified rule definitions)
- Boundary tests (exactly at Rule of 75/85 threshold, one below, one above)
- Integration tests (full API chain — extending tests begun on Days 4-5)
- Demo case acceptance tests (all four must pass)
- Each test documents: inputs, applicable rule, expected output, source reference

### Day 12: Edge Case Testing
- Tier boundary members (hired exactly on September 1, 2004)
- Exactly meeting Rule of 75/85
- Highest AMS window not being the most recent months
- Rehired members with broken service
- Zero-service-purchase benefit vs. with-purchase comparison

### AI-Accelerated Change Management Demo Preparation
Prepare a static demonstration of the rules change workflow:
- Example: contribution rate change from 8.45% to 9%
- Show: AI identifies affected rules, drafts proposed changes, generates test cases
- Show: test results package ready for human review
- This is a prepared scenario, not a live AI interaction during demo

---

## Days 13-15: Polish and Demo Prep

### Day 13: Visual Polish
- Consistent design system across all components
- Loading states, transitions, animations
- Print styling for calculation worksheets
- Ensure all calculation displays show full transparency (Phase 1 requirement)

### Day 14: Demo Environment
- Deploy demo namespace with frozen data
- Run verification job — all cases correct
- Cache AI responses for demo cases (Tier 3 composition)
- Full walkthrough timing and flow
- Review all demo language against controlled terminology (no "self-healing," no "auto-resolved," no "AI calculated")

### Day 15: Rehearsal
- Complete demo run
- Prepare for anticipated questions (especially: "does the AI calculate benefits?" — answer: NO)
- Supporting materials (one-pager, architecture overview)
- Verify fallback plan if AI service or infrastructure has issues during demo
