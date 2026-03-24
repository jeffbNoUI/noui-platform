# Public pension terminology crosswalk: service credit, compensation, and contributions across 25 systems

**Montana PERA and PSPRS explicitly split service into eligibility-service and benefit-service — the single most critical migration distinction found across all 25 systems.** Fourteen distinct terms exist for the concept of "pensionable time," eleven distinct terms for the salary average used in the benefit formula, and contribution terminology fragments into system-specific account structures that resist naive field mapping. This crosswalk covers all three domains across COPERA, DERP, CalPERS, NYCERS, OPERS, TRS Texas, LACERA, IMRF, VRS, TMRS, LAGERS, IPERS, PSPRS, Oregon PERS, Nevada PERS, MSRS, Utah RS, Montana PERA, FRS, STRS Ohio, PSERS, KPERS, NHRS, SDCERS, and HMEPS.

---

## LAYER 1 — Master term inventory

### Domain 1: Service credit terminology

#### Primary terms for pensionable time

| Term | Abbreviation | Source System(s) | Definition | Notes |
|------|-------------|-----------------|------------|-------|
| Service credit | SC | COPERA, DERP, CalPERS, LACERA, SDCERS, OPERS, IMRF, IPERS, TRS Texas, TMRS, VRS, KPERS, Nevada PERS, Utah RS, Montana PERA (benefit calc only) | Time worked/contributed that counts toward pension | Most common term across systems; meaning varies — see eligibility vs. benefit flags |
| Credited service | CS | NYCERS, PSERS, NHRS (variant: "creditable"), FRS ("creditable"), HMEPS, LAGERS, PSPRS (benefit calc only), DERP (ACFR usage) | Service for which retirement credit has been earned | NYCERS and PSERS use "credited"; NHRS and FRS use "creditable" — functionally identical |
| Creditable service | — | NHRS, FRS, VRS (statutory), Oregon PERS (Tier 1/2), PSERS (alternate), IMRF (statutory) | Statutory term for qualifying service periods | VRS uses interchangeably with "service credit" |
| Membership service | — | NYCERS, TRS Texas, Montana PERA (eligibility only), LAGERS | Service performed after joining the system | **⚠️ FALSE COGNATE**: Montana PERA "membership service" = eligibility-only service; NYCERS "membership service" = earned service subset of credited service; LAGERS = service after employer joined |
| Retirement credit | — | Oregon PERS (OPSRP only) | OPSRP-specific term replacing "creditable service" | **⚠️ MIGRATION RISK**: Different term from Tier 1/2 within same system |
| Allowable service | — | MSRS, NYCERS (special plans) | Credit earned each month deductions are withheld | MSRS uses as synonym for service credit; NYCERS uses for specific plan eligibility only |
| Service (unqualified) | — | PSPRS (eligibility only) | Total time from membership start to termination including unpaid periods | **⚠️ CRITICAL**: PSPRS "service" ≠ "credited service" — broader term for eligibility |
| Years of service | YOS | KPERS, Utah RS, TRS Texas, multiple systems in formula context | Synonym in benefit formulas | Generic usage; rarely the primary defined term |
| Qualifying service credit | QSC | STRS Ohio, PSERS ("qualifying service") | Specific subset of service for eligibility/vesting | **⚠️ MIGRATION RISK**: STRS Ohio defines narrowly — only earned/restored Ohio public service |
| Contributing months | — | OPERS (Member-Directed Plan only) | Months employer remitted contributions | Unique to OPERS DC plan variant |
| Earned service credit | — | COPERA, LACERA | Service from actual employment (vs. purchased) | Distinguished from purchased service |
| Equivalent membership service credit | — | TRS Texas | Purchased service credit (sick leave conversion, work experience) | **⚠️ CRITICAL**: Some types cannot be used for eligibility |
| Eligibility points | EP | PSERS | Distinct tracking for eligibility separate from credited service | **⚠️ MIGRATION RISK**: Usually matches credited service but can diverge (e.g., USERRA) |

#### Purchased service terms

| Term | Source System(s) | Notes |
|------|-----------------|-------|
| Purchasing service credit | COPERA, DERP, CalPERS, LACERA, KPERS, FRS | Generic purchase term |
| Purchase of Service Credit (PSC) | SDCERS, Nevada PERS | SDCERS abbreviates as PSC |
| Purchase service credit | PSERS, MSRS, Montana PERA, STRS Ohio | Variant phrasing |
| Purchased service | NYCERS ("Buy-Back") | NYCERS uses "Buy-Back" as synonym |
| Buy back service credit / Buyback | TMRS, IPERS, NYCERS | Restoring previously refunded service |
| Redeposit of Withdrawn Contributions | CalPERS, LACERA | California-specific term for restoring refunded service |
| Refund Buyback | PSERS | PA-specific term |
| Reinstated service | IMRF ("Application to Reinstate Credit") | Requires 2+ years post-refund contributing service |
| Restored withdrawn credit | STRS Ohio | Previously refunded service that has been restored |
| Service Prior to Membership (SPM) | CalPERS | Pre-membership work for CalPERS employer in non-qualifying position |
| Optional Service Credit | FRS | Umbrella term for all purchased service types |
| Qualified employment / Nonqualified employment | COPERA | Two purchase categories based on employer type |
| Prior governmental service / Nongovernmental service | DERP | Two purchase categories; nongovernmental capped at 5 years |
| One-for-Five service | Montana PERA | Buy 1 year per 5 years of membership service (max 5 years); **does NOT count as membership service** |
| Permissive service credit | Oregon PERS (OAR term) | Administrative rule term for purchased service |
| Full cost purchase | Oregon PERS | Purchase at full actuarial liability |
| Prior Service Credit (PSC) | TMRS | Credit for service when city joined TMRS; includes monetary credit |
| Restricted Prior Service Credit (RPSC) | TMRS | Time-only credit for previous public employment; no monetary value |
| Prior Service | LAGERS, IMRF, KPERS | Service before employer joined the system |
| Additional Retirement Credit (ARC) | LACERA (discontinued 1/1/2013) | Not based on actual employment; excluded from eligibility/vesting/healthcare |
| Additional Retirement Service Credit (ARSC) | CalPERS (eliminated under PEPRA) | Purchased airtime; eliminated 1/1/2013 |
| Non-Qualifying Part-Time (NQPT) | PSERS | Part-time service below 500 hrs/80 days; time-limited purchase windows |
| Multiple Service | PSERS | Combines PSERS + SERS service |
| Combined/Joint service | OPERS, STRS Ohio | Ohio systems combine at retirement; system with most service calculates benefit |

#### Transferred and reciprocal service terms

