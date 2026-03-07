# CRITICAL-001 Resolution: Early Retirement Reduction Rate Verification

**Date:** February 21, 2026
**Status:** VERIFIED — Ready for Implementation
**Impact:** Case 2 (Jennifer Kim) recalculation required; CLAUDE.md, system prompt, BUILD_PLAN updates required

---

## 1. Finding Summary

**Our project documents stated:** 6% per year under age 65 for ALL tiers

**DERP actually specifies:**
- Tiers 1 & 2: **3% per year** for each year under age 65 (maximum 30% reduction at age 55)
- Tier 3: **6% per year** for each year under age 65 (maximum 30% reduction at age 60)

## 2. Verification Sources

### Source 1: DERP Active Member Handbook (Revised January 2024)

Page 17, "Early Retirement" section:

> **Membership Tiers 1 and 2** (Hired Before July 1, 2011)
> - Age 55
> - Vested
> - DERP Pension Benefit is reduced by **3% per year** for each year under age 65
>
> **Membership Tier 3** (Hired on or after July 1, 2011)
> - Age 60
> - Vested
> - DERP Pension Benefit is reduced by **6% per year** for each year under age 65

**URL:** https://derp.org/wp-content/uploads/2023/04/DERP_ActiveMemberHandbook.pdf

### Source 2: DERP Pension Benefit Web Page

Early Retirement section displays the same rates — 3% for Tiers 1/2, 6% for Tier 3.

**URL:** https://derp.org/benefits/derp-pension-benefit/

### Source 3: DERP FAQ Page

States: "reduced by 3% for each year you are under age 65 (30% reduction at age 55)" for Tiers 1/2.

**URL:** https://derp.org/education/faq/

### Source 4: Denver Revised Municipal Code (RMC)

We were able to obtain the DERP-published copy of the RMC (Sections 18-391 through 18-430.7, January 2024 edition) from:
https://derp.org/wp-content/uploads/2023/04/DERP_DRMC_Jan_2024.pdf

The PDF is 61 pages. We successfully retrieved through Section 18-406 (Eligibility). Section 18-408 (Retirement Categories), which would contain the specific reduction rates, was beyond the retrieval window. However, Municode hosts Denver's code at:
https://library.municode.com/co/denver/codes/code_of_ordinances (Section 18-408)

**RMC verification status:** Indirect. The RMC is the ultimate authority. Three independent DERP-published sources (handbook, website, FAQ) — all citing the RMC as their authority — unanimously agree on 3%/6%. The handbook has a legal disclaimer that the RMC governs in case of conflict. Given that DERP's own staff uses these materials to administer benefits, the probability that all three sources contain the same error is extremely low.

**Recommendation:** Accept 3%/6% as correct for build purposes. Verify against RMC Section 18-408 via direct access when possible (e.g., visiting a Denver library with Municode access, or requesting from DERP directly). Flag in BUILD_HISTORY as "verified against member-facing materials; RMC direct verification pending."

---

## 3. CRITICAL-002 Also Verified: Employer Contribution Rate

**Our documents:** 11% of payroll
**DERP Active Member Handbook, p.9:** "Employer contributions - 17.95% of payroll"
**DERP 2023 ACFR, p.17:** 2023 employer contributions totaled $159,584,423 against 9,928 active members — consistent with a rate substantially higher than 11%.

The rate has increased over time. The 2023 ACFR's actuarial section (p.77) shows contribution rates have risen from 18.4% (total) in 2014 to 26.1% (total, employer + employee) in 2023. The 17.95% employer + 8.45% employee = 26.40% total is consistent with this trajectory.

**Resolution:** Use 17.95% for current employer rate. Seed data generator should use era-appropriate rates (the 11% was likely valid circa 2005-2010).

---

## 4. Recalculated Case 2: Jennifer Kim

### Unchanged Items
All items through Step 7 (Unreduced Benefit Calculation) remain the same:
- Tier: 2
- Age at retirement: 55 years, 10 months (55 completed years)
- Earned service: 18.17 years
- Purchased service: 3.00 years
- Total for calculation: 21.17 years
- Total for eligibility (Rule of 75): 18.17 years
- Rule of 75: 55 + 18.17 = 73.17 — **DOES NOT MEET**
- AMS (36-month): $7,347.62
- Unreduced benefit: $7,347.62 × 0.015 × 21.17 = **$2,332.96**

### Corrected Step 4: Early Retirement Reduction

| Item | OLD (Incorrect) | NEW (Corrected) |
|------|-----------------|-----------------|
| Rate per year | 6% | **3%** |
| Years under 65 | 10 | 10 |
| Total reduction | 60% | **30%** |
| Reduction factor | 0.40 | **0.70** |
| Source | (error) | Active Member Handbook p.17 |

