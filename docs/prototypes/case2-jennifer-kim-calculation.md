# Case 2: Jennifer Kim — Tier 2, Purchased Service, Early Retirement

## Member Profile

| Field | Value | Source |
|-------|-------|--------|
| Name | Jennifer Kim | Demo case specification |
| Member ID | M-100002 | Assigned |
| Date of Birth | June 22, 1970 | Demo case specification |
| Hire Date | March 1, 2008 | Demo case specification |
| Retirement Date | May 1, 2026 | Demo case specification |
| Tier | 2 (hired Sept 1, 2004 - June 30, 2011) | RMC §18-393 |
| Status | Active → Retired | — |
| Department | Finance | Demo case specification |
| Position | Budget Analyst III | Demo case specification |

## Beneficiary Information

| Field | Value |
|-------|-------|
| Beneficiary | Estate (unmarried) |
| Payment Option | Maximum Single Life |

---

## Application Timeline

| Event | Date | Validation Rule |
|-------|------|-----------------|
| Notification of intent to retire | March 16, 2026 | — |
| Last day worked | April 30, 2026 (Thursday) | — |
| Retirement effective date | May 1, 2026 (Friday) | First of month following separation |
| Application received (notarized) | April 8, 2026 (Wednesday) | RULE-APPLICATION-DEADLINE: 22 days before last day ✓ (within 30) |
| Notarization confirmed | April 8, 2026 | RULE-NOTARIZATION-REQUIRED: ✓ |
| Complete package received | April 8, 2026 | RULE-PAYMENT-PROCESSING-CUTOFF: Before April 15 ✓ |
| First payment date | May 1, 2026 (Friday) | First business day of effective month |

---

## Step 1: Age at Retirement

**Calculation:**
- DOB: June 22, 1970
- Retirement Date: May 1, 2026
- Age = 2026 - 1970 = 56 years base
- Month adjustment: May 1 vs June 22 = NOT past birthday yet
- **Age at Retirement: 55 years, 10 months (use 55.83 for calculations)**

*For Rule of 75 and reduction calculations, using age 55 (completed years)*

---

## Step 2: Service Credit Calculation

### 2.1 Employment Service (Earned)

**Employment Period:** March 1, 2008 through April 30, 2026

**Calculation:**
- Start: March 1, 2008
- End: April 30, 2026 (last day before retirement)
- From March 1, 2008 to March 1, 2026 = 18 years exactly
- From March 1, 2026 to April 30, 2026 = 2 months

**Total Employment Service: 18 years, 2 months = 18.17 years**

### 2.2 Purchased Service

**Jennifer purchased 3 years of prior government service**

| Purchase Type | Years | Cost | Status |
|---------------|-------|------|--------|
| Prior Government Service | 3.00 | $45,000 | Paid in full |

**CRITICAL DISTINCTION:**
- Purchased service **COUNTS** for benefit calculation (increases benefit amount)
- Purchased service **DOES NOT COUNT** for Rule of 75 eligibility
- Purchased service **DOES NOT COUNT** for IPR

### 2.3 Total Service Credit

| Type | Years | For Benefit Calc | For Rule of 75 | For IPR |
|------|-------|------------------|----------------|---------|
| Employment (Earned) | 18.17 | ✓ | ✓ | ✓ |
| Purchased | 3.00 | ✓ | ✗ | ✗ |
| **Total** | **21.17** | **21.17** | **18.17** | **18.17** |

---

## Step 3: Rule of 75 Eligibility Check

**Rule of 75 Requirements (Tier 2):** RMC §18-401
- Age + Service ≥ 75
- Minimum age: 55
- **Service = Earned service only (purchased EXCLUDED)**

**Calculation:**
- Age: 55 years (completed)
- **Earned Service ONLY:** 18.17 years
- Sum: 55 + 18.17 = **73.17**

**Evaluation:**
- 73.17 ≥ 75? ✗ **NO — DOES NOT MEET**
- Age 55 ≥ 55? ✓ Yes (meets minimum)

**Result: DOES NOT QUALIFY for Rule of 75 — Early retirement reduction APPLIES**