| Term | Source System(s) | Notes |
|------|-----------------|-------|
| Reciprocity | CalPERS, LACERA, SDCERS | California inter-system agreement; preserves benefits when moving between CA public systems |
| Transferred Service | NYCERS | Service credited from another NYC/NYS public retirement system |
| Transfer | MSRS | Transfer contributions + interest between MN public pension plans |
| Combined Service Annuity (CSA) | MSRS | MN portability mechanism; each plan calculates and pays separately using same high-five salary |
| Reciprocal service | IMRF | Service earned in 12 IL public pension systems under Reciprocal Act |
| Joint service credit | OPERS, STRS Ohio | Combining Ohio system accounts at retirement |
| Proportionate Retirement Program (PRP) | TRS Texas, TMRS | Texas inter-system combining; **⚠️ CRITICAL: counts ONLY for eligibility, NOT benefit calculation** |
| Service transfers | PSPRS | Automatic transfer between PSPRS employers if contributions left on account |

#### Military service credit terms

| Term | Source System(s) | Notes |
|------|-----------------|-------|
| Military Service Credit | CalPERS, NYCERS, TMRS, KPERS | Up to 4-5 years purchasable; system-specific limits |
| Military Leave of Absence | CalPERS | During-employment military; may be at no cost |
| U.S. Military Leave | DERP | Listed as category of purchasable service |
| USERRA service credit | TRS Texas, TMRS, FRS, all systems | Federal reemployment-based credit; distinct from general military purchase |
| Granted military service | KPERS | Free service credit (up to 5 years) for members returning within 1 year |
| Free military service credit | Nevada PERS | Under USERRA with employer certification |
| Prior active military service | PSPRS | Purchasable; up to 60 months; requires 5 years in system |
| Wartime Service | FRS | Specific term for wartime military purchase |

#### Leave of absence service terms

| Term | Source System(s) | Notes |
|------|-----------------|-------|
| Leave of Absence | CalPERS (multiple sub-types), FRS | CalPERS distinguishes: educational, maternity/paternity, sabbatical, serious illness, service, temporary disability |
| Benefit Protection Leave | IMRF | Service credit during unpaid leave; max 12 months lifetime; requires employer approval |
| Salary Continuance | NHRS | Service accrues during employer-funded disability salary continuance |
| Workers' Compensation Credit | FRS | Retirement credit during WC benefit period; employer pays contributions |
| Leave without pay (LWOP) | PSPRS, Oregon PERS | PSPRS: deducted from credited service; Oregon: disqualifies month if ≥ half month unpaid |
| Absence due to illness or injury | Montana PERA | Purchasable up to 5 years (work-related) |

#### Vesting-related service terms

| Term | Source System(s) | Vesting Period | Notes |
|------|-----------------|---------------|-------|
| Vesting / Vested | All 25 systems | Varies 3-10 years | Universal term |
| Earned service credit (for vesting) | COPERA | 5 years | Purchased service may count; age 65 alternative |
| Qualifying service | PSERS | 10 years (T-E/T-F) | Specific statutory term |
| Qualifying service credit | STRS Ohio | 5/10 years | Narrow definition |
| Credited service (for vesting) | KPERS | 5 years | "Five years of credited service" |
| Membership service (for vesting) | Montana PERA | 5 years | Only membership service counts — not all service credit |

**Vesting periods by system**: MSRS **3 years** · COPERA, DERP, NYCERS, HMEPS, OPERS, STRS Ohio (pre-2013), LAGERS, TRS Texas, TMRS (option), Nevada PERS, Montana PERA, VRS, KPERS **5 years** · FRS (pre-7/1/2011) **6 years** · IPERS **7 years** · FRS (post-7/1/2011), IMRF **8 years** · Utah RS **4 years** · PSERS (T-E/T-F), NHRS, STRS Ohio (post-2013), TMRS (option) **10 years**

#### ⚠️ CRITICAL FLAG: Eligibility vs. benefit calculation service distinctions

| System | Eligibility Term | Benefit Calc Term | Distinction Detail |
|--------|-----------------|-------------------|-------------------|
| **PSPRS** | "Service" (total time incl. LWOP) | "Credited service" (contribution-supported time) | **Most explicit split**. 20 years "service" for eligibility; "credited service" × compensation for benefit |
| **Montana PERA** | "Membership service" (1 month for any contribution in month) | "Service credit" (proportional to hours worked) | Part-timer earns full membership month but fractional service credit |
| **DERP** | "Service credit" (earned only, excl. purchased for Rule of 75/85/IPR) | "Service credit" (earned + purchased for benefit formula) | Same term, different scope depending on context |
| **LACERA** | "County retirement service credit" (earned county service) | "Total service credit" (earned + purchased) | Purchased non-County service excluded from eligibility, disability, survivor, deferred retirement |
| **TRS Texas** | "Service credit" + PRP service | "Service credit" (excl. PRP) | PRP counts for eligibility only; purchased sick leave for benefit only |
| **PSERS** | "Eligibility Points" | "Credited Service" | Usually identical but can diverge under USERRA |
| **FRS** | "Creditable Service" (Pension Plan: both) | Investment Plan: service records used ONLY for vesting/HIS eligibility, not benefit calc | Plan-dependent meaning |
| **STRS Ohio** | "Qualifying service credit" (narrow definition) | "Service credit" (broader) | QSC specifically defined for eligibility thresholds |
| **NYCERS** | "Allowable Service" (special plans) | "Credited Service" (benefit calculation) | Different terms for different plan types (SA-22 vs. Article 11) |
| **Oregon PERS** | Calendar years with 600+ hours (OPSRP vesting) | "Retirement credit" (OPSRP formula) / "Creditable service" (Tier 1/2) | Different measurement units for eligibility vs. benefit |
| **IMRF** | "Service credit" (8 years for vesting) | "Service credit" (in FRE period) | Unused sick days → service credit but **cannot** be used for vesting or 35-year unreduced |

### Domain 2: Final average compensation terminology

#### Primary FAC terms across all 25 systems

