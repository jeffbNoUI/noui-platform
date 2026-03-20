# Rules Explorer Redesign — Three-Level Card Drill-Down

**Date:** 2026-03-20
**Goal:** Replace the flat list Rules Explorer with a visually appealing card-based drill-down matching the Demo Cases and Member Portal patterns.

## Navigation Flow

```
Level 1: Domain Cards → Level 2: Rule Cards → Level 3: Rule Detail
```

Three-level drill-down with breadcrumb navigation and contextual search at every level.

## Level 1 — Domain Cards

Responsive card grid (1 col mobile, 2 cols tablet, 3 cols desktop). Each card represents a rules domain:

| Domain | Approx Rules | Examples |
|--------|-------------|---------|
| Eligibility | ~10 | Vesting, Normal Ret, Rule of 75/85, Early Ret, Deferred |
| Benefits | ~7 | Tier 1/2/3 formulas, Reduction, Rounding, COLA |
| Salary & AMS | ~4 | AMS Window, AMS Calc, Leave Payout, Furlough |
| Service Credit | ~4 | Earned, Purchased, Separation, IPR |
| Payment Options | ~7 | Maximum, J&S 100/75/50, Default, Spousal Consent |
| DRO | ~6 | Marital Share, Sequence, Methods, No-IPR, No-Health |
| Tiers & Contributions | ~5 | Tier 1/2/3 Classification, EE Rate, ER Rate |
| Death Benefits | ~5 | Normal, Early T1/2, T3, Election, Reemployment |
| Process & Compliance | ~4 | App Deadline, Notarization, Payment Cutoff, Irrevocability |

**Card contents:**
- Domain name (heading)
- Rule count (e.g., "10 rules")
- Progress ring — small circular indicator showing % of rules with passing tests (green fill, gray remainder)

**Interactions:**
- Hover: shadow-md, border color shift, slight lift (-2px)
- Click: drill into Level 2

**Search:** Filters domain cards by name.

**Summary bar:** Overall stats — "13/52 passing", "Last tested 16m ago"

## Level 2 — Rule Cards

Same responsive card grid. Shows all rules for the selected domain.

**Card contents:**
- Full rule name as heading (no truncation — wraps if needed)
- Description text (2-3 lines, natural wrap)
- Test badge bottom-right: green "8/8" (all pass), red "2/4" (failures), gray dash (no tests)
- Left border accent: green (all passing), red (failures), gray (no tests)

**Interactions:**
- Hover: shadow-md, border color shift, slight lift
- Click: drill into Level 3

**Search:** Filters rule cards by name, ID, or description within the domain.

**Summary bar:** Domain-scoped — "4/10 passing in Eligibility"

**Breadcrumb:** Rules Explorer > Eligibility

## Level 3 — Rule Detail

Reuses existing `RuleDetail` component (4 tabs: Logic, Inputs/Outputs, Tests, Governance). Changes:

- Breadcrumb navigation replaces "Back to list" button: "Rules Explorer > Eligibility > RULE-VESTING"
- Clickable breadcrumb segments navigate to that level

**Search:** Stays visible; filters within the detail context or provides quick jump to another rule.

**Summary bar:** Single rule stats — "1/1 passing" or "8/8 passing"

## Visual Patterns (Reuse Existing)

- Card styling: matches Demo Cases `CaseCard` — white bg, rounded-lg, border, shadow-sm, hover transitions
- Grid: matches `CaseCardGrid` responsive breakpoints
- Progress ring: new component, small (32-40px), SVG-based
- Breadcrumb: new component, simple clickable text segments with ">" separators
- Summary bar: adapts existing `RulesSummaryBar` to accept domain/rule-scoped data

## Components to Create/Modify

**New:**
- `DomainCard.tsx` — Level 1 card with progress ring
- `DomainCardGrid.tsx` — Responsive grid for domain cards
- `RuleCardGrid.tsx` — Responsive grid for rule cards (Level 2)
- `ProgressRing.tsx` — Small SVG circular progress indicator
- `Breadcrumb.tsx` — Clickable breadcrumb navigation

**Modify:**
- `RulesExplorer.tsx` — Three-level state management (domain → rule → detail)
- `RuleCard.tsx` — Redesign from list row to card with full name, description, colored left border
- `RulesSummaryBar.tsx` — Accept domain-scoped and rule-scoped data
- `DomainFilter.tsx` — Remove (replaced by domain cards)

**Reuse as-is:**
- `RuleDetail.tsx` — Keep 4-tab detail view
- Logic renderers (Conditional, Formula, LookupTable, Procedural)

## Domain Mapping

Rules are currently all tagged as "General" domain. The redesign needs a mapping from rule IDs to the 9 domain categories. This mapping lives in the frontend (a simple object/map) since the YAML files don't have fine-grained domain tags.