### 3.1 Why Purchased Service Doesn't Help

If purchased service counted:
- 55 + 21.17 = 76.17 ≥ 75 ✓ Would qualify

**But per RMC §18-407, purchased service is explicitly excluded from Rule of 75 calculation.**

This is the critical distinction this demo case illustrates.

---

## Step 4: Early Retirement Reduction

### 4.1 Reduction Rule

**Source:** DERP Active Member Handbook p.17; RMC §18-401(c)
- **Tiers 1 and 2: 3% per year under age 65**
- Tier 3: 6% per year under age 65
- Applies when Rule of 75/85 is NOT met

**Verification:** Rate confirmed against three independent DERP sources — Active Member Handbook (Revised January 2024, p.17), DERP Pension Benefit web page, and FAQ (p.43). All consistent. See CRITICAL-001-resolution.md for full verification history.

### 4.2 Calculation

**Years under 65:**
- Age at retirement: 55 (completed years)
- Normal retirement age: 65
- Difference: 65 - 55 = **10 years**

**Reduction Percentage:**
- 10 years × 3% per year = **30% reduction**

**Reduction Factor:**
- 1.00 - 0.30 = **0.70** (member receives 70% of calculated benefit)

---

## Step 5: Leave Payout Eligibility

**Requirements:** RMC §18-401.5
- Member hired before January 1, 2010

**Jennifer's Status:**
- Hire Date: March 1, 2008 — **Before Jan 1, 2010 ✓**

**However:** Jennifer has accrued PTO (not separate sick/vacation)

**Result: Leave payout MAY be eligible depending on leave type**

*For this calculation, assuming no leave payout applies (PTO not eligible)*

---

## Step 6: Salary History and AMS Calculation

### 6.1 Tier 2 AMS Rule

**AMS Window:** Highest 36 consecutive months of pensionable compensation
**Source:** RMC §18-391(3)

### 6.2 Salary History (Final 5 Years)

*Representative salary progression for a Budget Analyst III, Finance:*

| Year | Annual Salary | Monthly Salary | Notes |
|------|---------------|----------------|-------|
| 2021 | $78,500 | $6,541.67 | — |
| 2022 | $80,855 | $6,737.92 | 3% increase |
| 2023 | $84,089 | $7,007.42 | 4% increase |
| 2024 | $87,453 | $7,287.75 | 4% increase |
| 2025 | $90,076 | $7,506.33 | 3% increase |
| 2026 (Q1-Q2) | $92,778 (annualized) | $7,731.50 | 3% increase |

### 6.3 Monthly Breakdown: 36-Month AMS Window

**Window Period:** May 2023 through April 2026 (most recent 36 months)

| Month | Year | Salary |
|-------|------|--------|
| May | 2023 | $7,007.42 |
| Jun | 2023 | $7,007.42 |
| Jul | 2023 | $7,007.42 |
| Aug | 2023 | $7,007.42 |
| Sep | 2023 | $7,007.42 |
| Oct | 2023 | $7,007.42 |
| Nov | 2023 | $7,007.42 |
| Dec | 2023 | $7,007.42 |
| Jan | 2024 | $7,287.75 |
| Feb | 2024 | $7,287.75 |
| Mar | 2024 | $7,287.75 |
| Apr | 2024 | $7,287.75 |
| May | 2024 | $7,287.75 |
| Jun | 2024 | $7,287.75 |
| Jul | 2024 | $7,287.75 |
| Aug | 2024 | $7,287.75 |
| Sep | 2024 | $7,287.75 |
| Oct | 2024 | $7,287.75 |
| Nov | 2024 | $7,287.75 |
| Dec | 2024 | $7,287.75 |
| Jan | 2025 | $7,506.33 |
| Feb | 2025 | $7,506.33 |
| Mar | 2025 | $7,506.33 |
| Apr | 2025 | $7,506.33 |
| May | 2025 | $7,506.33 |
| Jun | 2025 | $7,506.33 |
| Jul | 2025 | $7,506.33 |
| Aug | 2025 | $7,506.33 |
| Sep | 2025 | $7,506.33 |
| Oct | 2025 | $7,506.33 |
| Nov | 2025 | $7,506.33 |
| Dec | 2025 | $7,506.33 |
| Jan | 2026 | $7,731.50 |
| Feb | 2026 | $7,731.50 |
| Mar | 2026 | $7,731.50 |
| Apr | 2026 | $7,731.50 |

