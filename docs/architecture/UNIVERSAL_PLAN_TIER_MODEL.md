# NoUI Universal Plan / Tier Entity Model

**Document type:** Architecture — Tier 1 Governing Document
**Status:** Draft — awaiting Jeff review
**Created:** 2026-03-22
**Scope:** Universal plan/tier structure applicable across all public pension plan configurations in the NoUI corpus
**Feeds:** Plan Configuration Registry (InteliArc), Intelligence Service schema (S1 DDL stream)

---

## Design Principle

**The Tier is the fundamental rule unit.** Every other entity either points to a Tier or resolves through one. A plan with no formal tiering has exactly one Tier record with assignment rule "all members." The variation across systems is in assignment mechanism and the seven configurable modules that hang off every Tier — not in the structural model itself.

COPERA's HAS Tables, LACERA's Plans A–G, CalPERS Classic vs PEPRA, and NYCERS's six tiers all map to this same entity structure. The name a system uses for its cohorts is metadata. The structure is invariant.

---

## Entity Hierarchy

```
System
  └─ 1:N ─ Plan
               └─ N:M ─ Employer
               └─ 1:N ─ Member Category  [optional]
               └─ 1:N ─ Tier              ← the rule unit; min 1
                            └─ Tier Assignment Rules
                            └─ Formula Strategy
                            └─ FAS / AMS / HAS Strategy
                            └─ Eligibility Pathways
                            └─ Reduction Schedule
                            └─ COLA Strategy
                            └─ Contribution Strategy

Member
  └─ 1:N ─ Membership Segment ─── N:1 ──→ Tier
  └─ 0:1 ─ Plan Election           [choice-based systems only]
```

---

## Entity Definitions

### System

The top-level administrative entity. A system operates pension plans, manages assets, employs staff, and maintains member records.

| Variant | Description | Examples |
|---|---|---|
| Single-employer, municipal | One employer, one governance board, one member population | DERP (City of Denver), HMEPS (City of Houston) |
| Multi-employer, statewide | One administration serves many employers' obligations | COPERA (500+ employers), CalPERS (2,906), OPERS (3,700) |
| Multi-employer, county | Pooled county-level system; employer set is bounded and known | LACERA (LA County agencies), SDCERA, OCERS (15+ Orange County entities) |

---

### Plan

A distinct benefit program within a system. Plans differ by job classification, employer, division, or member election. Each plan has its own tier structure and governing authority. Plan-level configuration establishes the governing law citation and any plan-wide constraints (e.g., maximum benefit cap, IRC 415 limits).

| Variant | Description | Examples |
|---|---|---|
| Single plan | One benefit structure, tiers differentiate within it | DERP — 3 tiers by hire date, all members in one plan |
| Multiple plans by classification | Materially different formulas, eligibility, and age factors by job type | CalPERS Miscellaneous vs Safety; LACERA General (Plans A–G) vs Safety (A/B/C) |
| Multiple plans by division | Same base formula across divisions; HAS tables and eligibility rules differ | COPERA: State, School, Local Gov't, DPS, Judicial — same 2.5% multiplier, different HAS tables |
| Choice-based plans | Member makes a permanent, irrevocable election at hire | OPERS: DB / DC / Hybrid (default = DB, ~95% choose); STRS Ohio: DB / DC / Combined |

---

### Member Category

An optional cross-cutting grouping that subdivides members within a plan, typically by job function or employment type. Tier assignment rules and formula parameters frequently differ by category.

| Variant | Description | Examples |
|---|---|---|
| General vs Safety | Safety members (police, fire, corrections) have earlier eligibility, higher age factors, separate COLA | CalPERS, LACERA, SDCERA, OCERS — Safety is a different plan, not a "better" tier |
| Division / sector-based | Different HAS tables and eligibility paths despite sharing the same base formula | COPERA: State vs School vs Local Gov't members use different eligibility thresholds |
| None | Single undifferentiated member population | DERP (all City employees), HMEPS (municipal only — police/fire have entirely separate systems) |

