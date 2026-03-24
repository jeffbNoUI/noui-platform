# Design: Pension Glossary Integration

**Date:** 2026-03-24
**Source:** `docs/pension-glossary.md` — 25-system crosswalk covering service credit, compensation, and contribution terminology
**Sprint target:** 13 (Deliverable 1), 14 (Deliverables 2-3)

---

## Problem Statement

The migration mapper has ~355 expected name patterns across 56 template slots. The pension glossary documents 14 terms for "pensionable time," 11 for "salary average," and dozens of contribution/account variants across 25 real pension systems. Without this vocabulary, the mapper falls back to similarity scoring (Pass 3, confidence ≤0.75) or type-only matching (Pass 4, confidence 0.3) for most legacy pension columns.

More critically, the glossary identifies **false cognates** — terms that look identical but mean different things at different agencies. A naive synonym expansion would make these worse, not better.

---

## Three Deliverables

### Deliverable 1: Mapper Synonym Enrichment (Sprint 13, ~1 session)

**Goal:** Expand `ExpectedNames` arrays in `platform/migration/mapper/registry.go` from ~355 to ~600+ entries using the glossary's Layer 1 and Layer 3 crosswalk tables.

**Scope:** The following mapper template slots benefit directly:

| Template (concept tag) | Slot | Current expected names | New names from glossary |
|------------------------|------|----------------------|------------------------|
| `service-credit` | `credited_years_total` | 5 | +12 (SC, CS, creditable service, retirement credit, YOS, etc.) |
| `service-credit` | `purchased_years` | 3 | +8 (PSC, buy-back, redeposit, reinstated, restored, etc.) |
| `service-credit` | `military_service_years` | 2 | +6 (USERRA, granted military, prior active military, etc.) |
| `salary-history` | `gross_amount` | 5 | +10 (pensionable pay, compensation earnable, pensionable comp, etc.) |
| `salary-history` | `effective_date` | 4 | +5 (SAL_EFF_DT, PAY_START_DATE, etc.) |
| `benefit-payment` | `benefit_amount` | 4 | +8 (FAS, AFC, FRE, HAC, AMC, HAS, AMS, etc.) |
| `employee-master` | `original_hire_date` | 5 | +3 (membership_date, enrollment_date, etc.) |

**Implementation:**
1. Parse glossary crosswalk tables into structured YAML: `domains/pension/terminology/vocabulary.yaml`
2. Write a Go test that loads vocabulary.yaml and verifies every term appears in the registry
3. Add new terms to registry.go `ExpectedNames` arrays
4. Run mapper against PRISM seed schema to measure confidence improvement
5. Seed intelligence corpus with pre-approved mappings from the crosswalk

**Structured vocabulary format:**
```yaml
# domains/pension/terminology/vocabulary.yaml
service-credit:
  credited_years_total:
    terms:
      - { name: "service_credit", systems: [COPERA, DERP, CalPERS, LACERA, SDCERS, OPERS, IMRF, IPERS, TRS_Texas, TMRS, VRS, KPERS, Nevada_PERS, Utah_RS, Montana_PERA] }
      - { name: "credited_service", systems: [NYCERS, HMEPS, LAGERS, PSPRS] }
      - { name: "creditable_service", systems: [NHRS, FRS, Oregon_PERS, VRS, IMRF] }
      - { name: "retirement_credit", systems: [Oregon_PERS] }
      - { name: "allowable_service", systems: [MSRS] }
      - { name: "years_of_service", abbrev: "YOS", systems: [KPERS, Utah_RS, TRS_Texas] }
      - { name: "qualifying_service_credit", abbrev: "QSC", systems: [STRS_Ohio, PSERS] }
      - { name: "contributing_months", systems: [OPERS] }
      - { name: "earned_service_credit", systems: [COPERA, LACERA] }
      - { name: "eligibility_points", abbrev: "EP", systems: [PSERS] }
    false_cognates:
      - { term: "membership_service", warning: "NYCERS/LAGERS = earned service; Montana PERA = eligibility-only service", risk: "HIGH" }
      - { term: "prior_service", warning: "LAGERS/IMRF/KPERS = pre-system service; VRS/PSPRS = purchased from previous positions", risk: "MEDIUM" }
      - { term: "allowable_service", warning: "MSRS = all service credit; NYCERS = special plan eligibility only", risk: "MEDIUM" }
```

**Validation gate:** Mapper confidence on PRISM seed columns should increase — measure mean confidence before/after on the 21 source tables.

---

### Deliverable 2: False Cognate Warning System (Sprint 13-14, ~2 sessions)