| Term | Abbreviation | Source System(s) | Averaging Window | Consecutive? | Notes |
|------|-------------|-----------------|-----------------|-------------|-------|
| Highest Average Salary | HAS | COPERA | 3 years (pre-2020) / 5 years (post-1/1/2020) | Annual salary periods | Uses "annual salaries associated with 12 consecutive months" |
| Average Monthly Salary | AMS | DERP, HMEPS | DERP: 36mo (T1/T2) / 60mo (T3); HMEPS: per statute | Highest consecutive | DERP explicitly uses "highest consecutive months" |
| Final Compensation | — | CalPERS, SDCERS | 12 or 36mo (classic by contract) / 36mo (PEPRA) | Highest consecutive | CalPERS distinguishes "compensation earnable" (classic) vs. "pensionable compensation" (PEPRA) |
| Final Average Compensation | FAC | LACERA | 12mo (Plans A-E, Safety A/B) / 36mo (Plan G, Safety C) | Highest consecutive | Only system using "FAC" as official abbreviation |
| Final Average Salary | FAS | NYCERS, PSERS, OPERS, STRS Ohio, LAGERS, KPERS, Oregon PERS, Utah RS, SDCERS (portal) | Varies widely | Varies | Most common term — **but windows range from 36 to 96 months** |
| Average Final Compensation | AFC | NHRS, FRS, VRS | NHRS: 3/5yr; FRS: 5/8yr; VRS: 36/60mo | NHRS/FRS: highest years; VRS: consecutive months | **⚠️ FALSE COGNATE**: "AFC" = same abbreviation, different windows across 3 systems |
| Final Rate of Earnings | FRE | IMRF | 48mo (Tier 1) / 96mo (Tier 2) | Highest consecutive within last 10 years | **⚠️ UNIQUE TERM** — only IMRF uses "Final Rate of Earnings" |
| Average of highest annual salaries | — | TRS Texas | 3 years (Tier 1/4) / 5 years (Tier 2/3) | Highest, not consecutive | No standard abbreviation used |
| High-five average salary | — | MSRS | 5 highest years | Not consecutive; same start/end date each year | No abbreviation; informally "high-five" |
| Average monthly compensation | AMC | PSPRS | 36mo (Tier 1) / 60mo (Tier 2/3) within last 20/15 years | Highest consecutive | Uses "AMC" — unique abbreviation |
| Average (monthly) compensation | — | Nevada PERS | 36 consecutive months | Highest consecutive | No standard abbreviation found |
| Highest Average Compensation | HAC | Montana PERA | 36mo (pre-7/1/2011) / 60mo (post-7/1/2011) | Highest consecutive | Only Montana PERA uses "HAC" |
| N/A — Accumulation model | — | TMRS | N/A | N/A | **⚠️ CRITICAL**: TMRS does not use FAC; uses account balance + city match + Updated Service Credits |

#### Compensation inclusion/exclusion matrix (migration-critical)

| System | Overtime | Sick Leave Payout | Vacation Payout | Bonuses | Longevity Pay | Shift Differential |
|--------|---------|-------------------|-----------------|---------|---------------|-------------------|
| COPERA | Included in PERA-includable salary | Included per SB18-200 | See sick leave | N/A specified | N/A | N/A |
| DERP | N/A specified | **Pre-2010 hires: INCLUDED** / Post-2010: EXCLUDED | **Pre-2010 hires: INCLUDED** / Post-2010: EXCLUDED | N/A | N/A | N/A |
| CalPERS | **EXCLUDED** | Converted to service credit (not salary) | **EXCLUDED** (lump-sum) | **EXCLUDED** | Via special comp | Via special comp |
| LACERA | Context-dependent | Context-dependent | Context-dependent (Alameda Decision impact) | Context-dependent | N/A | N/A |
| NYCERS | Included up to ceiling (Tier 6: ~$18K cap) | **EXCLUDED** (Tier 6 lump sum) | **EXCLUDED** (Tier 6 lump sum) | N/A | N/A | N/A |
| PSERS | Included per employer reporting | N/A specified | N/A specified | N/A | N/A | N/A |
| NHRS | Included (as "earnable compensation") | **EXCLUDED for non-vested pre-1/1/2012** (unused payout) | Included (holiday/vacation pay) | N/A | Included (longevity) | N/A |
| FRS | Included (certain) | **EXCLUDED** | Included (max 500 hrs lump sum) | **EXCLUDED** | N/A | N/A |
| HMEPS | **EXCLUDED** | N/A specified | N/A specified | **EXCLUDED** | **INCLUDED** | **INCLUDED** |
| OPERS | Based on "earnable salary" (base only) | N/A specified | N/A specified | N/A | N/A | N/A |
| STRS Ohio | N/A (teachers) | N/A | N/A | N/A | N/A | N/A |
| IMRF | Included (but subject to 125% rule) | **EXCLUDED** (ECO plan) | **EXCLUDED** (ECO plan) | Subject to anti-spiking | N/A | N/A |
| IPERS | Included in "covered wages" | Included (used sick pay) | Included (used vacation pay) | N/A | N/A | N/A |
| LAGERS | Included (overtime worked) | Included (used sick/vacation) | **EXCLUDED** (lump-sum payout) | **EXCLUDED** (one-time) | N/A | N/A |
| KPERS | Included (pre-7/1/1993 in 4-yr calc) | **EXCLUDED** (post-7/1/1993 "add-on pay") | **EXCLUDED** (post-7/1/1993 "add-on pay") | N/A | N/A | N/A |
| VRS | Per "creditable compensation" definition | N/A specified | N/A specified | N/A | N/A | N/A |
| PSPRS | **INCLUDED** | **EXCLUDED** (lump-sum unused) | **EXCLUDED** (payment in lieu of) | N/A | N/A | Included (shift differential) |
| Oregon PERS | **INCLUDED** (OPSRP — may be capped) | T1: **INCLUDED**; T2: **INCLUDED**; OPSRP: **EXCLUDED** | T1: **INCLUDED**; T2: **EXCLUDED**; OPSRP: **EXCLUDED** | N/A | N/A | N/A |
| Nevada PERS | **EXCLUDED** | N/A specified | N/A specified | N/A | **INCLUDED** | **INCLUDED** |
| MSRS | N/A specified | **EXCLUDED** (lump-sum payoff) | **EXCLUDED** (lump-sum payoff) | N/A | N/A | N/A |
| Montana PERA | N/A specified | Included if spread month-for-month; **NOT as lump sum** | Included if spread month-for-month; **NOT as lump sum** | **EXCLUDED** (post-7/1/2013) | N/A | N/A |
| Utah RS | Per URS Compensation Table | N/A specified | N/A specified | N/A | N/A | N/A |

#### Anti-spiking rules

| System | Rule | Detail |
|--------|------|--------|
| **IMRF** | **125% rule** | Final 3 months (Tier 1) or 24 months (Tier 2): earnings cannot exceed 125% of any other month in FRE period |
| **IMRF** | **Accelerated Payment (AP)** | Employer pays present value of pension attributable to earnings increases >6% or >1.5× CPI per 12-month period |
| **NYCERS** | **10% cap** | Tier 4: any FAS year cannot exceed avg of prior 2 years by >10%; Tier 6: cannot exceed avg of prior 4 years by >10% |
| **NHRS** | **1.5× cap** | Final 12-month earnable comp capped at 1.5× the higher of prior 12 months or highest year in AFC |
| **NHRS** | **COB averaging** | Compensation Over Base percentage in highest years cannot exceed career average percentage |
| **IPERS** | **121% control-year test** | Highest average salary cannot exceed 121% of "control-year salary" (highest year outside the averaging period) |
| **KPERS** | **15% / 7.5% cap** | KPERS 1: exclude salary increases >15% YoY; KPERS 2: >7.5% YoY |
| **Montana PERA** | **110% cap** | Post-7/1/2013 hires: compensation exceeding 110% of prior year excluded from HAC |
| **Utah RS** | **10% + CPI cap** | Tier 2: year-over-year increase cannot exceed 10% plus CPI-based purchasing power adjustment |
| **CalPERS/LACERA/SDCERS** | **PEPRA restrictions** | Compensation limit: ~$159,733 (SS-coordinated) / ~$191,679 (non-SS) for PEPRA members; non-base pay excluded |
| **Oregon PERS** | **SB 1049 / OT capping** | OPSRP: overtime capped at job-class average |