---

### Tier

**The fundamental rule unit.** Each Tier is a complete, self-contained rule set covering benefit formula, FAS strategy, eligibility, reduction, COLA, and contributions. A plan with no formal tiering has exactly one Tier record. The Tier entity is stable regardless of how a given system names its cohorts.

| Variant | Description | Examples |
|---|---|---|
| Hire date range | Most common; tier boundary is a date interval | DERP: 3 tiers. NYCERS: 6 tiers. TRS Texas: 6 tiers. COPERA HAS Tables |
| Reform-split (vesting status) | A reform date splits members based on vesting status at that date, not hire date | COPERA SB18-200: vested before 1/1/2020 → 36-mo HAS; not vested → 60-mo HAS |
| Classic vs PEPRA | Hard 1/1/2013 divide for all California systems; lower factors, longer FAC, compensation cap post-PEPRA | CalPERS, LACERA, SDCERA, OCERS |
| Irrevocable election variant | Same hire cohort permanently diverged onto two tier records via one-time member election | SDCERA: Tier 1 vs Tier A (pre-2002 irrevocable election); different age factors and FAC |
| Single effective tier | All active members under identical rules | Pre-reform single-cohort plans; simple municipal plans without tiering |

---

### Employer

A participating organization that reports payroll, remits contributions, and enrolls members. The Employer–Plan relationship is many-to-many. In multi-employer systems, Employer is a first-class routing dimension for tier assignment.

| Variant | Description | Examples |
|---|---|---|
| Single employer | Plan exists solely to serve one employer's workforce | DERP, HMEPS |
| Fixed employer set | Bounded set of county/regional entities; each may map to different plans by bargaining unit | OCERS: 15 Orange County entities |
| Open enrollment, statewide | Employer management is an operational subsystem | COPERA (500+), CalPERS (2,906), OPERS (3,700) |
| Employer as routing dimension | Employer + bargaining unit determines which tier a member enters | OCERS: (employer code, MOU code) → plan routing matrix |

---

## Tier Rule Modules

Every Tier references exactly one configuration of each module. Modules are independent and composable.

---

### Module 1 — Tier Assignment Rules

The conditions that determine which Tier a member belongs to at enrollment. Rules are evaluated in priority order until one matches. Assignment is typically fixed at enrollment; movement between tiers is governed by specific rules (reinstatement, reform split).

| Variant | Implementation notes | Examples |
|---|---|---|
| Hire date range | Compare hire date against tier effective-date boundaries | DERP T1 (<9/1/2004), T2 (9/1/2004–6/30/2011), T3 (≥7/1/2011) |
| Vesting status at reform date | Query vesting status as of a specific historical date — not a simple date comparison | COPERA SB18-200: vested on 1/1/2020 → old table; not vested → new table |
| Member election (permanent) | Election within N days; default = primary DB option; non-election handled | OPERS: 180 days, default = DB. STRS Ohio: 5-year re-election window then permanent |
| Irrevocable one-time election | Requires deadline tracking; consequence for non-election is permanent (defaults to lower formula) | SDCERA Tier 1 vs A; OCERS Plan J vs P (45-day window) |
| Employer + bargaining unit | Lookup table keyed on (employer code, MOU/bargaining unit code) at time of hire | OCERS multi-employer plan routing matrix |
| Prior system membership (reciprocity) | Cross-system data required; new hire retaining Classic status if joined within 6 months of prior system | CalPERS Classic retention rule |
| Tier reinstatement | Transactional rule; member repays withdrawn contributions + interest; may change tier retroactively | NYCERS: repay withdrawn funds + 5% compound interest to restore original tier |

---

### Module 2 — Formula Strategy

The mathematical pattern used to compute the gross monthly benefit before optional reductions. Each Tier references exactly one formula type, parameterized by that Tier's values.

