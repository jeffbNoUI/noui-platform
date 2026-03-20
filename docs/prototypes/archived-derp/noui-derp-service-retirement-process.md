# NoUI DERP POC — Service Retirement Process Definition

## Document Purpose

This document defines the Service Retirement process for the NoUI DERP POC, derived from DERP's actual published procedures and governing documents. It serves three functions:

1. **Discrepancy Report** — Critical differences found between our project documents and DERP's published materials
2. **Process Definition** — Formal stages, entry/exit criteria, required data, and applicable rules
3. **Capability Contracts** — Reusable capability definitions for Eligibility Determination and Benefit Calculation that can be invoked from multiple contexts (task workspace, member hub, scenario modeler)

**Sources Researched:**
- DERP Active Member Handbook (Revised January 2024)
- DERP "Ready to Retire" web page (derp.org/active-members/ready-to-retire/)
- DERP Retirement Application form (Revised 06/10/2025, 4 pages)
- DERP Retirement Checklist — "Five Steps to Ensure a Smooth Transition" (06/17/2025)
- DERP Pension Benefit page (derp.org/benefits/derp-pension-benefit/)
- DERP Plus Benefits page (derp.org/benefits/derp-plus-benefits/)
- DERP Pension Benefit Payment page (derp.org/retired-members/derp-pension-benefit-payment/)

---

## SECTION 1: Critical Discrepancies

These findings MUST be resolved before Day 1 of the build. Each represents a difference between our project documents and DERP's published, authoritative materials.

### CRITICAL-001: Early Retirement Reduction Rate — Tiers 1 & 2

**Our Documents Say:** 6% per year under age 65 for ALL tiers

**DERP Actually Says:** 
- Tiers 1 & 2: **3% per year** for each year under age 65 (maximum 30% reduction at age 55)
- Tier 3: **6% per year** for each year under age 65 (maximum 30% reduction at age 60)

**Sources:**
- Active Member Handbook, p.17: "DERP Pension Benefit is reduced by 3% per year for each year under age 65" (Tiers 1 & 2)
- Active Member Handbook, p.43 FAQ: "reduced by 3% for each year you are under age 65 (30% reduction at age 55)"
- DERP Pension Benefit web page, Early Retirement section: "reduced by 3% per year for each year under age 65" (Tiers 1 & 2)
- DERP Pension Benefit web page: "reduced by 6% per year for each year under age 65" (Tier 3 only)

**Impact:** This affects Case 2 (Jennifer Kim) directly. She is Tier 2, age 55, 10 years under 65. Under our current 6% rate, her reduction is 60%. Under the correct 3% rate, her reduction would be 30%. This is an enormous difference — approximately doubling her early retirement benefit. All four hand calculations, test fixtures, the CLAUDE.md quick reference table, and the system prompt tier summary need to be corrected.

**Note:** We should verify this against the Revised Municipal Code (RMC §18-401 through §18-430.7) as the ultimate governing authority. The handbook is member-facing and could itself contain a simplification. However, EVERY DERP source we found is internally consistent at 3%/6%, so this is very likely correct.

**Resolution Required:**
- [ ] Verify against Denver Revised Municipal Code
- [ ] Update CLAUDE.md quick reference table
- [ ] Update system prompt DERP plan provisions
- [ ] Recalculate Case 2 (Jennifer Kim) — the "dramatic early retirement penalty" demo narrative changes significantly at 30% vs 60%
- [ ] Recalculate Case 3 (David Washington) — he is Tier 3, so 6% is correct, but verify the calculation
- [ ] Update all test fixture files
- [ ] Update BUILD_PLAN.md rule definitions for eligibility.yaml

### CRITICAL-002: Employer Contribution Rate

**Our Documents Say:** 11% of payroll

**DERP Actually Says:** 
- Active Member Handbook, p.9: "Employer contributions - 17.95% of payroll"
- DERP website benefits page mentions only the 8.45% employee rate without stating the employer rate explicitly

**Impact:** The employer contribution rate does not directly affect benefit calculations (benefits are formula-based). However, it appears in our business plan documentation, seed data generator (CONTRIBUTION_HIST records), and the system prompt. The 11% may have been an earlier rate — Denver has increased employer contributions over the years. The handbook (Revised January 2024) is the most recent source.

**Resolution Required:**
- [ ] Verify current employer contribution rate (17.95% per handbook)
- [ ] Update generate_derp_data.py EMPLOYER_CONTRIB_RATE constant
- [ ] Update system prompt and CLAUDE.md if referenced
- [ ] Note: Contribution history records in seed data should use era-appropriate rates if possible (the rate has changed over time)

### IMPORTANT-001: Social Security Make-Up Benefit — Missing From Project