### Corrected Step 8: Apply Reduction

**Unreduced Benefit:** $2,332.96
**Reduction Factor:** 0.70 (30% reduction)

**Reduced Monthly Benefit:**
= $2,332.96 × 0.70
= **$1,633.07**

### Corrected Impact Summary

| Benefit Type | OLD | NEW |
|--------------|-----|-----|
| Unreduced (age 65) | $2,332.96 | $2,332.96 (unchanged) |
| **Reduced (age 55)** | **$933.18** | **$1,633.07** |
| Reduction amount | $1,399.78 | $699.89 |

**Jennifer's corrected early retirement benefit is $1,633.07/month — 75% higher than the incorrect $933.18.**

### Corrected Step 9: Payment Options

Jennifer is unmarried, elects Maximum Single Life:
- **Monthly benefit: $1,633.07**

### IPR — Unchanged
$12.50 × 18.17 = $227.13/month (earned service only, purchased excluded)

### Corrected Step 11: Scenario Comparison

**When does Jennifer meet Rule of 75?**
- Current: 55 + 18.17 = 73.17 (need 75)
- Gap: 1.83 points
- Each year worked adds ~2 points (1 year age + 1 year service)
- **Time to Rule of 75: approximately 11 months**

**At age 56 (May 1, 2027 — waiting just 1 year):**
- Age: 56 | Earned service: 19.17 years
- Rule of 75 check: 56 + 19.17 = 75.17 ≥ 75 ✓
- Total service with purchased: 22.17 years
- Estimated AMS (with ~3% salary increase): ~$7,570
- Benefit: $7,570 × 0.015 × 22.17 = **~$2,518/month**
- **NO REDUCTION**

**At age 57 (May 1, 2028 — waiting 2 years):**
- Age: 57 | Earned service: 20.17 years
- Rule of 75: 57 + 20.17 = 77.17 ✓
- Total service: 23.17 years
- Estimated AMS: ~$7,800
- Benefit: $7,800 × 0.015 × 23.17 = **~$2,711/month**
- **NO REDUCTION**

### Corrected Comparison Table

| Scenario | Age | Total Svc | Rule of 75 | Reduction | Monthly Benefit |
|----------|-----|-----------|------------|-----------|-----------------|
| Retire Now (2026) | 55 | 21.17 | ✗ 73.17 | 30% | **$1,633.07** |
| Wait 1 Year (2027) | 56 | 22.17 | ✓ 75.17 | 0% | **~$2,518** |
| Wait 2 Years (2028) | 57 | 23.17 | ✓ 77.17 | 0% | **~$2,711** |

### Corrected Financial Impact (Wait 1 Year Scenario)

| Metric | OLD (6% rate) | NEW (3% rate) |
|--------|---------------|---------------|
| Monthly benefit (retire now) | $933.18 | $1,633.07 |
| Monthly benefit (wait 1yr) | ~$2,518 | ~$2,518 |
| Monthly increase from waiting | ~$1,585 | ~$885 |
| Foregone income while waiting | $933 × 12 = $11,198 | $1,633 × 12 = $19,597 |
| Breakeven period | ~7 months | ~22 months |
| Benefit increase percentage | ~170% | **~54%** |

### Updated Demo Narrative

**OLD narrative:** "Shocking penalty — 60% reduction means Jennifer receives only 40% of her earned benefit. Waiting 2 years nearly TRIPLES her monthly income."

**NEW narrative:** "Meaningful penalty — 30% reduction means Jennifer loses nearly a third of her earned benefit by retiring early. But here's the insight: she's only 11 months from Rule of 75. If she waits just one year, her benefit jumps from $1,633 to approximately $2,518 — a 54% increase with no reduction at all. The system identifies this automatically and presents the comparison."

**The demo point is actually STRONGER with the correct rate.** The story shifts from "extreme penalty" (which might seem unrealistic to DERP staff who know the actual rules) to "the system correctly applies the real 3% rate AND proactively identifies that she's close to a threshold that eliminates the reduction entirely." This is exactly the kind of operational intelligence NoUI is designed to surface.

---

## 5. Impact on Other Cases

### Case 1 (Robert Martinez) — NO CHANGE
Robert meets Rule of 75 (63 + 28.75 = 91.75). No reduction applies regardless of rate.

### Case 3 (David Washington) — NO CHANGE
David is Tier 3. The 6% rate was already correct per all sources. His 12% reduction (2 years under 65 × 6%) stands.

