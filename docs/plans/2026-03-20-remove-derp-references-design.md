# Design: Remove DERP References — Genericize Platform

**Date:** 2026-03-20
**Goal:** Remove all DERP (Denver Employees Retirement Plan) references from the codebase, making the platform fully generic and plan-agnostic.

---

## Decisions

1. **Plan-specific values** → Move from hardcoded Go constants to `domains/pension/plan-config.yaml` (Option C — separate data from engine without building full multi-tenant config)
2. **UI text** → Dynamic from `plan-profile.yaml` config via existing `usePlanProfile()` hook (Option A)
3. **DB credentials & Docker names** → Rename from `derp` to `noui` (Option A)
4. **Prototype docs** → Archive to `docs/prototypes/archived-derp/` (Option B)

---

## Section 1: Plan-Specific Values → Config File

Extract all hardcoded DERP values from Go code into a new config file.

### New file: `domains/pension/plan-config.yaml`
All plan parameters in one structured file:
- Tier cutoff dates (2004-09-01, 2011-07-01)
- Benefit multipliers per tier (2.0%, 1.5%, 1.5%)
- AMS windows per tier (36, 36, 60 months)
- Rule of N thresholds per tier (75, 75, 85)
- Rule of N minimum ages per tier (55, 55, 60)
- Early retirement minimum ages per tier (55, 55, 60)
- Early retirement reduction tables per tier
- Death benefit tables per tier
- Contribution rates (8.45% employee, 17.95% employer)
- Vesting years (5)
- Normal retirement age (65)
- IPR rates ($12.50 non-Medicare, $6.25 Medicare)

### New file: `platform/intelligence/config/plan_config.go`
Loader that reads the YAML at startup and populates the lookup tables.

### Modified files:
- `platform/intelligence/rules/tables.go` — Remove hardcoded maps/constants, read from loaded config
- `platform/intelligence/rules/eligibility.go` — Remove hardcoded tier cutoff dates
- `platform/intelligence/rules/benefit_calculator.go` — Remove hardcoded 3%/6% reduction rate logic

### Unchanged:
- Formula logic stays identical — only the parameter source changes
- All existing tests must continue to pass with identical outputs

---

## Section 2: UI Text — Dynamic from Config

### Config updates to `frontend/src/config/plan-profile.yaml`:
- `plan_name: "Retirement Plan"` (was "Denver Employees Retirement Plan")
- `plan_short_name: "the Plan"` (was "DERP")
- Remove/genericize administrator contact details

### Component updates:
- `MemberPortalMessages.tsx` — "DERP staff" → `${planShortName} staff`
- `EmployerPortalEnrollment.tsx` — "DERP staff" → `${planShortName} staff`
- `learningHints.ts` — "Your DERP benefit" → `Your ${planShortName} benefit`
- `App.tsx` — Remove "DERP POC" comment
- `index.html` — Title: "NoUI — Retirement Application Workspace"
- `package.json` — Name: `noui-platform-frontend`

### Test updates:
- `BenefitCalculationPanel.test.tsx` — Generic source references
- `planProfile.test.ts` — "has 3 DERP tiers" → "has 3 tiers"

---

## Section 3: Infrastructure — Database & Docker

All `derp` credentials and service names → `noui`.

### Files:
- `.env.example` — `DB_USER=noui`, `DB_PASSWORD=noui`, `DB_NAME=noui`
- `docker-compose.yml` — All DB env vars → `noui`
- `infrastructure/pgbouncer/userlist.txt` — `"noui" "noui"`
- `infrastructure/pgbouncer/pgbouncer.ini` — Update DB name
- All `platform/*/db/postgres.go` files (~12 services) — Default fallback → `"noui"`
- `infrastructure/helm/*/Chart.yaml` and `values.yaml` — Remove `derp-` prefix

---

## Section 4: Code Comments, Package Docs & Seed Data

- Go package docs — Remove "DERP" from all doc comments
- Go main.go comments — Remove "DERP POC" references
- SQL comments — "DERP" → generic
- Seed data comments — "DERP staff" → "Staff"
- YAML rule definitions — "DERP Restated Master Contract" → generic governance reference
- Rename `generate_derp_data.py` → `generate_seed_data.py`
- compose-sim system prompt — Remove DERP reference

---

## Section 5: Documentation

- `docs/prototypes/` — Move 14 DERP-specific files to `docs/prototypes/archived-derp/`
- `README.md` — Remove DERP references, generic stack description
- `CLAUDE.md` (root) — Remove DERP Quick Reference table (redundant with plan-config.yaml)
- `CLAUDE.md` (repo) — `#   DERP pension domain` → `#   Pension domain`
- `domains/pension/CLAUDE.md` — Generic pension domain references
- `BUILD_HISTORY.md` — Leave as-is (historical record)
- `docs/plans/` — Leave as-is (historical plans)

---

## Section 6: What We Do NOT Change

- **Formula logic** — Calculations stay identical, just read parameters from config
- **Demo cases** — Case 1-4 fixtures stay (valid test data regardless of plan name)
- **BUILD_HISTORY.md / docs/plans/** — Historical records
- **Git history** — No rewriting