**DERP Says:** Tier 1 and 2 members born 1938 or later receive a Social Security Make-Up benefit starting at age 62 or retirement date, whichever is later. The benefit compensates for the Social Security full retirement age extending beyond 65. Calculation is based on a percentage of estimated primary Social Security benefit × (service credit years with SS contributions / 35). Discontinued for Tier 3 members.

**Our Documents:** This benefit is not mentioned anywhere in our project documentation.

**Impact:** For the POC, this is a secondary benefit that adds complexity. However, it appears on the retirement application form (Part A requires Social Security Estimate or Award Letter for Tier 1/2 members age 62+). It's referenced in the document checklist. Case 1 (Robert Martinez, Tier 1, age 63) would potentially be eligible for this benefit.

**Resolution Required:**
- [ ] Decide: Include in POC scope or explicitly note as out-of-scope?
- [ ] Recommendation: Note as out-of-scope for POC but add to the rules engine as a placeholder/future rule. The retirement application data collection step should still collect the SS Estimate for completeness.

### IMPORTANT-002: Lump-Sum Death Benefit — Missing From Process Definition

**DERP Says:** Members retiring from active service are eligible for a lump-sum death benefit. The retirement application (Part C) requires the member to make irrevocable decisions about this benefit:
- Normal/Rule of 75/Rule of 85 retirement: $5,000
- Early retirement Tiers 1 & 2: $2,500 at age 55, reduced by $250 per year under 65
- Early retirement Tier 3: $2,500 at age 60, reduced by $500 per year under 65
- Member chooses: draw in 50 or 100 monthly installments during lifetime, or preserve for beneficiary
- Separate beneficiary designation for lump-sum death benefit (can differ from J&S beneficiary)

**Our Documents:** Not addressed in process definition or demo cases.

**Impact:** This is part of the actual retirement application form and is an irrevocable decision. Including it in the POC demonstrates the system handles the complete application, not just the pension calculation.

**Resolution Required:**
- [ ] Add lump-sum death benefit calculation rules
- [ ] Add to retirement application process stages
- [ ] Add to workspace composition (death benefit panel/step)
- [ ] Calculate lump-sum amounts for demo cases

### IMPORTANT-003: Retirement Application Requirements

**DERP Says:**
- Application must be **signed and notarized** (not just submitted)
- Must be received within **30 days** of last day worked or benefits deferred AND lump-sum death benefit forfeited
- Member must submit **notification of intent to retire** to supervisor, OHR, AND DERP
- If complete package received by **15th of month** prior to effective date → first payment on first business day of effective month; if after 15th → first and second payment combined the following month
- Retirement effective date is **first day of month following separation**

**Impact:** These timing rules and document requirements affect the process orchestrator's stage definitions and validation rules. The 30-day deadline and 15th-of-month processing cutoff are business rules that should be modeled.

### IMPORTANT-004: Retirement Application Contains More Than Benefit Election

The actual DERP Retirement Application form (4 pages) captures:
- Part A: Member Information (demographics, marital status certification)
- Part B: Benefit Option Election (Maximum or J&S with beneficiary designation)
- Part C: Lump-Sum Death Benefit Election
- Part D: Direct Deposit Information
- Part E: Income Tax Withholding Election (federal and Colorado state)
- Part F: Electronic Communication preferences
- Part G: Medical/Dental/Vision Insurance Participation (IPR eligibility)
- Part H: Re-employment Acknowledgment
- Part I: Member Confirmation (signature + notarization)

**Impact:** Our process definition needs to account for all of these sections, not just the benefit calculation and payment option. Several of these (tax withholding, insurance enrollment, direct deposit) are operational steps that a real pension admin system handles.

**Resolution Required:**
- [ ] For POC: Focus on Parts A, B, C, and G (benefit-related). Parts D, E, F, H are operational/administrative and can be simplified.
- [ ] The workspace should show that these additional steps exist even if they're simplified in the POC.

### INFORMATIONAL-001: Benefit Payment Timing Rule

**DERP Says:** The benefit is effective the first day of the month following separation. If the complete application is received by the 15th of the month before the effective date, the first payment arrives on the first business day of the effective month. If received after the 15th, the first and second payments are combined and paid the following month.

This is a nice operational rule to demonstrate in the POC — it shows the system can flag timing implications for both the member and the analyst.

### INFORMATIONAL-002: Counseling Session Is a Formal Step

DERP's process explicitly includes a one-on-one counseling session as Step 2 (before gathering documents). In the counseling session, DERP staff: estimates the benefit, reviews DERP Plus Benefits, discusses payment options, explains tax withholding, reviews health insurance options, and describes the retirement process. This maps perfectly to the Retirement Counselor role and the Scenario Modeler workspace variant.

### INFORMATIONAL-003: Document Requirements Checklist

