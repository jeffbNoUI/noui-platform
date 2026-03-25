# noui-platform — Claude Code Instructions

## What This Repository Is

This is the **NoUI Platform** monorepo — AI-composed workspace software for benefits administration. It contains the generic connector infrastructure, shared platform services, domain-specific business logic, and the React frontend.

The platform is designed to serve multiple clients across multiple benefit domains (pension, health, life, etc.). Client-specific deployment configuration lives in separate `noui-client-{name}` repos.

## Architecture: Three Layers

```
noui-platform/
├── connector/              # Layer 1: Generic Infrastructure (Go 1.26)
│   ├── introspect/         #   Schema discovery (MySQL, PostgreSQL, MSSQL adapters)
│   ├── tagger/             #   Concept tagging (18 concepts, signal-based)
│   ├── monitor/            #   Anomaly detection + scheduled monitoring
│   ├── dashboard/          #   REST API + embedded HTML UI
│   ├── schema/             #   Shared types library
│   ├── service/            #   Unified HTTP binary
│   └── cmd/                #   CLI entry points
│
├── platform/               # Layer 2: Shared Services (Go 1.22)
│   ├── dataaccess/         #   Legacy data access (PostgreSQL queries)
│   ├── intelligence/       #   Eligibility, benefit calculation, DRO
│   ├── crm/                #   Contact management, interaction history
│   ├── correspondence/     #   Template rendering, merge fields
│   ├── dataquality/        #   Data quality checks, scoring
│   └── knowledgebase/      #   Articles, stage help, search
│
├── domains/                # Layer 3: Domain-Specific
│   └── pension/            #   Pension domain
│       ├── schema/         #     Database schema definitions
│       ├── seed/           #     Seed data + generators
│       ├── rules/          #     Business rules (YAML)
│       └── demo-cases/     #     Acceptance test fixtures
│
├── frontend/               # React/Vite/Tailwind UI
├── targets/                # Test target databases (ERPNext, PostgreSQL, MSSQL)
├── infrastructure/helm/    # Kubernetes deployment charts
├── tools/compose-sim/      # AI composition test framework
└── docs/                   # Architecture, plans, prototypes
```

## Layer Boundary Rules

These rules are **non-negotiable** and prevent the tangling that caused the previous repo split:

1. **connector/** has ZERO dependencies on platform/ or domains/. It discovers schemas by signal, not by name.
2. **platform/** services do NOT import from connector/. They are separate Go modules.
3. **domains/** contains data and rules only — no Go services.
4. **frontend/** calls platform services via REST APIs. It does not import Go code.
5. Each Go service has its own `go.mod`. Module path pattern: `github.com/noui/platform/{service}`

## Service Naming (Important!)

Services are Docker-internal only (no host port mappings). All access goes through
nginx at `localhost:3000`. See `infrastructure/ports.env` for the full port registry.

| Directory | API Path | Purpose |
|-----------|----------|---------|
| `connector/` | — | Generic schema introspection, concept tagging, monitoring engine |
| `platform/dataaccess/` | `/api/v1/members`, `/api/v1/scenarios`, `/api/v1/notifications` | Member/salary/benefit queries |
| `platform/intelligence/` | `/api/v1/eligibility`, `/api/v1/benefit`, `/api/v1/dro` | Eligibility, benefit calculation, DRO |
| `platform/crm/` | `/api/v1/crm` | Contact management, interaction history |
| `platform/correspondence/` | `/api/v1/correspondence` | Template rendering, merge fields |
| `platform/dataquality/` | `/api/v1/dq` | Data quality checks, scoring |
| `platform/knowledgebase/` | `/api/v1/kb` | Articles, stage help, rule references |
| `platform/casemanagement/` | `/api/v1/cases`, `/api/v1/stages` | Case tracking, stage workflow |
| `platform/preferences/` | `/api/v1/preferences` | User preferences |
| `platform/issues/` | `/api/v1/issues` | Error self-reporting |
| `platform/security/` | `/api/v1/security` | Security events |
| `platform/healthagg/` | `/api/v1/health` | Health aggregation dashboard |
| `platform/employer-portal/` | `/api/v1/employer` | Employer portal, divisions, alerts |
| `platform/employer-reporting/` | `/api/v1/reporting` | Employer reporting, file uploads |
| `platform/employer-enrollment/` | `/api/v1/enrollment` | Member enrollment submissions |
| `platform/employer-terminations/` | `/api/v1/terminations` | Termination certifications, refunds |
| `platform/employer-waret/` | `/api/v1/waret` | WARET designations |
| `platform/employer-scp/` | `/api/v1/scp` | Service credit purchase |
| `platform/migration/` | `/api/v1/migration` | Migration engine (profiling, mapping, loading) |
| `migration-intelligence/` | — | Migration ML service (signal scoring, corpus) |
| `frontend/` | `localhost:3000` | React UI + nginx proxy (only host-exposed service) |

**`connector/` and `platform/dataaccess/` are completely different things.** The connector discovers unknown schemas. The dataaccess service queries a known PostgreSQL schema for member data.

## Commands

### Build
```bash
# Connector
cd connector && go build ./...

# Platform services (each is independent)
cd platform/dataaccess && go build ./...
cd platform/intelligence && go build ./...
# ... etc for each service

# Frontend
cd frontend && npm install && npm run build
```

### Test

Tests are organized into two tiers for fast feedback:

**Tier 1 — Fast (~30s, no database required):**
```bash
# Go: -short skips DB-dependent tests (rls_test.go, dbcontext_test.go)
cd connector && go test ./... -short
cd platform/dataaccess && go test ./... -short
cd platform/intelligence && go test ./... -short
cd platform/crm && go test ./... -short
cd platform/casemanagement && go test ./... -short
cd platform/correspondence && go test ./... -short
cd platform/dataquality && go test ./... -short
cd platform/knowledgebase && go test ./... -short

# Frontend: all unit tests (sqlmock + fetch-mock based)
cd frontend && npm test -- --run
```

**Tier 2 — Full (requires PostgreSQL):**
```bash
# Go: includes real-DB integration tests
cd platform/dataaccess && go test ./... -count=1
# Frontend: with coverage report
cd frontend && npm test -- --run --coverage
```

### Typecheck (Frontend — run before tests, it's faster)
```bash
cd frontend && npx tsc --noEmit
```

### Lint
```bash
# Go — run in each modified service directory
cd connector && go vet ./...
cd platform/dataaccess && go vet ./...

# Frontend
cd frontend && npx eslint src/
```

### Run (Docker)
```bash
docker compose up --build
```

### Verify All (before PR or session end)
```bash
# Quick verification — Tier 1 (typecheck + build + short tests)
cd connector && go build ./... && go test ./... -short
cd platform/dataaccess && go build ./... && go test ./... -short
cd platform/intelligence && go build ./... && go test ./... -short
cd frontend && npx tsc --noEmit && npm run build && npm test -- --run
```

## Commit Discipline

- Format: `[layer/component] Brief description`
- Examples:
  - `[connector/tagger] Add new concept for health benefits`
  - `[platform/crm] Fix contact search pagination`
  - `[pension/rules] Update eligibility thresholds`
  - `[frontend] Add dark mode toggle`
  - `[infrastructure] Update Helm chart resource limits`
- Commit after each completed task — small, traceable commits over large monolithic ones
- Update BUILD_HISTORY.md after significant changes

## AI Boundaries (Non-Negotiable)

- AI may assist with schema analysis and pattern identification
- AI does NOT execute business calculations or make fiduciary determinations
- All tagging heuristics are human-reviewed before promotion to production
- All benefit calculations must be verified against demo-case test fixtures
- The deterministic path for any function that produces a number, eligibility determination, or dollar amount: **Certified Rule Definition (YAML) → Deterministic Go Code → Auditable Output with full calculation trace**. No AI model is in this path.

## Fiduciary Calculation Rules

These apply to all code in `platform/intelligence/`:
- Every benefit calculation must match hand-calculated expected results **to the penny** ($0.00 tolerance)
- Never round intermediate calculations — carry full precision, round only the final monthly benefit
- The hand calculations in `domains/pension/demo-cases/` are the test oracle
- If code disagrees with the hand calculation, the code is wrong until proven otherwise
- Never adjust expected values to match code output — if you suspect the hand calc is wrong, STOP and flag for human review
- Use `big.Rat` or scaled integers for monetary arithmetic in Go — never `float64`
- All monetary values are JSON strings with exactly 2 decimal places (`"10639.45"` not `10639.45`)
- Percentages are string decimals (`"0.03"` = 3%)

## Service Purchase Exclusion (CRITICAL)

- Purchased service credit counts toward BENEFIT CALCULATION (increases the benefit amount)
- Purchased service credit does NOT count toward Rule of 75, Rule of 85, or IPR
- Every function using service credit must explicitly declare which type (earned-only vs total)
- This distinction is tested explicitly in Case 2 (Jennifer Kim)
- Get this wrong and the entire demo loses credibility

## Leave Payout (CRITICAL)

- Only members hired BEFORE January 1, 2010 with sick/vacation leave (not PTO) qualify
- The payout amount is added to the FINAL MONTH of salary
- This boosts the AMS only if the final months are within the highest consecutive window
- Tested explicitly in Case 1 (Robert Martinez)

## Controlled Terminology

When writing code comments, documentation, demo scripts, or any user-facing text:

**Never use:**
- "Self-healing" → Use "AI-accelerated change management"
- "Auto-resolved" → Use "Proposed correction (awaiting review)"
- "AI calculated the benefit" → Use "The rules engine calculated the benefit"
- "The system automatically..." (for rules/calcs) → Use "The system identifies and presents..."
- "The AI knows your rules" → Use "The rules engine is configured with your plan provisions"

**Do use:**
- "Deterministic rules engine executing certified plan provisions"
- "AI accelerates rule configuration; humans certify and approve"
- "AI composes the workspace — the rules engine produces the numbers"
- "The system shows its work. Every calculation is transparent and verifiable."

## Reference Documents

When you need guidance beyond this file, read these:
- `docs/DELIVERY_GUIDE.md` — Full delivery workflow, anti-patterns, effective prompting patterns
- `BUILD_HISTORY.md` — What's been built, current state (read at session start)
- `docs/architecture/ARCHITECTURE_REFERENCE.md` — Detailed architecture decisions

## Commands

Slash commands in `.claude/commands/` enforce the delivery workflow:

**Session lifecycle:**
- `/session-start` — Context check, dirty gate, stale worktree scan, read starter prompt
- `/session-end` — Exit gates, worktree disposition, write starter prompt, memory update
- `/check-quality` — Mid-session quality gate: builds, tests, lint, layer boundaries
- `/precommit` — Graded 4-category evaluation + persona review (before committing)
- `/simplify` — Iterative code simplification (up to 3 cycles, after committing)

**Development workflow:**
- `/plan` — Create a structured implementation plan before coding
- `/feature-dev` — Interview-then-implement pattern for non-trivial features
- `/test-and-fix` — Run tests and iteratively fix failures
- `/verify` — Use preview tools to visually verify features in the browser
- `/quick-commit` — Stage, commit with proper format, and push

**Maintenance:**
- `/grill` — Adversarial code review: correctness, boundaries, monetary handling
- `/techdebt` — Scan for TODOs, unused code, and structural issues
- `/docker-check` — Verify all Docker services are running and healthy


## Session Discipline (Mandatory)

### Session Start — Do This FIRST

Before writing any code, Claude MUST:
1. Read `BUILD_HISTORY.md` to understand the current state
2. Ask the user to clarify which layer and component they're working on if not obvious
3. Read the layer-specific README or CLAUDE.md if one exists (e.g., `connector/CLAUDE.md`)
4. Verify the build passes in the relevant module(s): `go build ./...` or `npm run build`
5. State what you understand the task to be and get confirmation before proceeding

### Planning Rule (The Boris Rule)

**If a task will touch more than 2 files, Claude MUST plan before coding.**
- Enter plan mode or present a plan in the conversation
- The plan must identify: which files change, which layer(s) are affected, what tests are needed
- Get user acknowledgment before writing code
- Single-file changes (bug fixes, small tweaks) can skip planning

For complex features, use the interview-then-implement pattern:
1. Ask what exactly is wanted (2-3 clarifying questions max)
2. Write a plan with files to change, tests to add, and verification steps
3. Get approval
4. Implement — typically in one pass from a good plan

### Testing Rule

**Claude MUST provide a verification loop for every implementation.**
- Go: `go test ./... -v -count=1` in each modified service
- Frontend: `npx tsc --noEmit && npm test -- --run`
- Never commit with failing tests
- Never say "it should work" — run the tests and show results
- A verification loop (test suite, build check, browser test) **2-3x the quality** of the final output

### Session End — Do This LAST

Before ending a session, Claude MUST:
1. Run tests in all modified modules — show results
2. Show `git diff --stat` so the user can review scope of changes
3. If the session made significant changes, update `BUILD_HISTORY.md`
4. Do not leave uncommitted work without informing the user
5. State what was accomplished and what the logical next step would be

### What Claude Must Refuse

- Writing code before understanding the current build state
- Skipping tests to "save time"
- Committing code that hasn't been tested
- Putting code in the wrong layer (see Layer Boundary Rules)
- Making multi-file changes without a plan
- Modifying test fixture expected values to match code output
- Implementing business rules not found in governing documents
- Adding external dependencies not listed in this file without approval

## Security Rules (from Findings Review — 2026-03-15)

These rules were established from the security/quality review. See `docs/SECURITY_FINDINGS.md` for full context on each finding.

1. **Every API endpoint goes through auth middleware.** No endpoint is exempt except `/healthz`, `/health`, `/ready`, `/metrics`. Auth middleware is applied at `main.go` level wrapping the entire mux — individual handlers cannot opt out.

2. **Tenant/member identity comes from JWT claims, never from headers.** The `X-Tenant-ID` header is stripped by auth middleware. Handlers read identity from `auth.TenantID(r.Context())`.

3. **CORS origin must never be `*`.** Always use `CORS_ORIGIN` env var with explicit allowed origins.

4. **All Go services use `log/slog`.** Never import `"log"` in platform services. Use structured key-value logging.

5. **Middleware order: CORS → Auth → Logging → Handler.** Auth runs before logging so log lines include authenticated identity.

6. **Any code wrapping `http.ResponseWriter` must also implement `http.Flusher`** (and `http.Hijacker` if WebSocket support is needed).

7. **Middleware that reads config from env must also offer a constructor with explicit parameters** for testability.

8. **JWT validation must check: signature, algorithm (`alg: HS256`), expiration (`exp`), and required claims** (`tenant_id`, `role`).

## Claude Code Workflow

**Planning:** Enter plan mode (Shift+Tab) before any non-trivial implementation.
Invest in a solid plan so implementation executes cleanly in one pass.

**Verification:** Always provide Claude a way to verify its work:
- Unit tests: write alongside implementation, never after
- Go: `go test ./... -v -count=1` in each modified service
- Frontend: `npx tsc --noEmit && npm test -- --run`

**CLAUDE.md as living document:** After every correction, update this file so the
mistake does not repeat. Ruthlessly edit over time.

**Parallelization:** Use git worktrees for independent tasks.

**Commits:** Small, frequent commits. Each task step should be committable.

## Session Conventions

**Session naming:** Start every session with a task-based name:
```
claude --name "task-id-description"
```

**Session lifecycle:**
1. `/session-start` — context check, dirty gate, sync, verify tests, show status
2. Plan (Shift+Tab) — includes persona review for non-trivial plans
3. Implement → test → `/precommit` (pre-commit graded evaluation)
4. Commit
5. `/simplify` — iterative, up to 3 cycles
6. `/session-end` — exit gates, worktree disposition, summary, memory update

**Hooks (automatic):**
- PostCompact: re-injects critical rules + persona review rule + worktree rules after context compression
- PostToolUse: Go vet on .go edits, tsc on .ts/.tsx edits, layer boundary check, fixture guard
- PreToolUse: pre-push frontend build check, pre-commit test runner
- Stop: reminds to verify tests and update CLAUDE.md before closing

**Worktree hygiene (Claude Code app):**
- Never commit to `master`/`main` directly from a worktree. All work happens on feature branches.
- After PR merge: `ExitWorktree(action: "remove")` cleans up worktree + local branch automatically. Then `git push origin --delete <branch>` for remote.
- For WIP or pending PR: `ExitWorktree(action: "keep")` preserves worktree for follow-up.
- `/session-start` reports worktree context and blocks on dirty state. If stale worktrees exist, clean them before starting work.
- `/session-end` enforces clean exit: no uncommitted changes, worktree disposition resolved via ExitWorktree.
- Never switch projects mid-session without explicit user confirmation.
- Avoid generic names for local commands (`review`, `test`, `build`) — plugins may claim them.

**Behavioral guideline — persona review in plan mode:**
- Before finalizing any plan that touches UI, data model, API routes, or permission logic, run persona review against `config/rubrics/persona-review.json`. Spawn 3 independent tier reviewers (each sees ONLY its own rubric section), then reconcile with priority T1 > T2 > T3. Do not exit plan mode with unresolved blockers. Skip for trivial plans (config-only, test-only, documentation).

## When Something Goes Wrong

Every Claude mistake becomes a rule. If something breaks:
1. Document the failure in BUILD_HISTORY.md
2. Diagnose the root cause
3. Fix it
4. Add a test that would have caught this failure
5. If the mistake pattern is repeatable, add a rule to this file or a hook to settings.json so it can't happen again

## Plan Configuration Reference

Plan-specific parameters (tier definitions, multipliers, contribution rates, reduction tables, etc.) are defined in `domains/pension/plan-config.yaml`. The rules engine loads this configuration at startup.

**CRITICAL:** Early retirement reduction for Tiers 1 & 2 is 3% per year, NOT 6%. See CRITICAL-001-resolution.md.
