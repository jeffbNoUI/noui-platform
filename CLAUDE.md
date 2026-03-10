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
│   └── pension/            #   DERP pension domain
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

| Directory | Purpose | Port |
|-----------|---------|------|
| `connector/` | Generic schema introspection, concept tagging, monitoring engine | 8090 (service mode) |
| `platform/dataaccess/` | DERP-specific PostgreSQL data access for member/salary/benefit queries | 8081 |
| `platform/intelligence/` | Eligibility, benefit calculation, DRO, scenario analysis | 8082 |
| `platform/crm/` | Contact management, interaction history | 8083 (host: 8084) |
| `platform/correspondence/` | Template rendering, merge fields, letter history | 8085 |
| `platform/dataquality/` | Data quality checks, scoring, issues, trends | 8086 |
| `platform/knowledgebase/` | Articles, stage help, rule references, search | 8087 |
| `frontend/` | React UI (StaffPortal, MemberPortal, RetirementApplication) | 3000 |

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
```bash
# Connector (use -short to skip DB-dependent tests)
cd connector && go test ./... -short

# Platform services
cd platform/dataaccess && go test ./...

# Frontend
cd frontend && npm test -- --run
```

### Run (Docker)
```bash
docker compose up --build
```

## Commit Discipline

- Format: `[layer/component] Brief description`
- Examples:
  - `[connector/tagger] Add new concept for health benefits`
  - `[platform/crm] Fix contact search pagination`
  - `[pension/rules] Update eligibility thresholds`
  - `[frontend] Add dark mode toggle`
  - `[infrastructure] Update Helm chart resource limits`
- Update BUILD_HISTORY.md after significant changes

## AI Boundaries

- AI may assist with schema analysis and pattern identification
- AI does NOT execute business calculations or make fiduciary determinations
- All tagging heuristics are human-reviewed before promotion to production
- All benefit calculations must be verified against demo-case test fixtures

## Reference Documents

When you need guidance beyond this file, read these:
- `docs/DELIVERY_GUIDE.md` — Full delivery workflow, anti-patterns, troubleshooting, effective prompting patterns
- `BUILD_HISTORY.md` — What's been built, current state (read at session start)
- `docs/architecture/ARCHITECTURE_REFERENCE.md` — Detailed architecture decisions

## Commands

Slash commands in `.claude/commands/` enforce the delivery workflow:

**Session lifecycle:**
- `/session-start` — Read context, check builds, establish the session goal
- `/session-end` — Run tests, update docs, commit, push, verify CI
- `/check-quality` — Mid-session quality gate: builds, tests, lint, layer boundaries

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
3. Read the layer-specific `CLAUDE.md` (e.g., `connector/CLAUDE.md`, `platform/CLAUDE.md`)
4. Verify the build passes in the relevant module(s): `go build ./...` or `npm run build`

### Planning Rule

**If a task will touch more than 2 files, Claude MUST plan before coding.**
- Enter plan mode or present a plan in the conversation
- The plan must identify: which files change, which layer(s) are affected, what tests are needed
- Get user acknowledgment before writing code
- Single-file changes (bug fixes, small tweaks) can skip planning

### Testing Rule

**Claude MUST run tests before every commit.** No exceptions.
- Go: `go test ./... -v -count=1` in each modified service
- Frontend: `npm test -- --run` if any `.ts/.tsx` files changed
- Never commit with failing tests
- Never say "it should work" — run the tests and show results

### Session End — Do This LAST

Before ending a session, Claude MUST:
1. Show `git diff` or `git status` so the user can review changes
2. Run tests in all modified modules
3. If the session made significant changes, remind the user to update `BUILD_HISTORY.md`
4. Do not leave uncommitted work without informing the user

### What Claude Must Refuse

- Writing code before understanding the current build state
- Skipping tests to "save time"
- Committing code that hasn't been tested
- Putting code in the wrong layer (see Layer Boundary Rules above)
- Making multi-file changes without a plan