### 6.4 AMS Calculation

**Sum of 36 months:**
- 2023 (May-Dec): 8 × $7,007.42 = $56,059.36
- 2024 (Jan-Dec): 12 × $7,287.75 = $87,453.00
- 2025 (Jan-Dec): 12 × $7,506.33 = $90,075.96
- 2026 (Jan-Apr): 4 × $7,731.50 = $30,926.00
- **Total:** $264,514.32

**Average Monthly Salary (AMS):**
- $264,514.32 ÷ 36 = **$7,347.62**

---

## Step 7: Benefit Calculation — Before Reduction

### 7.1 Tier 2 Formula

**Formula:** AMS × Multiplier × Years of Service
**Source:** RMC §18-401

| Component | Value | Source |
|-----------|-------|--------|
| AMS | $7,347.62 | Step 6 calculation |
| Multiplier | 1.5% (0.015) | Tier 2, RMC §18-401 |
| Service Years | **21.17** (includes purchased) | Step 2 calculation |

### 7.2 Unreduced Benefit Calculation

**Monthly Benefit (before reduction) = AMS × Multiplier × Service**
- = $7,347.62 × 0.015 × 21.17
- = $7,347.62 × 0.31755
- = **$2,332.96**

---

## Step 8: Apply Early Retirement Reduction

### 8.1 Reduction Application

**Unreduced Benefit:** $2,332.96
**Reduction Factor:** 0.70 (30% reduction per Step 4)

**Reduced Monthly Benefit:**
- = $2,332.96 × 0.70
- = **$1,633.07**

### 8.2 Impact Summary

| Benefit Type | Monthly Amount | Annual Amount |
|--------------|----------------|---------------|
| Unreduced (age 65) | $2,332.96 | $27,995.52 |
| **Reduced (age 55)** | **$1,633.07** | **$19,596.84** |
| **Reduction Amount** | **$699.89** | **$8,398.68** |

**Jennifer loses $699.89 per month due to early retirement reduction.**

---

## Step 9: Payment Options

### 9.1 Single/Unmarried Member

Jennifer is unmarried, so spousal consent provisions don't apply.

### 9.2 Payment Option Calculations

*Actuarial factors for 55-year-old with no survivor benefit elected:*

| Option | Factor | Calculation | Monthly Benefit |
|--------|--------|-------------|-----------------|
| Maximum | 1.0000 | $1,633.07 × 1.0000 | **$1,633.07** |
| 100% J&S | N/A | Not applicable (no beneficiary) | — |
| 75% J&S | N/A | Not applicable | — |
| 50% J&S | N/A | Not applicable | — |

*Note: Jennifer would elect Maximum as she has no spouse/dependent to provide for.*

### 9.3 Elected Option

**Jennifer elects: Maximum Single Life**
- Monthly benefit: **$1,633.07**

---

## Step 10: Insurance Premium Reduction (IPR)

### 10.1 IPR Rules

**Source:** RMC §18-412
- Non-Medicare (under 65): $12.50 per year of **earned** service
- **Purchased service excluded**

### 10.2 Jennifer's IPR Calculation

**At Retirement (Age 55):**
- Medicare eligible? NO
- Rate: $12.50/year of earned service
- **Earned Service ONLY:** 18.17 years

**IPR Amount = $12.50 × 18.17 = $227.13/month**

*Note: If purchased service counted, IPR would be $12.50 × 21.17 = $264.63 — a difference of $37.50/month*

---

## Step 11: Lump-Sum Death Benefit

### 11.1 Death Benefit Rules