| Variant | Engine requirement | Examples |
|---|---|---|
| Flat multiplier | Multiplier% × FAS × service | DERP T1 (2.0%), T2/T3 (1.5%); COPERA (2.5%); TRS Texas (2.3% — uniform across all 6 tiers) |
| Age factor table | Graduated factor% by quarter-year of retirement age × FAS × service; requires interpolation engine | CalPERS, LACERA, SDCERA, OCERS — "2.7% at 55" = max factor reached at age 55 |
| Stepped multiplier by service band | Different rates for different service bands, summed | NYCERS: 1.67% (0–20 yrs) / 2.00% (20–30) / 1.50% (>30); HMEPS: similar stepped tables |
| Cash balance / account-based | Contribution + interest credits in notional account → annuity conversion; no FAS calculation | HMEPS Group D; OPERS DC plan; hybrid plan DC component |

---

### Module 3 — FAS / AMS / HAS Strategy

How the salary base for the benefit formula is determined. Three dimensions: (1) number of periods, (2) consecutive or not, (3) compensable pay definition. All pension salary averaging concepts — FAS, AMS, HAS — resolve to this module.

| Variant | Engine requirement | Examples |
|---|---|---|
| Highest N consecutive months | Sliding window over salary history to find the maximum-producing consecutive period | DERP T1/T2: 36 months; DERP T3: 60 months; CalPERS Classic varies by formula |
| Highest N calendar years | Select the N plan fiscal years with highest compensation; years need not be consecutive | STRS Ohio: 5 highest years; TRS Texas: 3 (grandfathered) or 5 years |
| Non-consecutive best periods | Evaluate all possible windows; select the three highest-producing non-consecutive 12-month periods | LACERA Plan E (rare structure — no consecutive requirement) |
| Specific pay-period count | Bi-weekly or other non-monthly units; requires normalization to monthly equivalent | HMEPS: 78 bi-weekly pay periods (unique in corpus) |
| Pensionable compensation (narrow) | Excludes lump-sum cashouts, car/housing allowances, non-recurring pay | All PEPRA plans (CalPERS, LACERA, SDCERA, OCERS post-2013) |
| Leave payout inclusion | Unused sick/vacation payout at separation treated as salary in final period; re-evaluate FAS window with boosted final pay | DERP T1/T2 (hired before 1/1/2010); demonstrated in Case 1 — Robert Martinez |

---

### Module 4 — Eligibility Pathways

A Tier may have multiple retirement eligibility pathways. The engine evaluates all pathways and selects the most favorable. Most Tiers have at least three: normal retirement, an unreduced early path, and a reduced early path.

| Variant | Parameters | Examples |
|---|---|---|
| Rule of N (age + service sum) | N threshold, minimum age, service to include (earned only vs earned + purchased) | DERP T1/T2: Rule of 75, min age 55; T3: Rule of 85, min age 60; COPERA: Rule of 80/85/88/90 by division/date; HMEPS: Rule of 75 |
| Age + service (fixed thresholds) | Age threshold, service threshold; multiple pathways per tier allowed | Age 65 + 5 yrs = universal normal retirement across all systems; COPERA: age 55 + 25 yrs |
| Service only (any age) | Service threshold; no minimum age | LACERA General: 30 yrs any age; Safety: 20 yrs any age; CalPERS Safety legacy |
| Age only (backstop) | Minimum age (typically 70 or 72) | Virtually every system — no member permanently locked out |
| Reduced early retirement | Points to Reduction Schedule module for factor | DERP T1/T2: age 55 + 5 yrs → 3%/yr reduction; T3: age 60 + 5 yrs → 6%/yr reduction |

---

### Module 5 — Reduction Schedule

When a member retires via an early pathway (before meeting an unreduced threshold), the benefit is permanently reduced. This module is referenced by the Eligibility Pathway — the early pathway entity points to it.

