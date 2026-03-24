# Session Starter: Post D3-B — Next Steps

## Context

Session 37 completed **Deliverable 3B — Canonical Model Evolution**. The mapper now has pension-aware canonical slots for:

1. **Dual service fields**: `eligibility_service_years` (earned only, for Rule of 75/85/IPR) and `benefit_service_years` (total for benefit formula) — with 10 and 8 vocabulary terms respectively
2. **FAC metadata slots**: `fac_window_months`, `anti_spiking_cap_pct`, `compensation_inclusions` on the salary-history template
3. **TMRS accumulation metadata**: `benefit_model_note` in service-credit template Metadata map flagging TMRS's non-standard benefit model
4. **False cognates**: 6 new warnings covering qualifying_service (STRS Ohio), membership_service_years (Montana PERA), total_service_credit, combined_service_credit, compensation_cap (IRC §401(a)(17)), salary_cap_pct

Total vocabulary: 468 ExpectedNames across all templates. 370 tests passing.

## What to Read First

1. `BUILD_HISTORY.md` — Session 37 entry
2. `platform/migration/mapper/registry.go` — lines 267–330 (service-credit template with new slots + metadata)
3. `platform/migration/mapper/registry.go` — lines 165–185 (salary-history FAC slots)
4. `platform/migration/mapper/vocabulary.yaml` — new sections for eligibility/benefit service and FAC
5. `platform/migration/mapper/template.go` — Metadata field on MappingTemplate

## Option A: D3-C — Zero-Contribution Member Handling

From the glossary design doc, the fourth pillar of canonical model evolution:
- Nevada PERS (EPC): Employer-Pay Contribution members have 0% employee contribution rate but are fully eligible
- Utah RS (Tier 1 noncontributory): Employer pays full cost, member contributes 0%
- Data quality rules that flag zero-balance members need a system-level override mechanism

**Files likely touched:**
- `platform/migration/mapper/vocabulary.yaml` — contribution-accounts section enrichment
- `platform/dataquality/` — override mechanism for legitimate zero-contribution cases
- Possibly `platform/migration/transformer/` — transformation rules for contribution handling

## Option B: Frontend — Mapping Panel Shows New Slots

The MappingPanel already renders whatever slots the mapper returns, but the new dual-service and FAC slots could benefit from:
- Visual grouping: "Service Credit Split" section showing eligibility vs. benefit service side-by-side
- FAC metadata display: Show window months and anti-spiking cap when matched
- Metadata annotation display: Surface the TMRS benefit model warning in the UI

**Files likely touched:**
- `frontend/src/components/migration/engagement/MappingPanel.tsx`
- `frontend/src/types/Migration.ts` — if metadata needs a type
- Tests for new UI elements

## Option C: Sprint 13 — Next Deliverable

Check `docs/specs/SPRINT_PLAN.md` for Sprint 13 deliverables beyond the glossary chain.

## Verification Gate

- All mapper tests (70+) still pass
- All MappingPanel tests (5) still pass
- Go migration: 11 packages, frontend: 236 test files