**Goal:** When the mapper encounters a known false cognate, attach a structured warning to the mapping result so the analyst sees it in the UI before approving.

**Source data:** Glossary FLAG 1 (same term/different meanings) and FLAG 2 (eligibility-only vs benefit-only distinctions). There are 8 high/medium-risk false cognates and 11 systems with eligibility/benefit service splits.

**Architecture:**

```
Mapper match result
    ↓
False cognate check (term + source_system → warning lookup)
    ↓
MappingResult.warnings[]  ← new field
    ↓
Frontend renders warning badge on mapping row
    ↓
Analyst must acknowledge warning before approving
```

**Implementation:**
1. Add `Warnings []MappingWarning` field to `ColumnMatch` in `platform/migration/mapper/template.go`
2. Load false cognate definitions from vocabulary.yaml
3. After Pass 2/3 matching, check if matched term is in false_cognates list
4. If source system is known (from engagement metadata), include system-specific warning text
5. Frontend: yellow warning badge on mapping rows with unacknowledged warnings
6. Intelligence corpus: record whether analyst changed the mapping after seeing the warning (feedback loop)

**Key false cognates to handle:**

| Term | Risk | Systems affected |
|------|------|-----------------|
| membership_service | HIGH | Montana PERA vs NYCERS/LAGERS |
| service_credit (dual meaning) | HIGH | Montana PERA (benefit-only vs COPERA (both) |
| prior_service | MEDIUM | LAGERS/IMRF/KPERS vs VRS/PSPRS |
| allowable_service | MEDIUM | MSRS vs NYCERS |
| AFC (abbreviation) | HIGH | NHRS (3/5yr) vs FRS (5/8yr) vs VRS (36/60mo) |
| FAS (abbreviation) | MEDIUM | Window ranges 36-96 months across systems |
| Updated Service Credits | HIGH | TMRS only — monetary, not temporal |

---

### Deliverable 3: Canonical Model Evolution (Sprint 14+, requires design session)

**Goal:** Evolve the canonical data model to handle the structural patterns identified in the glossary's architectural implications section.

**Four changes needed:**

#### 3a. Dual service credit fields
Currently: single `service_credit_years` in canonical members.
Needed: `eligibility_service` and `benefit_service` as separate fields.

Systems requiring this: PSPRS, Montana PERA, DERP, LACERA, TRS Texas, PSERS, STRS Ohio, FRS (Investment Plan), NYCERS, IMRF, Oregon PERS (OPSRP). The existing DERP Service Purchase Exclusion rule in CLAUDE.md is a specific instance of this general pattern.

**Impact:** Migration reconciliation Tier 1 comparisons must use the correct service field depending on whether they're validating eligibility or benefit amount.

#### 3b. TMRS accumulation model pathway
TMRS uses account balance + city match + Updated Service Credits instead of service × multiplier × FAC. The canonical model needs an alternate benefit derivation pathway.

**Impact:** Reconciliation Tier 1 cannot use the standard formula for TMRS engagements. The plan-config.yaml needs a `benefit_model: "accumulation"` flag.

#### 3c. FAC metadata
A raw `final_average_salary` number is meaningless without: averaging window (12-96 months), consecutive vs non-consecutive, compensation inclusions/exclusions, anti-spiking adjustments applied.

**Proposed:** Add `fac_metadata JSONB` column to canonical salary records:
```json
{
  "window_months": 36,
  "consecutive": true,
  "includes_overtime": false,
  "anti_spiking_rule": "110% cap",
  "source_system_term": "HAC"
}
```

#### 3d. Zero-contribution member handling
Nevada PERS (EPC) and Utah RS (Tier 1 noncontributory) have members with full pension eligibility but zero accumulated contributions. The refund/withdrawal workflow must handle null/zero contribution balances.

**Impact:** Validation rules that flag zero-balance members as data quality issues need a system-level override.

---

## Sprint Sequencing

| Sprint | Deliverable | Effort | Dependencies |
|--------|-------------|--------|--------------|
| 13 | D1: Vocabulary YAML + mapper enrichment | 1 session | None |
| 13 | D1: Intelligence corpus seed | 0.5 session | D1 vocabulary |
| 13-14 | D2: False cognate warnings (backend) | 1 session | D1 vocabulary |
| 14 | D2: False cognate warnings (frontend) | 1 session | D2 backend |
| 14+ | D3a: Dual service fields | Design session + 1 impl session | D1 |
| 14+ | D3b: TMRS accumulation pathway | Design session | D3a |
| 14+ | D3c: FAC metadata | 1 session | D1 |
| 14+ | D3d: Zero-contribution handling | 0.5 session | None |

---

## Starter Prompt for Deliverable 1

```
Read docs/plans/2026-03-24-pension-glossary-integration-design.md (Deliverable 1).
Read docs/pension-glossary.md (full glossary).
Read platform/migration/mapper/registry.go (current templates).

Task: Extract the glossary crosswalk tables into domains/pension/terminology/vocabulary.yaml,
then enrich the mapper registry ExpectedNames arrays with the new terms.
Measure confidence improvement on PRISM seed schema before/after.
```

---

## Per-Engagement Customization

The platform glossary (`domains/pension/terminology/vocabulary.yaml`) is the **base vocabulary** — a union of all known terms across 25 systems. Each engagement can customize this vocabulary to match its specific source system and client conventions.

### Three-Tier Vocabulary Resolution

```
Tier 1: Platform vocabulary (vocabulary.yaml)
    ↓ filtered by source_system_name
Tier 2: Engagement overrides (stored in engagement JSONB config)
    ↓ analyst edits via UI
Tier 3: Analyst decisions (intelligence corpus)
```

**Tier 1 — Platform base:** The full 25-system crosswalk. When an engagement specifies `source_system_name: "COPERA"`, the mapper filters to COPERA-relevant terms first, then falls back to the full set. This avoids false cognate collisions (e.g., Montana PERA's "membership service" won't appear as a high-confidence match for a COPERA engagement).

**Tier 2 — Engagement overrides:** Stored in `engagement.config_json` as a vocabulary overlay. Supports:
- **Adding terms**: Client's legacy system uses non-standard column names not in the glossary
- **Removing terms**: A term from the base vocabulary doesn't apply to this engagement
- **Overriding warnings**: A false cognate warning that doesn't apply to this specific system
- **Custom false cognates**: Client-specific terms that need disambiguation warnings

```json
// engagement.config_json.vocabulary_overrides
{
  "service-credit": {
    "credited_years_total": {
      "add_terms": ["SVC_YRS_EARNED", "PENSION_CREDIT"],
      "remove_terms": ["contributing_months"],
      "suppress_warnings": ["membership_service"]
    }
  },
  "salary-history": {
    "gross_amount": {
      "add_terms": ["COMP_EARNABLE_AMT"],
      "add_false_cognates": [
        { "term": "SALARY_TOTAL", "warning": "Includes non-pensionable stipends at this agency", "risk": "MEDIUM" }
      ]
    }
  }
}
```

**Tier 3 — Analyst decisions:** As analysts approve or reject mappings, their decisions feed back into the intelligence corpus. Over time, the corpus learns system-specific patterns that supplement the vocabulary. This layer is automatic — no configuration needed.

### UI Workflow

1. **Engagement creation**: Admin selects source system from dropdown (populated from vocabulary.yaml system list). Mapper auto-filters vocabulary to that system.
2. **Mapping review**: Analyst sees generated mappings with confidence scores. False cognate warnings appear as yellow badges.
3. **Vocabulary editor** (new panel): Analyst can view the active vocabulary for this engagement, add custom terms, suppress irrelevant warnings. Changes saved as Tier 2 overrides.
4. **Approval**: Analyst approves/rejects mappings. Decisions recorded in Tier 3 corpus.

### API Surface

```
GET  /api/v1/migration/engagements/{id}/vocabulary
     → Returns merged vocabulary (Tier 1 filtered + Tier 2 overrides)

PATCH /api/v1/migration/engagements/{id}/vocabulary
     → Update Tier 2 overrides (add_terms, remove_terms, etc.)

GET  /api/v1/migration/vocabulary/systems
     → Returns list of known source systems from vocabulary.yaml
```

### Migration to New Systems

When onboarding a new pension system not in the glossary:
1. Create engagement with `source_system_name: "NEW_SYSTEM"`
2. Mapper uses full base vocabulary (no system filter)
3. Analyst reviews mappings, adds custom terms via vocabulary editor
4. After engagement completion, admin can promote engagement overrides to the platform vocabulary for future use

---

## Key Principles

1. **Synonyms expand matching; false cognates require warnings** — never add a false cognate to ExpectedNames without a corresponding warning definition
2. **System context matters** — the same column name means different things at different agencies; the engagement's source_system_name is the disambiguation key
3. **Vocabulary is externalized** — YAML file is the source of truth, not hardcoded in Go; enables future updates without code changes
4. **Analyst always decides** — warnings inform but never block; the system shows its work
5. **Customization is layered** — platform base → engagement overrides → analyst decisions; each tier can add, remove, or modify terms from the tier above
6. **Overrides are portable** — engagement vocabulary overrides can be promoted to the platform base after validation, building institutional knowledge over time