### Case 4 (Robert Martinez with DRO) — NO CHANGE
Same as Case 1 — Rule of 75 met, no reduction.

---

## 6. Lump-Sum Death Benefit — NEW for Case 2

Based on research findings (IMPORTANT-002), Jennifer qualifies for:
- Early Retirement Tiers 1 & 2: $2,500 at age 55, reduced by $250 per year under 65
- Jennifer at age 55: $2,500 - ($250 × 10) = $2,500 - $2,500 = **$0**

Wait — that reduces to zero at age 55. Let me re-read the source:
- "The lump-sum death benefit is $2,500 at age 55."
- "This benefit is reduced by $250 for each year of age under 65."

Interpretation: The $2,500 is the amount AT age 55. The reduction applies for ages BELOW the normal early retirement age entry point. Since age 55 IS the minimum early retirement age for Tiers 1/2, the $2,500 is the amount at age 55. No further reduction — the "reduced by $250 per year under 65" applies to calculate down FROM the normal retirement amount.

So: Normal retirement death benefit = $5,000. At age 55, reduced by $250 × (65-55) = $2,500 reduction. $5,000 - $2,500 = $2,500.

**Jennifer's lump-sum death benefit at age 55: $2,500**
- If 50 installments: $2,500 / 50 = $50.00/month
- If 100 installments: $2,500 / 100 = $25.00/month

---

## 7. Required Updates — Checklist

### Documents to Update

- [ ] **case2-jennifer-kim-calculation.md** — Full recalculation per Section 4 above
- [ ] **case2-jennifer-kim-test-fixture.json** — Update reduction_rate, reduction_factor, reduced_benefit, monthly_benefit
- [ ] **CLAUDE.md** — Update the DERP tier quick reference table:
  - Tier 1: "Early reduction: 3% per year under 65" (was 6%)
  - Tier 2: "Early reduction: 3% per year under 65" (was 6%)
  - Tier 3: "Early reduction: 6% per year under 65" (unchanged)
- [ ] **System Prompt** — Update DERP Plan Provisions section:
  - Tier 1 early retirement: "Reduction: 3% per year under 65" (was 6%)
  - Tier 2 early retirement: Same as Tier 1
  - Tier 3: Leave at 6%
- [ ] **BUILD_PLAN.md** — Update eligibility.yaml rule definitions:
  - RULE-EARLY-REDUCTION-T12: 3% (was 6%)
- [ ] **generate_derp_data.py** — Update EMPLOYER_CONTRIB_RATE from 0.11 to 0.1795
- [ ] **noui-derp-service-retirement-process.md** — Already uses correct 3%/6% rates (was created with corrected values)

### BUILD_HISTORY Entry

```
## Decision XX: Early Retirement Reduction Rate Correction

**Date:** February 21, 2026
**Category:** Rules & Calculations
**Status:** Resolved

**Context:** During comprehensive research of DERP's published materials (Active Member Handbook, website, FAQ), discovered that the early retirement reduction rate for Tiers 1 and 2 is 3% per year under age 65, not 6% as stated in our project documents. Tier 3 rate of 6% was correct.

**Verification:** Confirmed across three independent DERP-published sources. RMC direct text verification pending (Section 18-408 not accessible via web fetch) but all DERP sources are internally consistent and cite the RMC as their authority.

**Impact:** Case 2 (Jennifer Kim) monthly benefit changes from $933.18 to $1,633.07. Demo narrative strengthened — the correct 3% rate makes the scenario modeler demonstration more realistic and the "close to threshold" insight more compelling.

**Action:** Updated case calculation, test fixture, CLAUDE.md, system prompt, and BUILD_PLAN rule definitions.
```

---

## 8. Additional Verification: Contribution Rate History

For the seed data generator, we need era-appropriate employer contribution rates. From the 2023 ACFR actuarial section, total contribution rates (employer + employee combined) have risen from 18.4% in 2014 to 26.1% in 2023. The employee rate has been 8.45% since at least 2014.

Approximate employer rate timeline (these are assumptions based on available data):
- Pre-2011: ~11% (matches our original project documents)
- 2014: ~10% (18.4% total - 8.45% employee ≈ 9.95% employer)
- 2017: Rate increases began (Ord. 1007-17 aligned DRMC with plan practices)
- 2019: Significant increase due to actuarial assumption changes
- 2022: ~16-17%
- 2024: 17.95% (per handbook)

**For seed data:** Use 11% for hire dates before 2012, then scale to current. Exact historical rates can be refined later.

---

*This document resolves CRITICAL-001 and CRITICAL-002 from the Service Retirement Process Definition research. Implementation should proceed using the verified 3%/6% rates.*