### Domain 3: Contribution terminology

#### Member contribution terms

| Term | Source System(s) | Notes |
|------|-----------------|-------|
| Member contribution(s) | COPERA, CalPERS, LACERA, SDCERS, HMEPS, TRS Texas, TMRS, VRS, Nevada PERS, Montana PERA | Most common term |
| Employee contribution(s) | DERP, PSERS, NHRS, FRS, OPERS, LAGERS, PSPRS | Second most common term |
| Basic Member Contributions (BMCs) | NYCERS | Required contributions; separate from AMCs |
| Additional Member Contributions (AMCs) | NYCERS | Additional required contributions in some plans |
| Member deposits / Deposits | TMRS | Used interchangeably with "member contributions" |
| Retirement deductions | MSRS | Primary MN term; functionally = member contributions |
| Regular contributions | Montana PERA | Distinguished from "additional contributions" for service purchases |
| Mandatory contributions | NHRS | Primary term |
| Required employee contributions | FRS | Post-7/1/2011 members pay 3% of compensation |

#### Employer contribution terms

| Term | Source System(s) | Notes |
|------|-----------------|-------|
| Employer contribution(s) | Most systems | Universal |
| State contribution | TRS Texas | Employer is the state |
| City contributions | HMEPS | Employer is the city |
| City matching funds | TMRS | **⚠️ UNIQUE**: Applied at retirement, not ongoing; 1:1, 1.5:1, or 2:1 ratio |
| Uniform Contribution Rate | FRS | Single rate per membership class |
| AED / SAED | COPERA | Amortization Equalization Disbursement / Supplemental AED — additional employer components |
| Employer-Pay Contribution Plan (EPC) | Nevada PERS | **⚠️ CRITICAL**: Employer pays 100% of contribution; employee takes salary reduction. Contributions NOT in member account, NOT refundable |
| Noncontributory system | Utah RS (Tier 1), LACERA (Plan E) | Member contribution rate = 0%; employer pays full cost |
| Employer-paid member contributions / "pick-up" | Oregon PERS, OPERS | Employer pays the 6% employee share; IRC 414(h) treatment |
| Normal cost | CalPERS, LACERA | Annual cost of pension benefits; PEPRA members pay ≥50% |

#### Accumulated contributions / account terms

| Term | Source System(s) | Notes |
|------|-----------------|-------|
| Accumulated contributions | NHRS, OPERS, LAGERS, PSPRS, Montana PERA, VRS (statutory), IPERS, LACERA | Most common statutory term; defined as member contributions + interest |
| Accumulated Deductions | NYCERS (Tier 1/2) | Maintained in "Annuity Savings Fund" (ASF) |
| Member Contributions Accumulation Fund | NYCERS (Tier 3/4) | Tier-specific account name |
| Contributions and Interest | PSERS, KPERS | PA/KS term for refundable balance |
| Employee Contributions Account | PSERS | Named account |
| DB Plan account | COPERA | Member's defined benefit plan account |
| Member contribution account | TRS Texas, VRS | Account holding contributions + interest |
| Individual member contribution account | SDCERS | Earns 6.5% annual compounded interest |
| TMRS account / Member account / Account balance | TMRS | Member deposits + interest; city funds NOT included |
| Teachers' Savings Fund | STRS Ohio | Where member contributions deposited |
| Regular account / Variable account | Oregon PERS (Tier 1/2) | Tier 1 regular = guaranteed rate; variable = market (closed 2003) |
| IAP account | Oregon PERS (all post-2003 members) | Individual Account Program; 6% of subject salary |
| Cash Balance Account | HMEPS (Group D) | Notional/bookkeeping account; 1% of pensionable pay + interest |
| Deductions plus interest / Accumulated deductions | MSRS | For refund/death benefit purposes |
| Member account balance | Montana PERA | General term |

#### Refund terms

| Term | Source System(s) | Notes |
|------|-----------------|-------|
| Refund | Universal across systems | Generic term |
| Refund of contributions | DERP, FRS, PSPRS, LAGERS | Common phrasing |
| Contribution refund / Member contribution refund | IMRF | IMRF-specific phrasing |
| Return of contributions | — | Not found as primary term in any system; generic usage |
| Refund of Contributions and Interest | PSERS | Includes interest component |
| Employee Contribution Refund | Nevada PERS | EPC members: no refund (contributions not in member account) |
| Account Withdrawal | STRS Ohio | Cancels membership |
| Withdrawal | LACERA, SDCERS | Post-termination withdrawal of contributions |
| Refund your DB plan account | COPERA | Portal language |
| Withdraw your employee contributions | SDCERS | Forfeits pension right |
| Lump-sum refund | OPERS | Statutory term |
| Application for IPERS Refund | IPERS | Formal document name |
| Repayment of contributions | Nevada PERS | To restore service credit after prior refund |
| Repay a refund | MSRS | To restore forfeited service credit |
| Redeposit of Withdrawn Contributions | CalPERS, LACERA | CA-specific restoration term; cost = original amount + compounded interest |

#### Interest crediting terms

| System | Rate | Term Used | Notes |
|--------|------|-----------|-------|
| COPERA | 3% compounded annually | "Interest on contributions" | Set by PERA Board |
| SDCERS | 6.5% compounded annually (June 30) | "Interest" at discount rate | Highest rate found |
| VRS | 4% compounded annually | "Interest" | On balance as of June 30 |
| KPERS | 4% (post-7/1/1993); 7.75% (pre-7/1/1993) | "Interest" | Credited June 30 based on Dec 31 balance |
| NYCERS | 8.25% (Tier 1/2); 5% (Tier 3/4/6) | "Interest" | Tier-dependent |
| IPERS | 2.91% (CY2026) | "Interest" / "interest dividends" (historical) | Credited annually |
| FRS | 6.5% (pre-7/2011 purchases); 1.3% (post-7/2011 DROP) | "Interest" | Context-dependent rates |
| TMRS | 5% annually | "Interest credits" | Credited Dec 31 on Jan 1 balance |
| Oregon PERS | 7.2% guaranteed (Tier 1 regular); market returns (Tier 2/OPSRP) | "Assumed rate" / "credited interest" | Tier 1 guarantee is unique |
| Montana PERA | Board-set rate | "Regular interest" | Monthly crediting |
| Utah RS (Contributory) | Up to 6.85% | "Interest" | Contributory system only |

#### Pretax / after-tax treatment