| Variant | Engine requirement | Examples |
|---|---|---|
| Flat % per year under threshold | Reduction = years early × rate | DERP T1/T2: 3%/yr under 65; DERP T3: 6%/yr under 65 |
| Graduated table lookup (age + service) | Table lookup: (age at retirement, service years) → reduction factor | COPERA: reduction factor embedded in HAS table, function of both age AND service |
| Actuarial table (non-linear) | Non-linear reduction surface; varies by age and service | STRS Ohio: actuarially derived — more precise, harder to explain in member counseling |
| Null (no early retirement option) | No reduction schedule needed; tier has no early pathway | Some plans require full Rule of N or normal retirement; no early option exists |

---

### Module 6 — COLA Strategy

How post-retirement benefits are adjusted. The highest-variance module across the corpus. Approaches range from zero automatic mechanism to investment-return-linked formulas. COLA often interacts with funded status, investment performance, or legislative action.

| Variant | Engine requirement | Examples |
|---|---|---|
| Discretionary (board action only) | No automatic calculation; external trigger only | DERP; TRS Texas (optional "13th check") |
| CPI-capped, no banking | Annual adjustment ≤ cap; excess permanently lost | CalPERS: 2–3% cap varies by plan and employer contract |
| CPI-capped with banking | Per-retiree COLA Bank tracks excess CPI above cap; drawn on when CPI is below cap | LACERA, SDCERA, OCERS; tier-specific caps (SDCERA T1/A = 3%, B/C/D = 2%) |
| Fixed statutory rate | Predictable for members; system funds regardless of CPI | COPERA: 1.0% (reduced from 2.0% by AAP/SB18-200); OPERS: 3% simple annual |
| Investment-return linked | Requires ongoing feed from investment performance system | HMEPS: half of 5-year trailing return, bounded 2.5–7.5% (unique in corpus) |
| Statutory max, variable grants | Board grants ≤ statutory maximum; actual grants may be lower or zero | STRS Ohio: 2% max; grants frozen 2017–2022; NYCERS: CPI × 50%, capped at 3%, applied to first $18K only |

---

### Module 7 — Contribution Strategy

How the member contribution obligation is structured — rate basis, rate value, and cessation rules. Employer contributions are governed separately (actuarial determination, statutory rate, or corridor mechanism).

| Variant | Engine requirement | Examples |
|---|---|---|
| Flat employee percentage | Single rate applied uniformly | DERP: 8.45%; COPERA: varies by division (~8–10%); STRS Ohio: 14% |
| Wage-band based | Annual rate recalculation from prior-year earnings + band lookup | NYCERS Tier 6: 3% (<$45K) through 6% (>$100K); 5-band lookup table |
| Entry-age based (individualized) | Rate set at join age; adjusted periodically by actuarial review; per-member rate tracking | SDCERA and OCERS legacy tiers |
| 50/50 normal cost sharing | Member pays half of actuarially determined normal cost; rate varies annually | All PEPRA plans (CalPERS, LACERA, SDCERA, OCERS post-2013) |
| Non-contributory | No employee contribution; employer bears full normal cost | LACERA Plan E |
| Cessation at service threshold | Track cessation eligibility separately from rate; service credit continues post-cessation | SDCERA and OCERS legacy: contributions stop at 30 years of service (reciprocal counts) |

---

## Member-Side Entities

### Member

The plan participant. A member belongs to one System and accumulates one or more Membership Segments, each governed by a specific Tier. The member record holds identity, employment, and beneficiary information. Benefit calculation is assembled from segments.

| Variant | Description | Examples |
|---|---|---|
| Standard career member | Single employer, continuous service, one tier, one segment | Overwhelming majority; one calculation path |
| Rehired member | Separated and returned; may enter different tier on return | DERP T1 hire 1998, rehired 2014 → T3; two segments, two tier references |
| Reform-split member | Continuous career intersected by a legislative reform date | COPERA: pre/post SB18-200 (1/1/2020) — two segments, one unbroken career |
| Dual-status member | Simultaneously holds retired segment and new active segment | COPERA BPI documented pain point: suspension of retirement + return to active service |
| Reciprocal / multi-system member | Prior service in another system coordinated; FAS may use salary from multiple systems | California reciprocal systems: CalPERS, LACERA, SDCERA, OCERS |