Required documents beyond the application itself:
- Certified birth certificate or passport (member, spouse/beneficiary, insurance dependents)
- Decree of dissolution of marriage (if applicable)
- Marriage certificate or common law affidavit (if applicable)
- Medicare card or Medicare Entitlement Letter of Award (if applicable)
- Spousal Consent at Retirement form (if electing Maximum or J&S for non-spouse)
- Social Security Estimate or Award Letter (Tier 1 & 2 age 62+ only)
- Voided check or bank letter for direct deposit

---

## SECTION 2: DERP's Actual Retirement Process (Member Perspective)

DERP publishes a five-step process for members:

**Step 1 — Think About When You Want to Retire**
Member considers retirement timing. DERP advises separating at end of month to maximize service credit and AMS.

**Step 2 — Meet with DERP**
One-on-one counseling session (in-person, phone, or virtual) with a membership services representative. DERP estimates benefit, reviews options, explains insurance, describes process and deadlines.

**Step 3 — Submit Notification of Intent to Retire**
Written notification to supervisor, OHR/HR representative, AND DERP. Must state last day of employment and reason for separation is retirement. DERP responds with next steps and required documents.

**Step 4 — Gather Documents**
Collect all required documents per checklist (birth certificates, marriage/divorce documents, Medicare, Social Security, spousal consent).

**Step 5 — Submit Retirement Application**
Signed and notarized application plus all required documents submitted within 30 days of last day worked. Submission via email, fax, or mail.

---

## SECTION 3: Service Retirement Process Definition (System Perspective)

This defines the process as the NoUI system models it. The member-facing steps above map to internal processing stages. Stages are designed as bounded units with clean interfaces so the underlying capabilities (Eligibility Determination, Benefit Calculation) can be invoked independently.

### Process: Service Retirement

**Process ID:** PROC-SVC-RET  
**Applies To:** All tiers  
**Governing Authority:** RMC §18-401 through §18-430.7  
**POC Demo Cases:** Case 1 (Martinez), Case 2 (Kim), Case 3 (Washington), Case 4 (Martinez-DRO)

---

### Stage 1: Application Intake

**Stage ID:** SVC-RET-INTAKE  
**Purpose:** Receive and validate the retirement application package for completeness  
**Primary Role:** Benefits Analyst (processing) / CSR (initial receipt)

**Entry Criteria:**
- Notification of intent to retire received from member, supervisor, or OHR
- OR Retirement application received (may arrive before formal notification)
- Member exists in system with active or deferred-vested status

**Required Data (retrieved automatically from Data Connector):**
- Member demographics (MEMBER_MASTER)
- Current employment status and dates
- Marital status (from application — may differ from system records)
- Tier determination (computed from hire date)

**Required Documents (tracked for completeness):**
- Retirement Application (signed, notarized) — REQUIRED
- Certified birth certificate or passport (member) — REQUIRED
- Certified birth certificate or passport (spouse/beneficiary) — IF applicable
- Certified birth certificate (insurance dependents) — IF applicable
- Marriage certificate or common law affidavit — IF married
- Decree of dissolution of marriage — IF divorced
- Spousal Consent at Retirement form — IF married AND electing Maximum or J&S for non-spouse
- Medicare card or entitlement letter — IF Medicare-eligible
- Social Security Estimate or Award Letter — IF Tier 1/2 AND age 62+
- Voided check or bank letter — REQUIRED (unless entered via MyDERP portal)

**Applicable Rules:**
- RULE-TIER-DETERMINE: Tier determination from hire date
- RULE-VESTING: Confirm 5 years service credit
- RULE-DOC-COMPLETE: Document completeness validation
- RULE-DEADLINE-30DAY: Application received within 30 days of separation

**Validation Logic:**
- Retirement date must be first of a month
- Retirement date must follow separation date
- Member must be vested (5 years service credit)
- If married per application, spousal consent required unless spouse is J&S beneficiary at ≥50%
- Flag: If application received after 15th of month prior to effective date → first payment delay warning

**Exit Criteria:**
- Application received and logged
- Document checklist populated (complete/incomplete per item)
- Tier confirmed
- If incomplete: case status = "Pending Documents" with specific missing items identified
- If complete: advance to Eligibility Determination

**Workspace Components (Tier 1 Deterministic):**
- MemberBanner
- ApplicationChecklist (document completeness tracker)
- RetirementDateValidator (shows timing implications)
- MaritalStatusPanel (captures/confirms marital status, triggers spousal consent requirement)

**Workspace Components (Tier 2 Conditional):**
- IF married → SpousalConsentTracker
- IF Tier 1/2 AND age 62+ → SocialSecurityDocumentTracker
- IF Medicare-eligible → MedicareDocumentTracker
- IF DRO on file → DRONotificationPanel (alert: DRO will affect benefit)
- IF application received after 30-day window → DeadlineWarningPanel

---

### Stage 2: Eligibility Determination