| Treatment | Systems |
|-----------|---------|
| **Pretax (IRC 414(h) pick-up)** | COPERA, DERP, CalPERS, LACERA, SDCERS, NYCERS, PSERS (post-12/31/1982), NHRS, FRS, TRS Texas, TMRS, VRS, IPERS, PSPRS, Oregon PERS, Nevada PERS (EES/ERS — employee share is after-tax; see note), MSRS, Montana PERA (post-7/1985) |
| **After-tax (default)** | OPERS (unless employer pick-up plan), LAGERS, KPERS (Kansas state tax; pretax for federal), Nevada PERS (EES/ERS employee share is after-tax and refundable; EPC contributions not attributed to member) |

**⚠️ Nevada PERS contribution plan distinction is critical**: Under Employee/Employer Pay (EES/ERS), the employee's 50% share is after-tax and refundable. Under Employer-Pay Contribution (EPC), the employer pays 100% and contributions are NOT in the member's account and NOT refundable.

---

## LAYER 2 — Synonym and equivalence clusters

### Cluster 1: "Pensionable time" (service credit concept)

**All terms**: service credit, credited service, creditable service, membership service, retirement credit, allowable service, years of service, qualifying service credit, contributing months, earned service credit, equivalent membership service credit, eligibility points

**Systems by primary term used**:
- "Service credit": COPERA, DERP, CalPERS, LACERA, SDCERS, OPERS, IMRF, IPERS, TRS Texas, TMRS, VRS, KPERS, Nevada PERS, Utah RS, Montana PERA
- "Credited service": NYCERS, HMEPS, LAGERS, PSPRS
- "Creditable service": NHRS, FRS, Oregon PERS (Tier 1/2)
- "Retirement credit": Oregon PERS (OPSRP)
- Dual term: Montana PERA ("membership service" + "service credit"), PSPRS ("service" + "credited service")

**⚠️ CRITICAL DISTINCTIONS / MIGRATION RISKS**:
1. **Montana PERA**: "Membership service" (1 full month for any contribution) ≠ "Service credit" (proportional to hours). A part-time employee working 80 hrs/month gets 1 month membership service but 0.5 months service credit. Eligibility uses membership service; benefit formula uses service credit.
2. **PSPRS**: "Service" (total time including LWOP) ≠ "Credited service" (contribution-supported time only). A member with 20 years of "service" but 6 months LWOP has 19.5 years "credited service" in the formula.
3. **Oregon PERS**: "Creditable service" (Tier 1/2) and "Retirement credit" (OPSRP) are different terms for the same concept within the same system. Migration must map both to the same canonical field.
4. **IPERS** measures service in **quarters** (0.25 year increments) — unique unit among all 25 systems. ETL must handle conversion.
5. **TMRS** uses service credit for eligibility but an **accumulation-based model** for benefit calculation — service credit years do NOT directly enter the benefit formula in the traditional sense.

**⚠️ FALSE COGNATES**:
- "Membership service" means earned-after-joining service at NYCERS/LAGERS but means eligibility-only service at Montana PERA
- "Prior service" means pre-system service at LAGERS/IMRF/KPERS but means purchased service from previous positions at VRS/PSPRS
- "Allowable service" means any pensionable service at MSRS but means specific plan eligibility at NYCERS

### Cluster 2: "Salary average for benefit formula" (FAC concept)

**All terms**: Highest Average Salary (HAS), Average Monthly Salary (AMS), Final Compensation, Final Average Compensation (FAC), Final Average Salary (FAS), Average Final Compensation (AFC), Final Rate of Earnings (FRE), Average of highest annual salaries, High-five average salary, Average monthly compensation (AMC), Average compensation, Highest Average Compensation (HAC)

**Abbreviation inventory**: HAS (COPERA), AMS (DERP/HMEPS), FAC (LACERA), FAS (NYCERS/PSERS/OPERS/STRS Ohio/LAGERS/KPERS/Oregon PERS/Utah RS/SDCERS), AFC (NHRS/FRS/VRS), FRE (IMRF), AMC (PSPRS), HAC (Montana PERA)

**⚠️ CRITICAL DISTINCTIONS / MIGRATION RISKS**:

1. **Averaging window variance within same abbreviation "FAS"**: NYCERS 3-5yr, PSERS 3-5yr, OPERS 3-5yr, STRS Ohio 5yr, LAGERS 3-5yr (employer-elected), KPERS 3-5yr, Oregon PERS 3yr, Utah RS 3-5yr. A "FAS" field from OPERS Group C (5 years) is NOT equivalent to "FAS" from Oregon PERS (3 years).

2. **Consecutive vs. non-consecutive**: VRS, PSPRS, Montana PERA, DERP, LAGERS, Nevada PERS, COPERA require highest **consecutive** months. KPERS, TRS Texas, MSRS, STRS Ohio allow highest **non-consecutive** years. OPERS allows either consecutive months or calendar years, whichever is greater. This is a **MIGRATION RISK** — the same abbreviation "FAS" can mean consecutive or non-consecutive depending on the source system.

3. **"Compensation earnable" vs. "Pensionable compensation"**: CalPERS and LACERA use "compensation earnable" for classic members and "pensionable compensation" for PEPRA members. These are legally distinct California terms with different inclusion rules. SDCERS uses "pensionable salary" / "pensionable compensation."

4. **IMRF's "Final Rate of Earnings" is unique**: No other system uses this term. The 48/96-month windows are also the longest among all systems. The 125% anti-spiking rule on final months makes IMRF's FRE calculation fundamentally different from any other system's FAC.

5. **TMRS has no FAC equivalent**: Benefits are calculated from account balance + city match + Updated Service Credits, not from a salary average. **Any canonical model must accommodate this non-FAC approach** or TMRS data cannot be mapped to a FAC field.

6. **Montana PERA sick/vacation treatment is conditional**: Payouts included in HAC only if spread month-for-month (replacing regular pay months); lump-sum to single month is prohibited. This is a unique inclusion rule.

**⚠️ FALSE COGNATES**:
- "AFC" at NHRS (3 or 5 highest years) vs. "AFC" at FRS (5 or 8 fiscal years) vs. "AFC" at VRS (36 or 60 consecutive months) — same abbreviation, three different calculation methodologies
- "Final compensation" at CalPERS (uses "compensation earnable" / "pensionable compensation") vs. "Final compensation" at SDCERS (uses "pensionable salary") — similar terms, different underlying pay definitions
- "Average monthly salary" at DERP vs. HMEPS — DERP uses highest consecutive 36/60 months; HMEPS uses a statutory definition that differs

### Cluster 3: "Member's accumulated money" (contribution/account concept)

**All terms**: accumulated contributions, accumulated deductions, contributions and interest, member contribution account, DB Plan account, individual member contribution account, member account, TMRS account, account balance, Teachers' Savings Fund, regular account, IAP account, Cash Balance Account, member account balance, Annuity Savings Fund, Member Contributions Accumulation Fund, Employee Contributions Account

**⚠️ CRITICAL DISTINCTIONS**:

1. **Account-based vs. pooled**: Most systems pool employer contributions (not individually tracked). TMRS, HMEPS (Group D Cash Balance), Oregon PERS (IAP), STRS Ohio (DC/Combined), and FRS (Investment Plan) maintain individual accounts where employer contributions ARE tracked to members.

2. **Nevada PERS EPC members have no refundable account**: Under the Employer-Pay Contribution Plan, contributions are not deposited to a member account. The concept of "accumulated contributions" does not apply the same way.

3. **NYCERS tier-specific account names**: "Annuity Savings Fund" (Tier 1/2) vs. "Member Contributions Accumulation Fund" (Tier 3/4) — different database tables for same concept.

4. **Oregon PERS has three account types simultaneously**: Regular account (Tier 1/2 pension), Variable account (closed market account), and IAP account (defined contribution). A single member may have all three.

5. **Utah RS "noncontributory" members have no contribution account**: The canonical model must handle members with zero accumulated contributions who still earn pension benefits.

### Cluster 4: "Updated Service Credits" (TMRS-only concept)

**⚠️ NO EQUIVALENT IN ANY OTHER SYSTEM**. TMRS "Updated Service Credits" (USC) are monetary credits recalculated annually comparing actual to hypothetical account balances. They are NOT service credit in the time-worked sense despite the name. **This is the highest-risk false cognate in the entire crosswalk.** The canonical model needs a separate field or mapping approach — USC cannot map to any standard service credit or FAC field.

---

## LAYER 3 — Bidirectional crosswalk table (ETL reference)

### Service credit crosswalk

| Term | Abbrev | Source System | Cluster Concept | Equivalent Terms (Other Systems) | Migration Risk Flag |
|------|--------|--------------|----------------|----------------------------------|-------------------|
| Service credit | SC | COPERA | Pensionable Time | Credited service (NYCERS/HMEPS/LAGERS/PSPRS), Creditable service (NHRS/FRS/Oregon T1-T2), Retirement credit (Oregon OPSRP) | — |
| Service credit | SC | DERP | Pensionable Time | Same as COPERA | ⚠️ Purchased SC excluded from Rule of 75/85/IPR |
| Service credit | SC | CalPERS | Pensionable Time | Same as COPERA | — |
| Service credit | SC | LACERA | Pensionable Time | Same as COPERA | ⚠️ Non-County purchased SC excluded from eligibility/disability/survivor |
| Service Credit | SC | SDCERS | Pensionable Time | Same as COPERA | — |
| Credited Service | CS | NYCERS | Pensionable Time | Service credit (COPERA/DERP/CalPERS et al.) | ⚠️ "Allowable Service" is separate eligibility concept |
| Credited Service / Creditable Service | CS | PSERS | Pensionable Time | Service credit (COPERA et al.) | ⚠️ "Eligibility Points" tracked separately |
| Creditable Service | CS | NHRS | Pensionable Time | Service credit (COPERA et al.) | — |
| Creditable Service | CS | FRS | Pensionable Time | Service credit (COPERA et al.) | ⚠️ Investment Plan: service used only for vesting, not benefit calc |
| Credited Service | CS | HMEPS | Pensionable Time | Service credit (COPERA et al.) | — |
| Service Credit / Contributing Months | SC | OPERS | Pensionable Time | Same as COPERA | ⚠️ "Contributing Months" only in Member-Directed Plan |
| Service credit / Qualifying service credit | SC/QSC | STRS Ohio | Pensionable Time (SC) / Eligibility Service (QSC) | Service credit = COPERA et al.; QSC = Eligibility Points (PSERS) | ⚠️ QSC narrowly defined for eligibility only |
| Service credit / Creditable service | SC | IMRF | Pensionable Time | Same as COPERA | ⚠️ Unused sick days → SC but cannot count for vesting/35-year |
| Service credit(s) | SC | IPERS | Pensionable Time | Same as COPERA | ⚠️ Measured in QUARTERS (0.25 yr); unique unit |
| Credited Service | CS | LAGERS | Pensionable Time | Service credit (COPERA et al.) | ⚠️ Purchased service NOT in FAS calculation |
| Service credit / Membership service credit | SC | TRS Texas | Pensionable Time | Same as COPERA | ⚠️ PRP for eligibility only; purchased sick leave for benefit only |
| Service credit | SC | TMRS | Pensionable Time (eligibility) | Same as COPERA for eligibility | ⚠️ Benefit calc uses account balance model, NOT service × salary |
| Service credit / Creditable service | SC | VRS | Pensionable Time | Same as COPERA | — |
| Service credit / Years of service | SC/YOS | KPERS | Pensionable Time | Same as COPERA | — |
| Service (eligibility) / Credited service (benefit) | — / CS | PSPRS | **DUAL MAPPING** | "Service" → Membership service (Montana PERA); "Credited service" → Service credit (COPERA et al.) | ⚠️⚠️ HIGHEST RISK: Two distinct fields required |
| Creditable service (T1/T2) / Retirement credit (OPSRP) | CS / RC | Oregon PERS | Pensionable Time | Same as COPERA | ⚠️ Different terms within same system by tier |
| Service credit | SC | Nevada PERS | Pensionable Time | Same as COPERA | — |
| Service credit / Allowable service | SC | MSRS | Pensionable Time | Same as COPERA | — |
| Service credit / Years of service credit | SC/YOS | Utah RS | Pensionable Time | Same as COPERA | — |
| Membership service (eligibility) / Service credit (benefit) | MS / SC | Montana PERA | **DUAL MAPPING** | "Membership service" → Service (PSPRS); "Service credit" → Credited service (PSPRS) | ⚠️⚠️ HIGHEST RISK: Two distinct fields required |

### Final average compensation crosswalk

