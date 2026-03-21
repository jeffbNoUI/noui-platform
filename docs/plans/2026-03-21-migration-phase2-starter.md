# Migration Engine Phase 2 Starter Prompt

> **Copy the text below into a new Claude Code session to continue development.**

---

## Context

I'm continuing development of the NoUI Migration Engine. Phase 1 (Foundation) was completed and merged in PR #122. I need to execute Phase 2 (Tasks 13-18) of the implementation plan.

### What exists (Phase 1, merged to main):

**Go Migration Service** (`platform/migration/`, port 8100):
- Engagement CRUD with 6-state lifecycle
- Template registry for 18 connector concept tags
- Template matcher (4-priority: exact → pattern → similarity → type-only)
- ISO 8000 six-dimension quality profiler with SQL injection hardening
- Agreement analysis (AGREED/DISAGREED/TEMPLATE_ONLY/SIGNAL_ONLY)
- Generate mappings endpoint (POST) with quality gate, transaction-wrapped inserts
- Mapping CRUD (GET with filters, PUT approve/reject with audit trail)
- Intelligence service HTTP client with Scorer interface

**Python Intelligence Service** (`migration-intelligence/`, port 8101):
- FastAPI with multi-signal column scorer (name 40%, type 25%, corpus 15%, null 10%, cardinality 10%)
- Canonical column definitions for 6 pension concepts
- Stub endpoints for corpus/reconciliation (Phase 3)

**Database** (`db/migrations/030_migration_schema.sql`):
- 10 tables: engagement, quality_profile, field_mapping, code_mapping, batch, lineage, exception, reconciliation, correction, analyst_decision

**Test coverage:** 68 Go + 37 Python = 105 tests, all passing.

### What to build (Phase 2 — Tasks 13-18):

The implementation plan is at `docs/plans/2026-03-20-migration-engine-plan.md`. The design doc is at `docs/plans/2026-03-20-migration-engine-design.md`.

**Task 13: Transformation pipeline** — Field transformers (type coercion, date normalization, code table lookup, string normalization, SSN formatting). Create `platform/migration/transformer/` package.

**Task 14: Batch processor** — Idempotent batch execution with checkpoint/resume. Configurable error thresholds. Create `platform/migration/batch/` package.

**Task 15: Canonical loader with lineage** — Write transformed records to canonical schema with row-level lineage and confidence tagging (ACTUAL, DERIVED, ESTIMATED, ROLLED_UP). Create `platform/migration/loader/` package.

**Task 16: Re-transformation via lineage** — When a mapping changes, surgically re-transform only affected rows using lineage records. Old lineage marked superseded, not deleted.

**Task 17: Code table discovery** — Detect and propose code table mappings (e.g., legacy status codes → canonical status codes). Integrate with Python service for pattern detection.

**Task 18: Phase 2 E2E verification** — End-to-end test: source table → transform → load → verify lineage + confidence tags.

### CRITICAL — Revert checklist (before Phase 2 starts):

The prior migration simulation session relaxed NOT NULL constraints on the canonical schema that must be reverted:
- `service_credit.as_of_date` — must be NOT NULL
- `service_credit.credited_years_total` — must be NOT NULL
- `contribution.ee_amount` — must be NOT NULL
- `reconciliation_result.batch_id` — must be NOT NULL

**Design principle:** "Canonical schema constraints are immutable during migration. Source defects produce exceptions, not schema changes."

### Execution approach:

Use `/subagent-driven-development` to execute Phase 2. Fresh subagent per task, two-stage review (spec compliance then code quality) after each.

Start with: Read the implementation plan (Tasks 13-18), create a worktree, verify the revert checklist, then begin Task 13.