**Stage ID:** SVC-RET-ELIGIBILITY  
**Purpose:** Determine retirement type, eligibility, and any benefit reduction  
**Primary Role:** Benefits Analyst  
**Reusable Capability:** CAPABILITY-ELIGIBILITY (see Section 4)

**Entry Criteria:**
- Application intake complete (Stage 1 exit criteria met)
- OR Standalone invocation from counseling session / Hub context / scenario modeler

**Required Data (from Data Connector):**
- Member demographics: date of birth, hire date
- Service credit: total earned, purchased, military
- Tier (from RULE-TIER-DETERMINE)
- Employment status and separation date (if separating)
- DRO records (if any — affects eligibility narrative, not eligibility itself)

**Applicable Rules (evaluated in order):**
1. RULE-TIER-DETERMINE — Confirm tier from hire date
2. RULE-AGE-AT-RETIREMENT — Calculate age at retirement date (years and months)
3. RULE-SERVICE-CREDIT-TOTAL — Sum earned service credit (exclude purchased for eligibility tests)
4. RULE-SERVICE-CREDIT-PURCHASED — Identify purchased service (calculation only, excluded from Rule of 75/85 and IPR)
5. RULE-VESTING — Confirm ≥ 5 years service credit
6. RULE-NORMAL-RETIREMENT — Age 65 + vested (all tiers)
7. RULE-RULE-OF-75 — Age + earned service ≥ 75, minimum age 55 (Tiers 1, 2)
8. RULE-RULE-OF-85 — Age + earned service ≥ 85, minimum age 60 (Tier 3)
9. RULE-EARLY-RETIREMENT-T12 — Age ≥ 55 + vested (Tiers 1, 2) → reduction applies
10. RULE-EARLY-RETIREMENT-T3 — Age ≥ 60 + vested (Tier 3) → reduction applies
11. RULE-EARLY-REDUCTION-T12 — 3% per year under 65 (Tiers 1, 2) ← CORRECTED from 6%
12. RULE-EARLY-REDUCTION-T3 — 6% per year under 65 (Tier 3)
13. RULE-DEFERRED — Vested but not age-eligible → deferred retirement

**Eligibility Output (structured, deterministic):**
```
{
  "tier": 1|2|3,
  "age_at_retirement": { "years": N, "months": N },
  "service_credit": {
    "earned": N.NN,
    "purchased": N.NN,
    "total_for_calculation": N.NN,
    "total_for_eligibility": N.NN  // earned only
  },
  "retirement_type": "normal" | "rule_of_75" | "rule_of_85" | "early" | "deferred",
  "eligible": true|false,
  "reduction": {
    "applies": true|false,
    "rate_per_year": 0.03|0.06,
    "years_under_65": N,
    "total_reduction_pct": N.NN,
    "source_rule": "RULE-EARLY-REDUCTION-T12|T3"
  },
  "rule_of_n_detail": {
    "rule_applies": "75"|"85",
    "sum": N.NN,
    "threshold": 75|85,
    "met": true|false,
    "minimum_age_met": true|false
  },
  "flags": [
    "purchased_service_excluded_from_eligibility",
    "dro_on_file",
    "leave_payout_eligible"
  ]
}
```

**Exit Criteria:**
- Eligibility determination complete with retirement type identified
- Reduction percentage calculated (if applicable)
- All rule evaluations documented with source references
- If standalone invocation (counseling/Hub): return result, no stage advance
- If process context: advance to Benefit Calculation

**Workspace Components (Tier 1 Deterministic):**
- MemberBanner
- EligibilityDetermination (shows rule-by-rule evaluation with ✓/✗)
- ServiceCreditSummary (earned vs. purchased breakdown)

**Workspace Components (Tier 2 Conditional):**
- IF purchased service present → PurchasedServiceCallout (explains exclusion from eligibility)
- IF early retirement → EarlyRetirementReductionDetail (shows reduction calculation step-by-step)
- IF early retirement AND near Rule of N threshold → ScenarioModelerPrompt ("Waiting N years eliminates reduction")
- IF DRO on file → DRONotification (informational — DRO affects benefit amount, not eligibility)
- IF leave payout eligible (hired before Jan 1, 2010) → LeavePayoutEligibilityFlag

---

### Stage 3: Benefit Calculation

**Stage ID:** SVC-RET-CALCULATION  
**Purpose:** Calculate the maximum monthly benefit and all payment option amounts  
**Primary Role:** Benefits Analyst  
**Reusable Capability:** CAPABILITY-BENEFIT-CALC (see Section 4)

**Entry Criteria:**
- Eligibility determination complete (Stage 2 exit criteria met)
- OR Standalone invocation from counseling session / Hub context / scenario modeler

