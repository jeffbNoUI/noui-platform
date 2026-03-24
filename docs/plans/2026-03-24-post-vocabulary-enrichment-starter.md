# Session Starter: False Cognate Warning System (D2)

## Context

Session 32 completed **Deliverable 1** of the pension glossary integration — mapper vocabulary enrichment. The mapper registry now has 431 ExpectedNames (up from 299), loaded from `platform/migration/mapper/vocabulary.yaml` via `//go:embed`. Eight false cognate definitions are stored in the YAML but not yet enforced at runtime.

## What to Read First

1. `BUILD_HISTORY.md` — Session 32 entry
2. `docs/plans/2026-03-24-pension-glossary-integration-design.md` — Deliverable 2 spec
3. `platform/migration/mapper/vocabulary.go` — VocabSlot, FalseCognate structs, LoadVocabulary()
4. `platform/migration/mapper/vocabulary.yaml` — false_cognates entries (service-credit, purchased_years, fac-abbreviations)
5. `platform/migration/mapper/template.go` — ColumnMatch struct (needs Warnings field)
6. `platform/migration/mapper/matcher.go` — MatchColumns() Pass 2/3 where warnings should be attached

## Task: Deliverable 2 — False Cognate Warning System

### Backend (1 session)

1. Add `Warnings []MappingWarning` field to `ColumnMatch` in `template.go`
2. Define `MappingWarning` struct: `{Term, Warning, Risk, SourceSystem string}`
3. After Pass 2/3 matching in `matcher.go`, check if the matched term appears in the vocabulary's `false_cognates` list for that slot
4. If it does, attach the warning to the `ColumnMatch` result
5. If the engagement has a `source_system_name`, include system-specific warning text
6. Tests: verify warnings attached for known false cognates (membership_service, prior_service, afc)

### Frontend (1 session, after backend)

1. Yellow warning badge on mapping rows with unacknowledged warnings
2. Warning detail popover showing the false cognate explanation
3. Analyst must acknowledge warning before approving mapping

### Key False Cognates to Test

| Term | Risk | Why Dangerous |
|------|------|---------------|
| membership_service | HIGH | Montana PERA eligibility-only vs NYCERS earned service |
| service_credit (dual) | HIGH | Montana PERA benefit-only vs most systems both |
| prior_service | MEDIUM | LAGERS/IMRF pre-system vs VRS/PSPRS purchased |
| afc | HIGH | NHRS 3/5yr vs FRS 5/8yr vs VRS 36/60mo |
| fas | MEDIUM | Window 36-96mo varies across 9 systems |
| updated_service_credits | HIGH | TMRS monetary, not temporal |

### Verification Gate

- All existing 56 mapper tests still pass
- New tests verify warnings attached to ColumnMatch results
- MatchColumns output includes warnings for false cognate matches
- Warnings are informational only — they do not block matching