---

### Membership Segment

A continuous period of active membership under a specific Tier's rules. Each segment has a start date, end date (or open), a Tier foreign key, and accumulated service credit. **The segment is the unit of benefit calculation.** A member's total benefit at retirement is the aggregated result of calculating each qualifying segment under its own Tier's rules.

The term "membership segment" appears explicitly in COPERA's BPI operational documentation as a live operational concept.

| Variant | Description | Examples |
|---|---|---|
| Single segment | Uninterrupted career under one tier | Most common; start = hire date, end = separation or retirement |
| Multi-segment (rehire) | Break in service creates a new segment on return, typically under a different tier | Each segment calculated independently under its own tier's rules |
| Multi-segment (reform split) | Continuous career segmented by a legislative effective date | COPERA 1/1/2020 boundary — not a service break, but a rule-set boundary |
| Dual-status / concurrent | Retired segment + active segment simultaneously on one member | COPERA BPI: requires dedicated dual-status workflow; only active portion eligible for refund |

---

### Plan Election

In choice-based systems, the member makes a permanent (or conditionally revocable) election among plan types or Tier variants at or shortly after hire. Failure to elect defaults to the primary DB option. Election tracking is operationally critical — it is irrevocable and has lifelong consequences.

Present and tracked only in choice-based systems; absent in all others.

| Variant | Description | Examples |
|---|---|---|
| DB / DC / Hybrid | Elect within N days; default = DB; DC election bypasses all formula/FAS/eligibility modules | OPERS: 180 days, ~95% choose DB |
| DB / DC / Combined | Permanent after 5 years; Combined plan carries both a DB formula benefit and a DC account | STRS Ohio: re-election allowed before year 5 only |
| Formula variant election (irrevocable) | Same hire cohort permanently diverges onto two Tier records | SDCERA: Tier 1 vs Tier A — election date and outcome stored indefinitely |
| Deadline-enforced plan election | Must elect within N days; non-election = permanent default to lower formula | OCERS: Plan J vs Plan P, 45-day window; system must enforce deadline consequence |

---

## Relationship Cardinalities

| Relationship | Cardinality | Notes |
|---|---|---|
| System → Plan | 1:N | A system may operate one plan (DERP) or many (CalPERS) |
| Plan → Tier | 1:N (min 1) | A plan with no formal tiering has exactly one Tier record |
| Plan → Member Category | 1:N (optional) | Not all plans use categories |
| Plan ↔ Employer | N:M | A plan may have many employers; an employer may participate in multiple plans |
| Tier → Tier Assignment Rules | 1:N | Multiple rules per tier; evaluated in priority order |
| Tier → Formula Strategy | N:1 | Each tier references one formula type |
| Tier → FAS Strategy | N:1 | Each tier references one salary-averaging strategy |
| Tier → Eligibility Pathway | 1:N | Most tiers have 3–5 pathways |
| Tier → Reduction Schedule | N:0..1 | Optional; null for tiers with no early retirement option |
| Tier → COLA Strategy | N:1 | Each tier references one COLA approach |
| Tier → Contribution Strategy | N:1 | Each tier references one contribution structure |
| Member → Membership Segment | 1:N | Most members have one; rehired and reform-split members have multiple |
| Membership Segment → Tier | N:1 | Each segment governed by exactly one tier |
| Member → Plan Election | 1:0..1 | Present only in choice-based systems |

---

## Corpus Mapping

How each system in the NoUI corpus maps onto this model:

| System | Plan structure | Tier count | Assignment mechanism | Formula type | Notable module variant |
|---|---|---|---|---|---|
| DERP | 1 plan | 3 tiers | Hire date range | Flat multiplier | FAS: leave payout inclusion |
| COPERA | 5 divisions | HAS Tables per division | Hire date + vesting status at 1/1/2020 | Flat multiplier | COLA: 1.0% statutory (AAP-reduced); Eligibility: Rule of 80/85/88/90 |
| CalPERS | Misc + Safety (2 major) | Classic + PEPRA per formula | Hire date / reciprocal retention | Age factor table | Contribution: 50/50 PEPRA cost share |
| LACERA | 8 plans | Classic + PEPRA per plan | Hire date / bargaining unit | Age factor table | FAS: non-consecutive best periods (Plan E); Contribution: non-contributory (Plan E) |
| SDCERA | 5 tiers | Legacy hire date + irrevocable election (Tier 1 vs A) | Hire date + one-time election | Age factor table | COLA: banking mechanism; Contribution: entry-age based + 30-yr cessation |
| OCERS | 10+ named plans | Legacy + PEPRA | Employer + bargaining unit routing matrix | Age factor table | COLA: banking + STAR COLA; Election: 45-day irrevocable deadline |
| NYCERS | 6 tiers | Membership date (Tier 5 does not exist in NYCERS) | Membership date + reinstatement | Stepped multiplier | Contribution: wage-band based (Tier 6) |
| OPERS | 3 plan choices | DB / DC / Hybrid | Member election (180-day window, default DB) | Flat multiplier (DB) / Account-based (DC) | Plan Election entity required |
| STRS Ohio | 3 plan choices | DB / DC / Combined | Member election (permanent after 5 yrs) | Flat multiplier (DB) / Account-based (DC) | COLA: statutory max, variable grants (frozen 2017–2022) |
| TRS Texas | 6 tiers | Hire date range | Hire date range | Flat multiplier (uniform 2.3% across all tiers) | FAS: 3 vs 5 highest years by tier |
| HMEPS | 3 groups | Hire date + DC hybrid (Group D) | Hire date range | Stepped multiplier (A/B) + Cash balance (D) | COLA: investment-return linked; FAS: 78 bi-weekly periods |

---

## Implementation Notes for InteliArc Rules Engine

1. **Tier is always required.** The rules engine must always resolve to a Tier before any benefit calculation can proceed. A member with no resolvable Tier is an error state, not a null state.

2. **Segment is the calculation unit.** Benefit computation is invoked once per qualifying Membership Segment, under that segment's Tier rules. The final benefit is an aggregation across segments — not a single pass over the member record.

3. **Age factor table is an engine module, not a parameter.** The flat multiplier and age factor table are materially different calculation paths. Adding age factor table support to InteliArc requires a distinct calculation service — not just a different value in a field.

4. **Assignment rule priority matters.** When multiple assignment rules apply (e.g., OCERS reciprocal retention + hire date), the highest-priority matching rule wins. The rules engine must evaluate in declared order and stop at first match.

5. **COLA banking requires per-retiree state.** LACERA, SDCERA, and OCERS COLA banking accumulates per-retiree over years. This is ongoing stateful computation, not a one-time calculation — it requires a COLA Bank balance record per retiree that is updated annually.

6. **Plan Election is not a module — it IS the Tier assignment.** In choice-based systems, the election record stores the outcome; the Tier assignment rule then reads the election record. The Tier itself doesn't change — the assignment path through it does.

---

## Document Governance

| Item | Value |
|---|---|
| Authority tier | Tier 1 — Governing Architecture Document |
| Supersedes | None (new document) |
| Related documents | `noui-competitive-landscape-analysis.docx`, pension plan profiles (CalPERS, NYCERS, OPERS, STRS Ohio, TRS Texas, HMEPS, SDCERA, OCERS, LACERA), `pera-research-intelligence.docx` |
| Next action | Jeff review and approval; upon approval, promotes to input for Plan Configuration Registry schema design (S1 stream) |
| Claude Code | Not yet — analysis document; feeds future S1 DDL design session when Plan Configuration Registry build begins |