**Required Data (from Data Connector):**
- Salary history (SALARY_HIST — complete record for AMS window determination)
- Leave payout amount (if eligible — hired before Jan 1, 2010)
- Service credit totals (earned + purchased for calculation)
- Beneficiary information (for J&S factor calculation)
- DRO records (if any — for marital share calculation)
- Furlough records (if any — for AMS impact analysis)
- Eligibility output from Stage 2 (tier, retirement type, reduction percentage)

**Applicable Rules (evaluated in order):**
1. RULE-AMS-WINDOW — Determine window: 36 consecutive months (Tiers 1, 2) or 60 consecutive months (Tier 3)
2. RULE-AMS-CALCULATION — Find highest consecutive N months of pensionable salary
3. RULE-LEAVE-PAYOUT — If hired before Jan 1, 2010: add leave payout to final month salary before AMS calculation
4. RULE-FURLOUGH-IMPACT — If furlough days in AMS window: show impact; note purchase option
5. RULE-BENEFIT-FORMULA-T1 — AMS × 2.0% × total service years (earned + purchased)
6. RULE-BENEFIT-FORMULA-T2 — AMS × 1.5% × total service years (earned + purchased)
7. RULE-BENEFIT-FORMULA-T3 — AMS × 1.5% × total service years (earned + purchased)
8. RULE-EARLY-REDUCTION-APPLY — Apply reduction percentage from eligibility determination
9. RULE-JS-100 — 100% Joint & Survivor actuarial reduction
10. RULE-JS-75 — 75% Joint & Survivor actuarial reduction
11. RULE-JS-50 — 50% Joint & Survivor actuarial reduction
12. RULE-SPOUSAL-CONSENT — If married and not electing ≥50% J&S for spouse → require consent
13. RULE-DRO-MARITAL-SHARE — If DRO on file: calculate marital fraction and alternate payee share
14. RULE-DRO-SEQUENCE — DRO split applies before J&S option selection
15. RULE-LUMP-SUM-DEATH — Calculate lump-sum death benefit amount based on retirement type and tier
16. RULE-IPR — Calculate IPR: $12.50/yr (non-Medicare) or $6.25/yr (Medicare) × earned service years only (purchased excluded)

**Calculation Output (structured, deterministic):**
```
{
  "ams": {
    "window_months": 36|60,
    "window_start": "YYYY-MM",
    "window_end": "YYYY-MM",
    "amount": NNNN.NN,
    "leave_payout_included": true|false,
    "leave_payout_amount": NNNN.NN,
    "leave_payout_ams_impact": NNN.NN,
    "furlough_in_window": true|false
  },
  "formula": {
    "ams": NNNN.NN,
    "multiplier": 0.020|0.015,
    "service_years": NN.NN,
    "gross_benefit": NNNN.NN
  },
  "reduction": {
    "applies": true|false,
    "percentage": NN.NN,
    "reduced_benefit": NNNN.NN
  },
  "maximum_benefit": NNNN.NN,
  "dro": {
    "applies": true|false,
    "marital_service_years": NN.NN,
    "marital_fraction": 0.NNNN,
    "marital_share": NNNN.NN,
    "alternate_payee_percentage": NN,
    "alternate_payee_amount": NNNN.NN,
    "member_benefit_after_dro": NNNN.NN
  },
  "payment_options": {
    "base_for_options": NNNN.NN,  // after DRO if applicable
    "maximum": NNNN.NN,
    "js_100": { "member": NNNN.NN, "survivor": NNNN.NN, "factor": 0.NNNN },
    "js_75":  { "member": NNNN.NN, "survivor": NNNN.NN, "factor": 0.NNNN },
    "js_50":  { "member": NNNN.NN, "survivor": NNNN.NN, "factor": 0.NNNN }
  },
  "lump_sum_death_benefit": {
    "amount": NNNN.NN,
    "installment_50": NN.NN,
    "installment_100": NN.NN
  },
  "ipr": {
    "service_years_for_ipr": NN.NN,  // earned only, purchased excluded
    "non_medicare_monthly": NNN.NN,
    "medicare_monthly": NNN.NN
  }
}
```

**Rounding Strategy (per BUILD_HISTORY Decision 21):**
- Carry full precision through all intermediate calculations
- Round only the final monthly benefit amount to cents (2 decimal places)
- Use banker's rounding (round half to even)
- AMS and intermediate formula results: full precision
- J&S factors: 4 decimal places (placeholder/illustrative for POC)
- Final monthly benefit: round to cents as last step

**Exit Criteria:**
- All calculations complete and verified
- Maximum benefit and all four payment options calculated
- DRO split calculated (if applicable)
- Lump-sum death benefit calculated
- IPR calculated
- If standalone invocation: return result
- If process context: advance to Election and Certification