**Source:** DERP Active Member Handbook; Retirement Application Part C
- Normal/Rule of 75/85 retirement: $5,000
- Early retirement Tiers 1 & 2: $5,000 minus $250 per completed year under age 65
- Early retirement Tier 3: $5,000 minus $500 per completed year under age 65
- Election is **irrevocable**: member chooses 50 or 100 monthly installments
- Separate beneficiary designation (can differ from J&S beneficiary)

### 11.2 Jennifer's Death Benefit Calculation

**Retirement type:** Early retirement, Tier 2
**Age at retirement:** 55 (completed years)
**Years under 65:** 10

**Calculation:**
- Base: $5,000
- Reduction: $250 × 10 = $2,500
- **Lump-Sum Death Benefit: $5,000 - $2,500 = $2,500**

**Installment Options:**
| Option | Installments | Monthly Amount |
|--------|-------------|----------------|
| 50 installments | 50 months | $50.00/month |
| 100 installments | 100 months | $25.00/month |

---

## Step 12: Scenario Comparison — Critical Analysis

### 12.1 The Value of Waiting

This case illustrates the significant cost of early retirement before meeting Rule of 75, and the power of threshold proximity detection.

**When would Jennifer meet Rule of 75?**
- Current: Age 55 + 18.17 service = 73.17 (need 75)
- Gap: 75 - 73.17 = 1.83 points needed
- Each year worked adds 2 points (1 year age + 1 year service)
- **Time to Rule of 75: approximately 11 months**

### 12.2 Wait 1 Year (May 2027, age 56)

**At May 1, 2027:**
- Age: 56 years (completed)
- Earned Service: 19.17 years
- Rule of 75 check: 56 + 19.17 = 75.17 ≥ 75 ✓ **MEETS RULE OF 75**
- Total Service (with purchased): 22.17 years

**Benefit calculation:**
- Estimated AMS with ~3% salary increase: ~$7,570
- $7,570 × 0.015 × 22.17 = **~$2,518/month**
- **NO REDUCTION** (Rule of 75 met)

### 12.3 Wait 2 Years (May 2028, age 57)

**At May 1, 2028:**
- Age: 57 years (completed)
- Earned Service: 20.17 years
- Rule of 75 check: 57 + 20.17 = 77.17 ≥ 75 ✓
- Total Service (with purchased): 23.17 years

**Benefit calculation:**
- Estimated AMS with ~3%/year salary increases: ~$7,800
- $7,800 × 0.015 × 23.17 = **~$2,711/month**
- **NO REDUCTION** (Rule of 75 met)

### 12.4 Comparison Table

| Scenario | Age | Total Svc | Rule of 75 | Reduction | Monthly Benefit |
|----------|-----|-----------|------------|-----------|-----------------|
| **Retire Now (May 2026)** | 55 | 21.17 | ✗ 73.17 | 30% | **$1,633.07** |
| **Wait 1 Year (May 2027)** | 56 | 22.17 | ✓ 75.17 | 0% | **~$2,518** |
| Wait 2 Years (May 2028) | 57 | 23.17 | ✓ 77.17 | 0% | **~$2,711** |

### 12.5 Financial Impact (Wait 1 Year)

**Monthly increase:** $2,518 - $1,633 = **$885 more per month (54% increase)**

**Breakeven Analysis:**
- Foregone income while waiting (1 year): $1,633 × 12 = $19,597
- Monthly gain after waiting: $885
- Breakeven: $19,597 ÷ $885 = **~22 months**

**Over 20-year retirement:**
- Retire now (2026): $1,633 × 240 = $391,937
- Wait 1 year (2027): $2,518 × 228 = $574,104 (19 years from 2027)

**Difference: ~$182,167 more by waiting just one year**

### 12.6 Demo Narrative

The system correctly applies DERP's 3% per year early retirement reduction for Tier 2, then proactively identifies that Jennifer is only 11 months from Rule of 75. The scenario comparison shows that waiting just one year increases her monthly benefit by 54% — from $1,633 to approximately $2,518 — with no reduction at all. This is exactly the kind of operational intelligence NoUI surfaces for pension staff and members.

---

## Summary: Jennifer Kim