| Term | Abbrev | Source System | Cluster Concept | Equivalent Terms (Other Systems) | Window | Migration Risk Flag |
|------|--------|--------------|----------------|----------------------------------|--------|-------------------|
| Highest Average Salary | HAS | COPERA | Salary Average | FAS/AFC/FRE/HAC/AMC at other systems | 3yr / 5yr | — |
| Average Monthly Salary | AMS | DERP | Salary Average | HAS (COPERA), FAS (NYCERS et al.), AFC (NHRS et al.) | 36mo / 60mo | ⚠️ Sick/vac payout included for pre-2010 hires |
| Final Compensation | — | CalPERS | Salary Average | Same cluster | 12/36mo | ⚠️ "Compensation earnable" (classic) vs. "Pensionable compensation" (PEPRA) are legally distinct |
| Final Average Compensation | FAC | LACERA | Salary Average | Same cluster | 12/36mo | ⚠️ PEPRA salary cap; Alameda Decision exclusions |
| Final Compensation / Final Average Salary | FAS | SDCERS | Salary Average | Same cluster | 12/36mo | ⚠️ PEPRA-style provisions via City Charter |
| Final Average Salary | FAS | NYCERS | Salary Average | Same cluster | 3yr / 5yr | ⚠️ 10% anti-spiking cap (Tier 4/6); OT ceiling (Tier 6) |
| Final Average Salary | FAS | PSERS | Salary Average | Same cluster | 3yr / 5yr school years | — |
| Average Final Compensation | AFC | NHRS | Salary Average | Same cluster | 3yr / 5yr | ⚠️ 1.5× final year cap; COB averaging rule |
| Average Final Compensation | AFC | FRS | Salary Average | Same cluster | 5yr / 8yr fiscal years | ⚠️ Longest standard window (8 fiscal years) |
| Average Monthly Salary | AMS | HMEPS | Salary Average | Same cluster | Per statute | — |
| Final Average Salary | FAS | OPERS | Salary Average | Same cluster | 3yr / 5yr (or last 36/60 months, whichever greater) | ⚠️ Dual calculation: calendar years OR consecutive months |
| Final Average Salary | FAS | STRS Ohio | Salary Average | Same cluster | 5yr | — |
| Final Rate of Earnings | FRE | IMRF | Salary Average | Same cluster | 48mo / 96mo | ⚠️⚠️ HIGHEST RISK: Unique term; longest windows; 125% anti-spiking rule; employer AP charges |
| Highest average salary | — | IPERS | Salary Average | Same cluster | 3yr / 5yr | ⚠️ 121% control-year test |
| Final Average Salary | FAS | LAGERS | Salary Average | Same cluster | 36mo / 60mo (employer-elected) | ⚠️ Window varies by employer within same system |
| Average of highest annual salaries | — | TRS Texas | Salary Average | Same cluster | 3yr / 5yr | — |
| N/A — Accumulation model | — | TMRS | **NO EQUIVALENT** | Cannot map to FAC field | N/A | ⚠️⚠️ HIGHEST RISK: No salary average exists; benefit from account balance |
| Average final compensation | AFC | VRS | Salary Average | Same cluster | 36mo / 60mo | — |
| Final average salary | FAS | KPERS | Salary Average | Same cluster | 3yr / 5yr (non-consecutive) | ⚠️ Non-consecutive highest years; 15%/7.5% anti-spiking |
| Average monthly compensation | AMC | PSPRS | Salary Average | Same cluster | 36mo / 60mo within last 20/15yr | ⚠️ Window restriction within last 20 or 15 years |
| Final Average Salary | FAS | Oregon PERS | Salary Average | Same cluster | 3 calendar years / 36mo | ⚠️ Tier-dependent inclusions (T1 vacation yes; OPSRP no) |
| Average (monthly) compensation | — | Nevada PERS | Salary Average | Same cluster | 36mo | ⚠️ EPC salary adjustment; tight compensation definition |
| High-five average salary | — | MSRS | Salary Average | Same cluster | 5yr (non-consecutive) | ⚠️ Non-consecutive; years can start on any date |
| Final average salary | FAS | Utah RS | Salary Average | Same cluster | 3yr / 5yr | ⚠️ 10% + CPI anti-spiking (Tier 2) |
| Highest Average Compensation | HAC | Montana PERA | Salary Average | Same cluster | 36mo / 60mo | ⚠️ 110% cap (post-2013); conditional sick/vac inclusion |

### Contribution terms crosswalk

| Term | Abbrev | Source System | Cluster Concept | Equivalent Terms | Migration Risk Flag |
|------|--------|--------------|----------------|-----------------|-------------------|
| Member contribution | — | COPERA, CalPERS, LACERA, SDCERS, HMEPS, TRS Texas, TMRS, VRS, Nevada PERS, Montana PERA | Employee Contribution | Employee contribution (DERP/PSERS/NHRS/FRS/OPERS/LAGERS/PSPRS), BMC (NYCERS), Retirement deductions (MSRS) | — |
| Employee contribution | — | DERP, PSERS, NHRS, FRS, OPERS, LAGERS, PSPRS | Employee Contribution | Member contribution at other systems | — |
| Basic Member Contributions | BMC | NYCERS | Employee Contribution | Member/employee contribution at other systems | ⚠️ Separate from AMCs; two deduction lines |
| Retirement deductions | — | MSRS | Employee Contribution | Member/employee contribution at other systems | ⚠️ Unique term |
| Member deposits | — | TMRS | Employee Contribution | Member contribution at other systems | ⚠️ Interchangeable with "contributions" at TMRS |
| Accumulated contributions | — | NHRS, OPERS, LAGERS, PSPRS, Montana PERA, VRS, IPERS, LACERA | Accumulated Balance | Contributions and Interest (PSERS/KPERS), Accumulated Deductions (NYCERS T1/2), DB Plan account (COPERA), Member account (TMRS/Oregon IAP) | — |
| Accumulated Deductions | — | NYCERS (Tier 1/2) | Accumulated Balance | Accumulated contributions at other systems | ⚠️ Maintained in "Annuity Savings Fund" |
| Contributions and Interest | — | PSERS, KPERS | Accumulated Balance | Accumulated contributions at other systems | — |
| Employer-Pay Contribution Plan | EPC | Nevada PERS | Employer-Pays-Member-Share | Noncontributory system (Utah RS T1), Plan E (LACERA), Employer-paid member contributions/"pick-up" (Oregon PERS/OPERS) | ⚠️⚠️ CRITICAL: Member has NO refundable account under EPC |
| Noncontributory | — | Utah RS (Tier 1) | Employer-Pays-Member-Share | EPC (Nevada PERS) | ⚠️ 0% member rate; no member account to refund |
| Updated Service Credits | USC | TMRS | **NO EQUIVALENT** | Cannot map to any standard contribution or service field | ⚠️⚠️ HIGHEST RISK: Monetary credit recalculated annually; NOT service time |

---

## Special flags summary for migration team

### FLAG 1 — Same term, different meanings across systems

| Term | System A Meaning | System B Meaning | Risk Level |
|------|-----------------|-----------------|------------|
| **Membership service** | NYCERS/LAGERS: earned service after joining | Montana PERA: eligibility-only service (not for benefit calc) | 🔴 HIGH |
| **Prior service** | LAGERS/IMRF/KPERS: service before employer joined system | VRS/PSPRS: purchased service from previous public positions | 🟡 MEDIUM |
| **Allowable service** | MSRS: synonym for all service credit | NYCERS: special plan eligibility requirement (not same as credited service) | 🟡 MEDIUM |
| **Service credit** | Most systems: time in benefit formula | Montana PERA: benefit-calc-only service (distinct from membership service for eligibility) | 🔴 HIGH |
| **FAS** | NYCERS: 3yr highest | Oregon PERS: 3 calendar years | FRS uses "AFC" for 5/8yr | 🟡 MEDIUM (window variance) |
| **AFC** | NHRS: 3 or 5 highest years | FRS: 5 or 8 fiscal years | VRS: 36 or 60 consecutive months | 🔴 HIGH |
| **Updated Service Credits** | TMRS: monetary credit recalculation | Would appear to mean additional years of service to uninformed reader | 🔴 HIGH |
| **Normal cost** | CalPERS/LACERA: annual benefit accrual cost (actuarial) | Other systems: rarely used | 🟢 LOW |