**Workspace Components (Tier 1 Deterministic):**
- MemberBanner
- BenefitCalculationPanel (step-by-step formula with all inputs visible)
- AMSDetail (salary table with highlighted window, leave payout impact)
- PaymentOptionComparison (side-by-side Maximum vs. J&S options with member's actual numbers)

**Workspace Components (Tier 2 Conditional):**
- IF leave payout eligible → LeavePayoutImpactPanel (shows AMS with and without payout)
- IF furlough in AMS window → FurloughImpactPanel (shows impact, purchase cost)
- IF early retirement reduction → ReductionCalculationDetail
- IF DRO → DROCalculationPanel (marital share, alternate payee, member's remaining benefit)
- IF DRO → DROSequencingNote ("DRO split applied before payment option selection")
- IF married → SpousalConsentStatus (shows whether consent needed based on current election)
- IF beneficiary age available → J&S factor derivation (member age, beneficiary age, factors used)
- IF near Rule of N threshold (within 3 years) → ScenarioModeler (embedded comparison)

---

### Stage 4: Election and Certification

**Stage ID:** SVC-RET-ELECTION  
**Purpose:** Record member's irrevocable benefit elections and complete application  
**Primary Role:** Benefits Analyst

**Entry Criteria:**
- Benefit calculation complete (Stage 3 exit criteria met)
- Document checklist complete (all required documents received)

**Required Data:**
- Benefit calculation output (all payment options with amounts)
- Member's elected payment option (Maximum, 100% J&S, 75% J&S, 50% J&S)
- J&S beneficiary designation (if J&S elected)
- Lump-sum death benefit election (draw in 50/100 installments, or preserve)
- Lump-sum death beneficiary designation
- Tax withholding elections (federal, Colorado state)
- Direct deposit information
- Health insurance enrollment election
- Spousal consent form (if required)
- Application signature and notarization confirmation

**Applicable Rules:**
- RULE-SPOUSAL-CONSENT — Validate consent requirement based on election + marital status
- RULE-ELECTION-IRREVOCABLE — Confirm member understands elections are permanent
- RULE-LUMP-SUM-DEATH — Validate lump-sum election is consistent with retirement type
- RULE-INSURANCE-IPR — If electing DERP health insurance, IPR applies; if declining, no IPR
- RULE-DEADLINE-15TH — Flag processing cutoff for first payment timing

**Exit Criteria:**
- All elections recorded
- Spousal consent documented (if required)
- Application confirmed as signed and notarized
- All required documents on file
- Advance to Supervisor Review

**Workspace Components (Tier 1 Deterministic):**
- MemberBanner
- ElectionSummary (all choices with amounts — print-ready)
- DocumentChecklist (final verification — all items ✓)

**Workspace Components (Tier 2 Conditional):**
- IF married AND not electing ≥50% J&S for spouse → SpousalConsentRequired (blocking)
- IF lump-sum death benefit election inconsistent with retirement type → ValidationError
- IF application not yet notarized → NotarizationRequired flag

---

### Stage 5: Supervisor Review

**Stage ID:** SVC-RET-REVIEW  
**Purpose:** Independent verification of eligibility, calculation, and completeness  
**Primary Role:** Benefits Supervisor

**Entry Criteria:**
- Election and Certification complete (Stage 4 exit criteria met)
- Assigned to supervisor queue

**Required Data:**
- Complete case file from Stages 1-4
- Eligibility determination output
- Benefit calculation output with all supporting data
- Document checklist status
- Election summary

**Applicable Rules:**
- All rules from Stages 2-4 re-evaluated for verification
- RULE-HIGH-VALUE-THRESHOLD — Benefits exceeding configured dollar threshold require additional review
- RULE-EXCEPTION-FLAGS — Any data quality findings, manual overrides, or unusual conditions flagged

**Exit Criteria:**
- Supervisor approves: advance to Benefit Activation
- Supervisor returns: case sent back to specific stage with notes, status = "Returned for Correction"
- Supervisor escalates: case flagged for additional review (legal, actuary, executive director)

**Workspace Components (Tier 1 Deterministic):**
- MemberBanner
- ReviewChecklist (point-by-point verification items)
- CalculationVerification (side-by-side: analyst calculation vs. independent recalculation)
- CaseHistory (full audit trail of all actions)

**Workspace Components (Tier 2 Conditional):**
- IF benefit exceeds high-value threshold → HighValueReviewPanel
- IF data quality findings on member record → DataQualityFindingsPanel
- IF case was previously returned → PriorReturnNotes

---

### Stage 6: Benefit Activation

**Stage ID:** SVC-RET-ACTIVATE  
**Purpose:** Activate the retirement benefit for ongoing payment  
**Primary Role:** Benefits Analyst (with supervisor approval)

**Entry Criteria:**
- Supervisor review approved (Stage 5 exit criteria met)

**Actions:**
- Create BENEFIT_PAYMENT record with calculated amounts
- Set benefit effective date (first of month following separation)
- Set first payment date (based on 15th-of-month processing rule)
- Activate direct deposit
- Activate IPR (if enrolled in DERP health insurance)
- Activate lump-sum death benefit installments (if elected)
- Activate Social Security Make-Up (if eligible — Tier 1/2, age 62+) [OUT OF SCOPE FOR POC]
- If DRO: create separate payment record for alternate payee
- Update member status from Active to Retired
- Generate confirmation letter

**Exit Criteria:**
- Benefit payment record created and verified
- Member status updated
- Confirmation letter generated
- Case closed

**Note for POC:** This stage is largely operational. For the POC demo, we show the transition from "approved" to "activated" as a single action with the resulting benefit payment record displayed.

---

## SECTION 4: Reusable Capability Contracts

These capabilities are invoked by the process stages above but are also independently callable from other contexts.

### CAPABILITY-ELIGIBILITY

**Purpose:** Determine retirement eligibility and applicable reduction for a member at a given retirement date.

**Invocation Contexts:**
| Context | Entry Point | Behavior |
|---------|------------|----------|
| Task Workspace (Stage 2) | Process orchestrator advances to eligibility stage | Full evaluation, result stored on case, advances process |
| Member Hub (CSR) | CSR views member profile | Read-only summary of current eligibility status |
| Scenario Modeler (Counselor) | Counselor enters hypothetical retirement date | Evaluated against hypothetical date, not stored, comparison display |
| Benefit Estimate (MyDERP portal) | Member requests estimate | Evaluated against requested date, simplified output |

**Input Contract:**
```
{
  "member_id": "string",
  "retirement_date": "YYYY-MM-DD",
  "context": "process" | "hub" | "scenario" | "estimate",
  "scenario_overrides": {          // Only for scenario context
    "additional_service_months": N, // "What if I work N more months?"
    "purchased_service_years": N    // "What if I purchase N years?"
  }
}
```

**Output Contract:** (see Eligibility Output in Stage 2 above)

**Rules Invoked:** RULE-TIER-DETERMINE through RULE-DEFERRED (see Stage 2)

**Performance Target:** Sub-100ms (deterministic, no AI involvement)

### CAPABILITY-BENEFIT-CALC

**Purpose:** Calculate complete benefit including all payment options, DRO, IPR, and lump-sum death benefit.

**Invocation Contexts:**
| Context | Entry Point | Behavior |
|---------|------------|----------|
| Task Workspace (Stage 3) | Process orchestrator advances to calculation stage | Full calculation, result stored on case, advances process |
| Member Hub (CSR) | CSR views member benefit estimate | Calculation with current data, read-only display |
| Scenario Modeler (Counselor) | Counselor explores retirement date scenarios | Multiple calculations compared side-by-side |
| Benefit Estimate (MyDERP portal) | Member requests estimate | Simplified calculation, estimates only |

**Input Contract:**
```
{
  "member_id": "string",
  "retirement_date": "YYYY-MM-DD",
  "eligibility_result": { ... },   // Output from CAPABILITY-ELIGIBILITY
  "context": "process" | "hub" | "scenario" | "estimate",
  "scenario_overrides": {
    "leave_payout_amount": NNNN.NN,  // For "what if my leave payout is X?"
    "beneficiary_dob": "YYYY-MM-DD", // For J&S factor calculation
    "payment_option": "maximum" | "js_100" | "js_75" | "js_50"  // For scenario comparison
  }
}
```

**Output Contract:** (see Calculation Output in Stage 3 above)

**Rules Invoked:** RULE-AMS-WINDOW through RULE-IPR (see Stage 3)

**Performance Target:** Sub-200ms (deterministic, no AI involvement; may require salary history scan)

---

## SECTION 5: Composition Decision Matrix

This maps each process stage × member situation to the component set for the task workspace. This is the Tier 1 + Tier 2 composition logic — what the composition engine implements deterministically.

### Notation
- **Always** = Tier 1 (appears for every case at this stage)
- **Conditional** = Tier 2 (appears when condition is met)

### Stage 2: Eligibility Determination

| Component | Condition | Notes |
|-----------|-----------|-------|
| MemberBanner | Always | Tier badge, name, ID, DOB, hire date, status |
| EligibilityDetermination | Always | Rule-by-rule evaluation display |
| ServiceCreditSummary | Always | Earned vs. purchased breakdown |
| PurchasedServiceCallout | IF purchased_service > 0 | Explains exclusion from Rule of 75/85 and IPR |
| EarlyRetirementReductionDetail | IF retirement_type = "early" | Step-by-step reduction calculation |
| ScenarioModelerPrompt | IF early AND (rule_of_n_sum + 3) ≥ threshold | "Waiting N years eliminates reduction" |
| DRONotification | IF dro_on_file = true | Informational: DRO will affect benefit, not eligibility |
| LeavePayoutEligibilityFlag | IF hire_date < 2010-01-01 | Member may have leave payout that affects AMS |

### Stage 3: Benefit Calculation

| Component | Condition | Notes |
|-----------|-----------|-------|
| MemberBanner | Always | |
| BenefitCalculationPanel | Always | Full formula with all inputs |
| AMSDetail | Always | Salary table with highlighted window |
| PaymentOptionComparison | Always | Side-by-side all four options |
| LeavePayoutImpactPanel | IF leave_payout_eligible AND leave_payout > 0 | AMS with/without payout comparison |
| FurloughImpactPanel | IF furlough_in_ams_window | Impact amount, purchase cost |
| ReductionCalculationDetail | IF reduction_applies | Rate × years under 65 = reduction % |
| DROCalculationPanel | IF dro_on_file | Marital share, alternate payee, member remainder |
| DROSequencingNote | IF dro_on_file | "DRO split applied before payment option" |
| SpousalConsentStatus | IF married | Required/not required based on current election |
| ScenarioModeler | IF early_retirement AND years_to_rule_of_n ≤ 3 | Embedded comparison scenarios |
| LumpSumDeathBenefitPanel | Always | Amount, installment options |
| IPRCalculation | Always | Service years × rate, earned only |

### Hub Context: Member Context Cards

| Card | Condition | Content Source |
|------|-----------|---------------|
| MemberSummaryCard | Always | Demographics, tier, status, hire date |
| EligibilityCard | Always | Current eligibility snapshot from CAPABILITY-ELIGIBILITY |
| BenefitEstimateCard | IF vested | Current estimate from CAPABILITY-BENEFIT-CALC |
| ServiceCreditCard | Always | Earned, purchased, total |
| OpenCasesCard | IF has_open_cases | Current case(s) with status |
| DROCard | IF dro_on_file | DRO summary, status |
| BeneficiaryCard | Always | Current designations |
| ContributionCard | Always | Balance, employer/employee totals |
| ScenarioModelerCard | IF vested AND NOT retired | Entry point to scenario capability |
| LeavePayoutCard | IF hire_date < 2010-01-01 AND NOT retired | "Leave payout may affect your benefit" |

---

## SECTION 6: Open Questions for Resolution

1. **Early retirement reduction rate verification:** We need to confirm 3% (Tiers 1/2) and 6% (Tier 3) against the Denver Revised Municipal Code, not just DERP's member-facing materials. Can we access the RMC online?

2. **Employer contribution rate history:** If the rate is now 17.95% but was previously 11%, the seed data generator needs era-appropriate rates. When did each change occur?

3. **Social Security Make-Up benefit:** Include in POC or explicit out-of-scope? Recommendation: out-of-scope but acknowledge in demo.

4. **Early retirement reduction proration:** Does DERP apply the reduction by completed years only (so exactly 2 years under 65 = exact 6%/Tier 3 or 6%/Tier 1-2), or do they prorate for months? The handbook says "per year" which suggests completed years only. Verify.

5. **J&S factors:** We still need illustrative factors. The handbook confirms they're "calculated based on the assumed life expectancies of both you and your beneficiary, and on their respective ages upon retirement of the member." These are actuarial and plan-specific. Continue with illustrative disclaimer per BUILD_HISTORY Decision 17.

6. **Lump-sum death benefit proration for early retirement:** The handbook says "reduced by $250 for each year of age under 65" (Tiers 1/2) and "$500 for each year" (Tier 3). Is this completed years under 65, or prorated? E.g., at age 57, is it $250 × 8 = $2,000 or $250 × (65-57) = $2,000? Same result for completed years, but matters if age is 57 years and 6 months.

---

## SECTION 7: Impact on Demo Case Narratives

### Case 2 (Jennifer Kim) — Most Affected

With the corrected 3% early retirement reduction for Tier 2:
- Current narrative: 60% reduction (6% × 10 years under 65) → "dramatic" penalty, benefit roughly 40% of unreduced
- Corrected narrative: 30% reduction (3% × 10 years under 65) → still significant but benefit is 70% of unreduced
- The scenario modeler insight still works: "Wait 2 years to age 57, meet Rule of 75 → no reduction → ~43% increase" instead of the current "~3x increase"
- The demo point changes from "shocking penalty" to "meaningful penalty that still makes waiting worthwhile"

### Cases 1 and 4 (Robert Martinez) — Not Affected
Robert meets Rule of 75, so no reduction applies regardless of rate.

### Case 3 (David Washington) — Not Affected
David is Tier 3, where the 6% rate was already correct.

---

*Document prepared from DERP public sources. All rule interpretations require verification against the Denver Revised Municipal Code before implementation.*
