# Session Starter: Warning Acknowledgment Persistence (D3 Backend)

## Context

Session 35 completed **Deliverable 2 frontend** — false cognate warning badges on the mapping review table. The full pipeline now works:

1. **Vocabulary YAML** defines false cognates with risk levels (D1)
2. **Backend** computes warnings at generation time AND enriches `ListMappings` responses on read (D2 backend + Session 35 enrichment)
3. **Frontend** shows colored warning badges (coral=HIGH, gold=MEDIUM), click-to-open popovers with term/explanation/risk, and an acknowledgment gate that blocks approval until warnings are reviewed (D2 frontend)

**Current limitation:** Acknowledgment state is local (`useState<Set<string>>`) — it resets on page navigation. This is the D3 gap.

## What to Read First

1. `BUILD_HISTORY.md` — Session 35 entry
2. `frontend/src/components/migration/engagement/WarningBadge.tsx` — badge + popover + acknowledge UI
3. `frontend/src/components/migration/engagement/MappingPanel.tsx` — acknowledgment gate logic (lines with `acknowledgedMappings`, `hasUnacknowledgedWarnings`)
4. `platform/migration/api/mapping_handlers.go` — `ListMappings` warning enrichment, `FieldMapping` struct
5. `docs/plans/2026-03-24-d2-frontend-starter.md` — D2 spec (references D3 as future work)

## Task: D3 — Acknowledgment Persistence + Canonical Model Evolution

### Part A: Acknowledgment Persistence

Store analyst acknowledgments in the database so they survive page navigation.

**Backend:**
- New table: `migration.warning_acknowledgment` — `(engagement_id, mapping_id, acknowledged_by, acknowledged_at)`
- `POST /api/v1/migration/engagements/{id}/mappings/{mapping_id}/acknowledge` — records acknowledgment
- `ListMappings` response should include `acknowledged: true/false` per mapping (join with acknowledgment table)

**Frontend:**
- Replace `useState<Set<string>>` with API-backed state
- New hook: `useAcknowledgeWarning()` mutation
- `WarningBadge.onAcknowledge` calls the mutation instead of local state update
- Acknowledged state comes from the mapping data (`m.acknowledged`)

### Part B: Canonical Model Evolution (if time permits)

From the pension glossary design:
- Dual service fields on canonical schema: `earned_service` + `purchased_service` separation
- TMRS accumulation pathway metadata
- FAC canonical field with anti-spiking rule metadata

See `docs/pension-glossary.md` for the full crosswalk specification.

### Verification Gate

- Backend: migration build + tests pass
- Frontend: typecheck clean, all tests pass
- New tests: acknowledgment persistence round-trip (POST → GET returns acknowledged=true)
- Existing 5 MappingPanel tests continue to pass
