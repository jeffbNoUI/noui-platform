# Design: Vocabulary YAML + Mapper Enrichment (Sprint 13 D1)

**Date:** 2026-03-25
**Parent design:** `docs/plans/2026-03-24-pension-glossary-integration-design.md`
**Sprint:** 13, Deliverable 1

---

## Goal

Extract the pension glossary crosswalk (25 systems, 500+ lines) into a structured YAML vocabulary file, then enrich the migration mapper's ExpectedNames arrays from ~355 to ~600+ entries. This increases Pass 2 (pattern match, confidence 0.9) hit rate and reduces fallback to Pass 3 similarity (0.6) and Pass 4 type-only (0.3) matching.

## Architecture

**Approach: YAML file loaded at init, merged into registry**

- `domains/pension/terminology/vocabulary.yaml` — structured source of truth
- `platform/migration/mapper/vocabulary.go` — YAML parser + loader
- Registry baseline (hardcoded in registry.go) remains; YAML terms are additive
- False cognate metadata stored in YAML but not acted on until D2

This approach was chosen over inline expansion of registry.go because:
1. The YAML file enables D2's false cognate warning system (needs `systems` + `warning` metadata per term)
2. Non-engineers can review/update vocabulary without Go code changes
3. Structured format supports future per-engagement vocabulary filtering (Tier 1 system filter)

## Files

| File | Action | Purpose |
|------|--------|---------|
| `domains/pension/terminology/vocabulary.yaml` | Create | Glossary extraction — terms, abbreviations, systems, false cognates |
| `platform/migration/mapper/vocabulary.go` | Create | `LoadVocabulary(path) → Vocabulary` parser; `EnrichRegistry(r, v)` merge function |
| `platform/migration/mapper/vocabulary_test.go` | Create | YAML parse, enrichment coverage, no-duplicate assertions |
| `platform/migration/mapper/registry.go` | Modify | Add ~250 new terms to ExpectedNames across 7 concept categories |
| `platform/migration/mapper/registry_test.go` | Modify | Update count assertions for enriched names |

## YAML Schema

```yaml
# domains/pension/terminology/vocabulary.yaml
version: "1.0"
source: "docs/pension-glossary.md"
systems:
  - COPERA
  - DERP
  # ... all 25

concepts:
  service-credit:
    credited_years_total:
      terms:
        - name: service_credit
          abbrev: SC
          systems: [COPERA, DERP, CalPERS, LACERA, SDCERS, OPERS, IMRF, IPERS, TRS_Texas, TMRS, VRS, KPERS, Nevada_PERS, Utah_RS, Montana_PERA]
        - name: credited_service
          abbrev: CS
          systems: [NYCERS, HMEPS, LAGERS, PSPRS]
        # ... more terms
      false_cognates:
        - term: membership_service
          warning: "Montana PERA = eligibility-only service; NYCERS/LAGERS = earned service"
          risk: HIGH
        # ... more warnings

  salary-history:
    gross_amount:
      terms:
        - name: pensionable_pay
          systems: [COPERA]
        - name: compensation_earnable
          systems: [CalPERS]
        # ...
      false_cognates:
        - term: AFC
          warning: "NHRS (3/5yr) vs FRS (5/8yr) vs VRS (36/60mo) — same abbreviation, different windows"
          risk: HIGH
```

## Enrichment targets (from glossary analysis)

| Concept Tag | Slot | Current count | New terms | Post-enrichment |
|-------------|------|--------------|-----------|-----------------|
| service-credit | credited_years_total | 6 | +12 | ~18 |
| service-credit | service_type | 5 | +8 (purchased, military, transferred types) | ~13 |
| salary-history | gross_amount | 8 | +10 (pensionable pay, comp earnable, etc.) | ~18 |
| salary-history | pensionable_amount | 7 | +8 (HAS, AMS, FAC, FAS, AFC, FRE, HAC, AMC) | ~15 |
| salary-history | period_start/end | 8 each | +5 each (SAL_EFF_DT, PAY_START_DATE, etc.) | ~13 each |
| benefit-deduction | ee_amount | 7 | +6 (BMC, retirement_deductions, member_deposits, etc.) | ~13 |
| benefit-deduction | er_amount | 6 | +5 (AED, SAED, city_contributions, etc.) | ~11 |
| benefit-payment | gross_amount | 4 | +8 (FAS, AFC, FRE, benefit abbrevs) | ~12 |
| employee-master | original_hire_date | 7 | +3 (membership_date, enrollment_date, etc.) | ~10 |

**Estimated total: ~355 → ~600+ ExpectedNames entries**

## Validation

1. `TestVocabularyParses` — YAML loads without error
2. `TestAllVocabTermsInRegistry` — every term in vocabulary.yaml appears in at least one ExpectedNames array
3. `TestNoExpectedNameDuplicates` — no duplicate entries within a single slot
4. `TestExpectedNamesAreLowercase` — existing test still passes (new terms must be lowercase)
5. Existing matcher_test.go passes unchanged — enrichment only adds, never removes

## Deferred to D2

- `Warnings []MappingWarning` field on `ColumnMatch`
- False cognate check in `MatchColumns()` after Pass 2/3
- Frontend warning badge rendering
- Per-engagement vocabulary filtering
