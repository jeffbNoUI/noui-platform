# Session Starter: Canonical Model Evolution (D3-B) or Sprint 13 Continuation

## Context

Session 36 completed **Deliverable 3A** — warning acknowledgment persistence. The full false cognate warning pipeline is now end-to-end:

1. **Vocabulary YAML** defines false cognates with risk levels (D1)
2. **Backend** computes warnings at generation time AND enriches `ListMappings` responses on read (D2)
3. **Frontend** shows colored warning badges, click-to-open popovers, acknowledgment gate blocking approval (D2)
4. **Persistence** — analyst acknowledgments stored in `migration.warning_acknowledgment` table, survive page navigation, loaded via LEFT JOIN in `ListMappings` (D3-A)

## What to Read First

1. `BUILD_HISTORY.md` — Session 36 entry
2. `db/migrations/031_warning_acknowledgment.sql` — acknowledgment table schema
3. `platform/migration/api/mapping_handlers.go` — `AcknowledgeMapping` handler, `ListMappings` LEFT JOIN
4. `frontend/src/components/migration/engagement/MappingPanel.tsx` — server-backed `m.acknowledged` state
5. `docs/plans/2026-03-24-pension-glossary-integration-design.md` — D3-B canonical model spec

## Option A: D3-B — Canonical Model Evolution

From the pension glossary design doc, enhance the canonical schema for pension-specific nuances:

**Schema changes:**
- Dual service fields: `earned_service` + `purchased_service` separation (currently `credited_years_total` conflates both)
- TMRS accumulation pathway metadata (monetary vs temporal service credit)
- FAC canonical field with anti-spiking rule metadata (window length varies 36-96 months across systems)

**Key constraint:** Purchased service credit counts toward BENEFIT CALCULATION but NOT toward Rule of 75/85/IPR eligibility. This distinction must be explicit in the canonical model.

**Files likely touched:**
- `domains/pension/schema/` — canonical table definitions
- `platform/migration/mapper/vocabulary.yaml` — slot-level metadata for new fields
- `platform/migration/mapper/templates.go` — new canonical columns in templates
- Tests for mapper template matching with new fields

## Option B: Sprint 13 — Next Deliverable

Check `docs/specs/SPRINT_PLAN.md` for Sprint 13 deliverables beyond the glossary integration chain. Possible areas:
- Vendor/Hosting module continuation
- Escalation module UI wiring
- Risk Register enhancements

## Verification Gate

- All existing mapper tests (56+) still pass
- All existing MappingPanel tests (5) still pass
- Go migration: 11 packages, frontend: 236 test files