| Item | Value |
|------|-------|
| **Tier** | 2 |
| **Age at Retirement** | 55 |
| **Earned Service** | 18.17 years |
| **Purchased Service** | 3.00 years |
| **Total Service (for benefit)** | 21.17 years |
| **Total Service (for Rule of 75)** | 18.17 years |
| **Rule of 75** | ✗ Does NOT qualify (73.17) |
| **Early Retirement Reduction** | 30% (10 years × 3%) |
| **AMS (36-month)** | $7,347.62 |
| **Unreduced Benefit** | $2,332.96 |
| **Reduced Benefit** | $1,633.07 |
| **Elected Option** | Maximum Single Life |
| **Monthly Benefit** | $1,633.07 |
| **IPR (pre-Medicare)** | $227.13/month |
| **Lump-Sum Death Benefit** | $2,500 |
| **If waits 1 year to age 56** | ~$2,518/month (no reduction) |

---

## Key Demonstration Points

### 1. Purchased Service Exclusion
Jennifer's 3 years of purchased service:
- ✓ Increases her benefit multiplier (21.17 vs 18.17 years)
- ✗ Does NOT help her reach Rule of 75
- ✗ Does NOT count for IPR

**This is the most important rule distinction in DERP.**

### 2. Meaningful Early Retirement Penalty
- 30% reduction = losing nearly a third of the earned benefit
- The 3% per year rate (Tiers 1 & 2) is less severe than the 6% rate (Tier 3), but still significant

### 3. Threshold Proximity Detection
- Jennifer is only 1.83 points from Rule of 75 — approximately 11 months
- Waiting just one year eliminates the entire 30% reduction
- The system identifies this automatically and presents the comparison
- This is the core value proposition of NoUI's scenario modeling

### 4. Complete Application Workflow
- Timing rules enforced: application within 30-day window, notarized, before 15th cutoff
- Lump-sum death benefit calculated and presented for irrevocable election
- SS Make-Up benefit noted as out of scope (placeholder rule)

---

## Verification Checklist

- [x] Tier correctly determined from hire date (Tier 2)
- [x] Earned vs purchased service tracked separately
- [x] Rule of 75 evaluated with earned service ONLY
- [x] Purchased service correctly excluded from Rule of 75
- [x] Early retirement reduction correctly calculated (30% at 3%/year — CORRECTED from 60% at 6%/year)
- [x] AMS uses 36-month window (Tier 2)
- [x] Benefit formula uses 1.5% multiplier (Tier 2)
- [x] Benefit formula uses TOTAL service (21.17, including purchased)
- [x] Reduction applied to benefit amount
- [x] IPR calculated with earned service only
- [x] Lump-sum death benefit calculated for early retirement
- [x] Application timing rules validated
- [x] Scenario comparison demonstrates threshold proximity

---

## Source References

| Provision | RMC Section | Additional Source |
|-----------|-------------|-------------------|
| Tier 2 Definition | §18-393(b) | — |
| AMS (36 months) | §18-391(3) | — |
| Rule of 75 | §18-401(b) | — |
| 1.5% Multiplier | §18-401(a) | — |
| Early Retirement Reduction (3%/yr Tier 2) | §18-401(c) | Active Member Handbook p.17 (verified) |
| Purchased Service for Benefit | §18-407(a) | — |
| Purchased Service Exclusion | §18-407(c) | — |
| IPR | §18-412 | — |
| Lump-Sum Death Benefit | — | Active Member Handbook; Retirement Application Part C |
| Application Timing | — | DERP Retirement Checklist; Application Form |

## Change History

| Date | Change | Reason |
|------|--------|--------|
| 2026-02-21 | Corrected early retirement reduction from 6%/yr to 3%/yr | CRITICAL-001: Verified against DERP Active Member Handbook, website, FAQ |
| 2026-02-21 | Added lump-sum death benefit calculation | Decision 23: Include in POC scope |
| 2026-02-21 | Added application timeline with timing rule validation | Decision 24: Full enforcement |
| 2026-02-21 | Revised scenario comparison to highlight 1-year wait | Corrected rate makes 1-year threshold more compelling |