### FLAG 2 — Eligibility-only vs. benefit-only vs. both

| System | Eligibility Only | Benefit Calculation Only | Both |
|--------|-----------------|------------------------|------|
| PSPRS | "Service" (total time incl. LWOP) | "Credited service" (contribution-supported) | — |
| Montana PERA | "Membership service" (full month for any contribution) | "Service credit" (proportional hours) | — |
| DERP | Earned service credit only (Rule of 75/85/IPR) | Earned + purchased service credit (benefit formula) | Earned service credit |
| LACERA | County retirement service credit only | Total service credit (earned + purchased) | County earned service |
| TRS Texas | Service credit + PRP service | Service credit only (no PRP) | Core service credit |
| PSERS | "Eligibility Points" | "Credited Service" | Usually same; diverge under USERRA |
| STRS Ohio | "Qualifying service credit" (narrow) | "Service credit" (broad) | Qualifying SC |
| FRS (Inv. Plan) | Creditable service (vesting/HIS only) | N/A (DC plan) | — |
| NYCERS | "Allowable Service" (special plans) | "Credited Service" | Most credited service |
| IMRF | Service credit (but unused sick days excluded from vesting/35-yr) | Service credit (including sick day conversion) | Most service credit |
| Oregon PERS (OPSRP) | Calendar years with 600+ hours | "Retirement credit" | — |
| All other systems | Service credit / credited service | Service credit / credited service | Same term serves both |

### FLAG 3 — Compensation inclusions/exclusions that differ under same term

The most dangerous migration risk occurs when two systems both call their salary average "FAS" but include/exclude different pay components:

- **Overtime**: PSPRS includes; CalPERS excludes; NYCERS caps (Tier 6); IMRF includes but subjects to 125% rule; Nevada PERS excludes; Oregon PERS OPSRP caps at job-class average
- **Sick leave payout**: DERP includes for pre-2010; FRS excludes; NHRS excludes for non-vested; Montana PERA includes if spread over months; CalPERS converts to service credit instead
- **Vacation payout**: DERP includes for pre-2010; Oregon T1 includes/T2 and OPSRP exclude; LAGERS excludes (lump-sum); CalPERS excludes; FRS includes (max 500 hrs)
- **Bonuses**: Montana PERA excludes (post-7/1/2013); HMEPS excludes; LAGERS excludes (one-time)

### FLAG 4 — Anti-spiking rules affecting the compensation figure

| System | Rule Name | Mechanism | Effective Period |
|--------|-----------|-----------|-----------------|
| IMRF | 125% Rule | Final 3/24 months capped at 125% of other FRE months | Ongoing |
| IMRF | Accelerated Payment (AP) | Employer penalty for >6% or >1.5×CPI increases per 12-month period | Post-2/1/2012 retirees |
| NYCERS | 10% FAS cap | Each FAS year ≤ avg of prior 2 years (T4) or 4 years (T6) + 10% | Tier 4 and 6 |
| NHRS | 1.5× final year cap | Last 12 months ≤ 1.5× higher of prior 12 months or highest AFC year | Ongoing |
| NHRS | COB % averaging | Extra/special duty % in highest years ≤ career average % | Post-7/1/2009 |
| IPERS | 121% control-year test | Highest avg salary ≤ 121% of best year outside averaging period | Ongoing |
| KPERS | 15% / 7.5% YoY cap | KPERS 1: exclude >15% increase; KPERS 2: >7.5% increase | Ongoing |
| Montana PERA | 110% cap | Post-7/1/2013 hires: comp >110% of prior year excluded | Post-7/1/2013 hires |
| Utah RS | 10% + CPI cap | Tier 2: YoY increase cannot exceed 10% + CPI adjustment | Tier 2 only |
| CalPERS/LACERA | PEPRA comp cap | $159,733 (SS) / $191,679 (non-SS) for new members | Post-1/1/2013 (PEPRA) |
| SDCERS | PEPRA-style provisions | Certain pay items excluded for post-2013 hires | Via City Charter |
| Oregon PERS | SB 1049 / OT cap | OPSRP overtime capped at job-class average | Post-SB 1049 |
| Nevada PERS | Tight comp definition | Only enumerated pay types included; overtime excluded entirely | Ongoing |

### FLAG 5 — Legacy database field name conventions (where discoverable)

| System | Known Field/Table References |
|--------|---------------------------|
| NYCERS | Annuity Savings Fund (ASF) — Tier 1/2 account; Member Contributions Accumulation Fund — Tier 3/4 |
| SDCERS | MyDERP portal field: "Final Average Salary" (despite official term being "Final Compensation") |
| COPERA | "DB Plan account" — member account identifier |
| Oregon PERS | Regular account, Variable account, IAP account — three distinct account types per member |
| TMRS | Account balance, USC balance, Prior Service Credit — three distinct monetary fields |
| PSERS | Employee Contributions Account, Eligibility Points (separate tracking) |
| HMEPS | Cash Balance Account (Group D), DROP Account — separate from pension benefit |
| IPERS | Service measured in quarters (0.25 increments); covered wages ceiling per IRC §401(a)(17) |
| CalPERS | CERL Pay Codes (classic), PEPRA Pay Codes (PEPRA) — two distinct compensation classification systems |
| LACERA | Plan A/B/C/D/E/G designation drives all calculation rules |
| COPERA | AED and SAED — employer contribution sub-components tracked separately |

---

## Architectural implications for the canonical data model

Three structural patterns emerge that the canonical model must accommodate. **First, the eligibility/benefit service split requires at minimum two service fields** — one for time-based eligibility calculations and one for benefit formula service. Systems like PSPRS and Montana PERA demand this explicitly, while DERP, LACERA, TRS Texas, and PSERS enforce it implicitly through exclusion rules. A single "service_credit" field will cause data loss for at least 10 of the 25 systems.

**Second, TMRS's accumulation model breaks the standard DB formula pattern** of service × multiplier × FAC. The canonical model needs either an alternate benefit calculation pathway or a way to store account-balance-derived benefit amounts alongside formula-derived ones. TMRS's "Updated Service Credits" must map to a monetary field, not a temporal one.

**Third, the averaging window and compensation inclusion rules must be stored as metadata alongside the FAC value itself.** A raw "final_average_salary" number is meaningless without knowing whether it was calculated over 12, 36, 48, 60, or 96 months, whether overtime was included, and whether anti-spiking adjustments were applied. The canonical model should store the calculation parameters as structured metadata to enable audit trails and recalculation during migration validation.

The Nevada PERS employer-pay contribution arrangement and Utah RS noncontributory system present a fourth edge case: **members with full pension eligibility but zero accumulated contributions.** The refund/withdrawal workflow assumes a nonzero member account balance in most systems. The canonical model must handle null or zero contribution balances without triggering validation errors, while still correctly computing pension benefits for these members.