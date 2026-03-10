# noui-platform — Delivery Guide

How to use Claude and Claude Code to design, build, test, and maintain this product.

---

## Table of Contents

1. [How Claude Code Works With This Repo](#1-how-claude-code-works-with-this-repo)
2. [Starting a Session](#2-starting-a-session)
3. [The Delivery Workflow](#3-the-delivery-workflow)
4. [Designing Features](#4-designing-features)
5. [Building Code](#5-building-code)
6. [Testing](#6-testing)
7. [Committing and Pushing](#7-committing-and-pushing)
8. [Code Review](#8-code-review)
9. [Maintaining the Codebase](#9-maintaining-the-codebase)
10. [What NOT to Do](#10-what-not-to-do)
11. [What TO Do](#11-what-to-do)
12. [Troubleshooting Common Problems](#12-troubleshooting-common-problems)
13. [File Reference](#13-file-reference)

---

## 1. How Claude Code Works With This Repo

### What Claude Code Reads Automatically

When you open a Claude Code session in this repo, it reads:

- **`CLAUDE.md`** (root) — Architecture, layer boundaries, commands, commit format
- **`CLAUDE.md`** (per-layer) — Layer-specific rules in `connector/`, `platform/`, `domains/pension/`
- **`.claude/settings.json`** — Permissions, hooks, allowed/denied commands

These files are instructions to Claude. They tell it what this repo is, how the code is organized, what's allowed, and what's forbidden. Claude follows these instructions for the entire session.

### What the Hooks Do

The repo has automated quality checks that run without you doing anything:

| Hook | Trigger | What It Does |
|------|---------|--------------|
| PostToolUse (Write/Edit) | After Claude edits a `.go` file | Runs `gofmt -w` (format) then `go vet` (check) |
| PostToolUse (Write/Edit) | After Claude edits a `.ts/.tsx/.js/.css/.json` file | Runs `prettier --write` (format) then `tsc --noEmit` (typecheck, .ts/.tsx only) |
| PostToolUse (Write/Edit) | After Claude edits any file | Checks layer boundary rules (connector must not import platform and vice versa) |
| PostToolUse (Write/Edit) | After Claude edits a test fixture file | Warns that fixtures are hand-calculated oracles and must not be modified to match code |
| PreToolUse (git push) | Before Claude pushes to GitHub | Verifies the frontend builds successfully |
| Pre-commit (husky) | Every `git commit` | Runs ESLint + Prettier + gofmt on staged files, then tests |

You don't need to ask Claude to format, lint, or vet — it happens automatically.

### What the Permissions Do

`.claude/settings.json` controls what Claude can run without asking:

**Allowed automatically:**
- Go: `go build`, `go test`, `go run`, `go vet`, `go mod`
- Go lint: `golangci-lint`
- Node: `npm run`, `npm install`, `npm test`, `npm ci`
- Node tools: `npx` (including `npx tsc`, `npx eslint`, `npx vitest`)
- Docker: `docker compose`, `docker ps`, `docker logs`, `docker exec`
- Git: `git status`, `git diff`, `git log`, `git branch`, `git add`, `git commit`, `git stash`, `git tag`, `git push`, `git checkout`, `git switch`, `git merge`, `git rebase`, `git rev-parse`
- Shell: `grep`, `find`, `wc`, `head`, `tail`, `cat`, `ls`, `echo`, `sort`
- Network: `curl`, `jq`
- Database: `pg_isready`, `psql`

**Blocked (will refuse):**
- `rm -rf /` or `rm -rf ./` — prevents catastrophic deletion
- `git push --force` / `git push -f` — prevents rewriting shared history
- `git reset --hard` — prevents losing uncommitted work
- `git push origin --delete main` — prevents deleting the main branch
- `git clean -fdx` — prevents removing untracked files
- `docker system prune` — prevents removing Docker resources
- `drop database` / `DROP DATABASE` — prevents database deletion

**Requires confirmation:**
- Any command not in the allow list

### Available Commands

The repo includes slash commands in `.claude/commands/` that automate common workflows:

| Command | Purpose |
|---------|---------|
| `/session-start` | Read context, check builds, establish session goal |
| `/session-end` | Run tests, update docs, commit, push, verify CI |
| `/check-quality` | Mid-session quality gate |
| `/plan` | Create an implementation plan before coding |
| `/feature-dev` | Interview-then-implement for non-trivial features |
| `/test-and-fix` | Run tests and iteratively fix failures |
| `/verify` | Visually verify features using preview tools |
| `/quick-commit` | Stage, commit with proper format, and push |
| `/grill` | Adversarial code review |
| `/techdebt` | Scan for tech debt and quick-win cleanup |
| `/docker-check` | Verify Docker services are healthy |

Type `/` in Claude Code to see available commands in autocomplete.

---

## 2. Starting a Session

### Always Do This First

Tell Claude what you're working on. Be specific about the layer and goal:

**Good:**
> "I need to add a new API endpoint to the CRM service that returns interaction history filtered by date range."

**Bad:**
> "Let's work on the CRM."

The more specific your opening message, the better Claude scopes its work. A vague opening leads to Claude asking clarifying questions (wasting time) or making assumptions (wasting code).

### Session Startup (What Claude Does)

Claude follows the checklist in `CLAUDE.md`:
1. Reads `CLAUDE.md` (happens automatically)
2. Should read `BUILD_HISTORY.md` to understand current state
3. Should identify which layer it's working in
4. Should read the layer-specific `CLAUDE.md`
5. Should verify the build works in the relevant module(s)

**You should prompt this if Claude doesn't do it:**
> "Read BUILD_HISTORY.md and confirm the current build state before we start."

### Context Window Management

Claude Code sessions have a finite context window. When it fills up, you lose earlier context. To manage this:

- **One task per session** is ideal. If you need to do 5 things, start 5 sessions.
- **Don't ask Claude to "explore the whole codebase"** — this fills context with irrelevant information.
- **If Claude seems confused**, it may have lost earlier context. Start a new session rather than repeating yourself.
- **Long-running sessions** (multiple features, debugging cycles) should be split. When you notice Claude referencing things incorrectly, start fresh.

---

## 3. The Delivery Workflow

Every feature follows this sequence. Skipping steps is how bugs, regressions, and architectural drift happen.

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ DESIGN  │ ──▶ │  BUILD  │ ──▶ │  TEST   │ ──▶ │ REVIEW  │ ──▶ │  SHIP   │
│         │     │         │     │         │     │         │     │         │
│ Plan    │     │ Code    │     │ Verify  │     │ Check   │     │ Commit  │
│ first   │     │ in the  │     │ it      │     │ quality │     │ push    │
│         │     │ right   │     │ works   │     │         │     │ CI      │
│         │     │ layer   │     │         │     │         │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
```

**Never skip DESIGN for anything that touches more than one file.** This is the single most important rule. When you skip design, Claude writes code in the wrong place, breaks layer boundaries, or builds the wrong thing.

---

## 4. Designing Features

### When to Use Plan Mode

Tell Claude to plan before coding for anything non-trivial:

> "Plan this before writing any code."

Or Claude may enter plan mode itself for complex tasks. Either way, you should see a plan before code starts flowing.

### What a Good Plan Looks Like

A plan should answer:
1. **Which layer(s)** does this touch? (connector, platform, domains, frontend)
2. **Which files** will be created or modified?
3. **What's the API contract** between components?
4. **What are the test cases?**
5. **Does this violate any layer boundary rules?**

### Layer Boundary Decisions

This is where most architectural mistakes happen. The rules:

| If the code... | It belongs in... |
|----------------|-----------------|
| Discovers schemas from an unknown database | `connector/` |
| Tags tables with business concepts using signals | `connector/` |
| Detects data anomalies against statistical baselines | `connector/` |
| Queries the known DERP PostgreSQL schema | `platform/dataaccess/` |
| Calculates benefits, eligibility, DRO | `platform/intelligence/` |
| Manages contacts, interactions, notes | `platform/crm/` |
| Renders letter templates | `platform/correspondence/` |
| Checks data quality rules | `platform/dataquality/` |
| Serves knowledge articles | `platform/knowledgebase/` |
| Defines SQL schemas for pension data | `domains/pension/schema/` |
| Defines business rules in YAML | `domains/pension/rules/` |
| Provides test fixtures | `domains/pension/demo-cases/` |
| Renders UI components | `frontend/` |

**If you're unsure, ask Claude:** "Which layer should this go in?" and it will reference these rules.

### How to Ask Claude to Design

**Good approach — constraint-based:**
> "Design an endpoint that returns data quality trends over the last 30 days. It should fit the existing dataquality service API pattern. Show me the plan before coding."

**Bad approach — solution-first:**
> "Add a function called GetTrends to the dataquality handler."

The first approach lets Claude figure out the right implementation. The second micromanages and often leads to the wrong pattern.

---

## 5. Building Code

### Go Services (connector/ and platform/)

Each Go service is an independent module with its own `go.mod`. They don't share code at the Go import level.

**Build one service:**
```bash
cd platform/dataaccess && go build ./...
```

**Test one service:**
```bash
cd platform/dataaccess && go test ./... -v -count=1
```

**Lint one service:**
```bash
cd platform/dataaccess && golangci-lint run ./... --config ../../.golangci.yml
```

**Run all services together:**
```bash
docker compose up --build
```

### Frontend (React/TypeScript)

```bash
cd frontend
npm run dev     # Development server with hot reload on port 3000
npm run build   # Production build (TypeScript check + Vite)
npm run lint    # ESLint
npm test        # Vitest (interactive)
npm test -- --run  # Vitest (single run, CI-style)
```

### How to Ask Claude to Build

**Effective patterns:**

1. **Reference the existing pattern:**
   > "Add a DELETE endpoint for CRM contacts, following the same pattern as the existing GET/POST/PUT handlers."

2. **Specify the contract:**
   > "Add a `GET /api/v1/dq/trends` endpoint that returns `{ trends: [{ date, score, issue_count }] }` for the last N days."

3. **Let Claude choose the implementation:**
   > "The knowledgebase needs full-text search. Design and implement it."

**Ineffective patterns:**

1. **Line-by-line dictation:**
   > "Add a variable called trendData, then loop through the rows, then..."

   This is slower than writing the code yourself and removes Claude's ability to make good design decisions.

2. **Ambiguous scope:**
   > "Improve the data quality stuff."

   Claude doesn't know if this means the API, the UI, the scoring logic, or the check definitions.

### What Claude Should Do After Writing Code

After Claude writes or modifies code, the hooks will automatically:
- Run `gofmt -w` to format, then `go vet` to check modified `.go` files
- Run `prettier --write` to format, then `tsc --noEmit` to typecheck modified `.ts/.tsx` files
- Check layer boundary rules on any modified file
- Warn if test fixture files are modified

If the hook reports errors, Claude should fix them before moving on. If it doesn't, tell it:
> "Fix the errors before continuing."

---

## 6. Testing

### Test Expectations

| Layer | Test Command | What Gets Tested |
|-------|-------------|------------------|
| `connector/` | `go test ./... -short` | Schema discovery, concept tagging, monitoring logic (no DB needed with `-short`) |
| `platform/*` | `go test ./...` | API handlers, business logic, data access (mocked DB) |
| `frontend/` | `npm test -- --run` | Component rendering, user interactions, state management |

### How to Ask Claude to Test

**After building a feature:**
> "Write tests for the new trends endpoint, then run them."

**To verify nothing broke:**
> "Run all tests in the dataquality service and the frontend."

**Never accept "it should work" without running tests.** Claude sometimes claims code is correct without verifying. Always insist:
> "Run the tests. Show me the results."

### The Demo Cases (Acceptance Tests)

`domains/pension/demo-cases/` contains predefined scenarios that must always pass. These are the ground truth for benefit calculations:

| Case | Scenario |
|------|----------|
| `case_001_standard_retirement.json` | Standard retirement with 25 years of service |
| `case_002_early_retirement.json` | Early retirement with reduced benefits |
| `case_003_disability.json` | Disability retirement |
| `case_004_survivor.json` | Survivor benefits |

**Before any change to intelligence/ or dataaccess/:**
> "Verify the demo cases still produce correct results after this change."

### What NOT to Do With Tests

- **Don't skip tests to save time.** A broken test caught now saves hours of debugging later.
- **Don't let Claude write tests that always pass.** If a test has no assertions, it's not a test.
- **Don't test implementation details.** Test behavior (inputs → outputs), not internal variable names.
- **Don't mock everything.** If a handler calls a database function, the test should verify the SQL is correct, not just that the mock was called.

---

## 7. Committing and Pushing

### Commit Format

```
[layer/component] Brief description of what changed and why

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Examples:**
```
[platform/dataquality] Add trends endpoint for 30-day score history
[frontend] Add data quality trend chart to admin dashboard
[connector/tagger] Expand health-benefit concept signals
[pension/rules] Update early retirement age threshold to 55
[tooling] Add golangci-lint config and CI lint step
```

### What Happens When You Commit

1. **Husky** triggers the pre-commit hook
2. **lint-staged** runs on only the files you're committing:
   - `.go` files → `gofmt -w` (auto-formats)
   - `.ts/.tsx` files → `eslint` (checks for errors)
   - `.ts/.tsx/.js/.css/.json` files → `prettier --write` (auto-formats)
3. If any check fails, the commit is rejected
4. Fix the issue, re-stage, commit again

### What Happens When You Push

1. Claude's pre-push hook verifies `npm run build` succeeds
2. Code goes to GitHub
3. GitHub Actions CI runs 9 parallel jobs:
   - Connector: build + vet + test
   - 6 platform services: build + vet + test (each)
   - Frontend: install + lint + build + test
   - Docker compose validation
4. All 9 must pass for a green build

### How to Ask Claude to Commit

> "Commit this change."

Or for more control:
> "Commit the changes to platform/dataquality/ with an appropriate message. Don't include the frontend changes yet."

**Never ask Claude to:**
- `git push --force` (blocked by settings)
- `git reset --hard` (blocked by settings)
- Amend the previous commit (creates confusion; make a new commit instead)
- Commit `.env` files or credentials

---

## 8. Code Review

### Reviewing Claude's Work

After Claude writes code, review it before committing. Ask:

> "Show me a summary of all changes you've made this session."

Or:
> "Run git diff so I can see exactly what changed."

### Things to Check

1. **Layer boundaries:** Did the code stay in the right layer?
2. **Import paths:** Do Go imports use `github.com/noui/platform/{service}`?
3. **API consistency:** Do new endpoints follow the existing pattern (`/api/v1/{domain}/{resource}`)?
4. **Error handling:** Are errors returned, not swallowed?
5. **No hardcoded values:** Config should come from environment variables or YAML rules
6. **Tests exist and pass:** New code should have tests

### Using the PR Review Skill

When you have a pull request to review:
> "/review-pr 42"

This launches specialized review agents that check for bugs, type issues, test gaps, and silent failures.

---

## 9. Maintaining the Codebase

### BUILD_HISTORY.md

After any significant change, update `BUILD_HISTORY.md` with:
- What changed
- Why it changed
- What the current state is

This is the single most important document for continuity between Claude Code sessions. Without it, each new session starts from scratch understanding.

> "Update BUILD_HISTORY.md with what we accomplished this session."

### CLAUDE.md Updates

If a session reveals something that future sessions should know (new conventions, gotchas, architectural decisions), update the relevant `CLAUDE.md`:

> "Add a note to platform/CLAUDE.md about the new API versioning convention we established."

Or ask Claude directly:
> "Update CLAUDE.md with what we learned this session."

### Dependency Updates

- **Go modules:** `cd platform/dataaccess && go get -u ./...` (update one service at a time)
- **Frontend:** `cd frontend && npm update` (check for breaking changes)
- **Always run tests after updating dependencies**

### When Things Break

If CI fails after a push:

1. Check the GitHub Actions run: `gh run view <run-id>`
2. Look at the failing job's logs: `gh run view <run-id> --job <job-id> --log`
3. Fix locally, test locally, push again

> "CI failed on the Frontend build step. Check the logs and fix it."

---

## 10. What NOT to Do

### Architecture Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Import `connector/` from `platform/` | Breaks layer separation; caused the original repo tangle | Keep them independent. If platform needs connector data, use REST APIs. |
| Put business rules in Go code | Rules change per domain/client; hardcoded rules can't be customized | Put rules in `domains/{domain}/rules/*.yml` |
| Add pension-specific logic to `connector/` | Connector is generic infrastructure that works across any database | Put domain logic in `platform/` services |
| Share Go types between services via imports | Couples services; breaks independent deployment | Duplicate simple types or use API contracts |
| Put SQL directly in handler functions | Mixes data access with request handling; untestable | Use a separate `store` or `queries` package within the service |

### Claude Code Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Ask Claude to "refactor everything" | Fills context window, makes unreviewable changes | Refactor one module or one file at a time |
| Start coding without reading BUILD_HISTORY.md | Claude won't know the current state | Always read context first |
| Let Claude commit without running tests | Broken code reaches CI and blocks others | Always: test locally → commit → push |
| Give Claude multiple unrelated tasks in one session | Context gets muddled, earlier context gets lost | One task per session |
| Say "make it work" without specifying behavior | Claude will guess, and guesses accumulate | Describe the expected input/output/behavior |
| Ask Claude to install new tools or frameworks without thinking | Adds complexity and dependencies | Ask "do we need this, or can we use what we have?" |
| Accept code without seeing `git diff` | You might commit changes you didn't intend | Always review the diff before committing |

### Process Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Skip design for multi-file changes | Wrong architecture is expensive to fix | Enter plan mode first |
| Push directly to main for big features | No opportunity for review; risky | Use feature branches + PRs for significant work |
| Ignore lint warnings indefinitely | Technical debt compounds | Track warning count; it should decrease over time |
| Leave BUILD_HISTORY.md outdated | Next session starts blind | Update at end of every productive session |
| Test only the happy path | Edge cases are where bugs live | Test error cases, empty inputs, boundary values |

---

## 11. What TO Do

### Effective Prompting Patterns

**Start with context:**
> "I'm working on the dataquality service. The current trends endpoint returns daily scores. I need to add weekly aggregation."

**Be specific about acceptance criteria:**
> "Add a `groupBy` query parameter that accepts 'day' or 'week'. Default to 'day'. Weekly scores should be the average of daily scores in that week."

**Ask for verification:**
> "After implementing, run the dataquality tests and show me the results."

**Request explanations:**
> "Explain why you chose this approach over alternatives."

**Catch assumptions:**
> "Before you start coding — what assumptions are you making? List them so I can verify."

### Session Discipline

1. **Open:** State the goal. Read BUILD_HISTORY.md.
2. **Plan:** For anything non-trivial, plan first.
3. **Build:** Write code in the correct layer.
4. **Test:** Run tests. Fix failures.
5. **Review:** `git diff`. Verify the changes are what you intended.
6. **Commit:** One logical change per commit. Use the commit format.
7. **Update:** Update BUILD_HISTORY.md with what changed.
8. **Close:** Push if ready. Don't leave uncommitted work.

### Quality Checkpoints

Before committing, verify:
- [ ] Code is in the correct layer
- [ ] Go code passes `go vet`
- [ ] Go code passes `go test`
- [ ] Frontend code passes `npm run lint`
- [ ] Frontend code passes `npm test -- --run`
- [ ] Frontend builds: `npm run build`
- [ ] No new lint errors introduced (only warnings)
- [ ] API follows existing endpoint patterns
- [ ] BUILD_HISTORY.md is updated (for significant changes)

---

## 12. Troubleshooting Common Problems

### "Claude seems confused about the architecture"

Claude may not have read the layer-specific CLAUDE.md. Tell it:
> "Read connector/CLAUDE.md and platform/CLAUDE.md before continuing."

### "Claude put code in the wrong layer"

This happens when the goal is ambiguous. Clarify:
> "This belongs in platform/dataquality, not connector/. The connector doesn't know about our specific data quality rules."

### "Claude is making too many changes at once"

Break the task down:
> "Stop. Let's do this in steps. First, just add the database query. We'll add the API endpoint in the next step."

### "Tests pass locally but CI fails"

Common causes:
- **Go cache:** CI builds from scratch. Run `go clean -testcache` locally.
- **Node version:** CI uses Node 20. Check your local version with `node --version`.
- **File paths:** Windows uses `\`, Linux CI uses `/`. Use `path.Join()` in Go, `path.resolve()` in TypeScript.
- **Missing dependencies:** `npm ci` (CI) is stricter than `npm install` (local). If CI fails on install, run `npm ci` locally to reproduce.

### "The pre-commit hook is failing"

The hook runs ESLint, Prettier, and gofmt on staged files. If it fails:
1. Read the error message — it tells you which file and which rule
2. Fix the issue in the file
3. `git add` the fixed file
4. Commit again

To see what lint-staged would do without committing:
```bash
npx lint-staged --diff
```

### "I want to undo Claude's changes"

If you haven't committed yet:
```bash
git checkout -- <file>           # Undo changes to one file
git checkout -- .                # Undo ALL uncommitted changes (careful!)
```

If you committed but haven't pushed:
```bash
git log --oneline -5             # Find the commit before the bad one
git revert <commit-hash>         # Creates a new commit that undoes it (safe)
```

**Never use `git reset --hard`** (it's blocked for a reason — it destroys work).

---

## 13. File Reference

### Configuration Files You Should Know

| File | Purpose | When to Change |
|------|---------|---------------|
| `CLAUDE.md` (root) | Claude Code instructions for the entire repo | When architecture rules or conventions change |
| `connector/CLAUDE.md` | Connector-specific rules | When adding new concept tags or DB adapters |
| `platform/CLAUDE.md` | Platform service rules | When adding services or changing API conventions |
| `domains/pension/CLAUDE.md` | Pension domain rules | When adding demo cases or changing domain rules |
| `.claude/settings.json` | Permissions and hooks | When adding new allowed commands or hooks |
| `.claude/commands/` | Slash commands for session lifecycle, development, and maintenance | When adding new workflow automation |
| `.claude/prompts/` | Phase-specific integration guides and feature prompts | When starting a new integration phase |
| `.claude/launch.json` | Dev server configs | When adding new preview targets |
| `.github/workflows/ci.yml` | CI pipeline | When adding services or changing test commands |
| `.golangci.yml` | Go lint rules | When adjusting lint strictness |
| `frontend/eslint.config.js` | TypeScript/React lint rules | When adjusting frontend lint strictness |
| `.prettierrc` | Code formatting rules | When changing formatting preferences |
| `.lintstagedrc.json` | Pre-commit lint rules | When changing what runs on commit |
| `docker-compose.yml` | Local dev environment | When adding services or changing ports |
| `BUILD_HISTORY.md` | What's been done and when | After every significant change |

### Port Map

```
3000  →  Frontend (Vite dev server / Nginx in Docker)
5432  →  PostgreSQL
8081  →  platform/dataaccess
8082  →  platform/intelligence
8083  →  platform/crm (internal)
8084  →  platform/crm (host-mapped)
8085  →  platform/correspondence
8086  →  platform/dataquality
8087  →  platform/knowledgebase
8090  →  connector (service mode)
```

---

## Quick Reference Card

```
SESSION START:
  1. State your goal clearly
  2. "Read BUILD_HISTORY.md"
  3. Plan before coding (for non-trivial work)

BUILD:
  Go:       cd platform/{service} && go build ./...
  Frontend: cd frontend && npm run build
  All:      docker compose up --build

TEST:
  Go:       cd platform/{service} && go test ./... -v
  Frontend: cd frontend && npm test -- --run
  Lint Go:  golangci-lint run ./... --config ../../.golangci.yml
  Lint TS:  cd frontend && npm run lint

COMMIT:
  Format:   [layer/component] Description
  Example:  [platform/crm] Add date range filter to interaction history

VERIFY:
  CI status:  gh run list --limit 1
  CI logs:    gh run view <id> --log

END OF SESSION:
  1. Run git diff — review changes
  2. Commit with proper format
  3. Update BUILD_HISTORY.md
  4. Push and verify CI passes
```
