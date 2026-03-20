# Session Start

Read these files in order to understand the current state before writing any code:

1. Read `BUILD_HISTORY.md` — understand current state, last changes, any open issues
2. Read `docs/INTEGRATION_PLAN.md` if it exists — understand what phase we're in
3. Check for any `.claude/prompts/` files relevant to the current task

Then verify the build is healthy:

```bash
# Check git status
git status --short
git log --oneline -5

# Quick build check for the layers we're likely to touch
cd connector && go build ./... 2>&1 | tail -5
cd ../platform/dataaccess && go build ./... 2>&1 | tail -5
cd ../platform/intelligence && go build ./... 2>&1 | tail -5
cd ../../frontend && npx tsc --noEmit 2>&1 | tail -5
```

Then check for unresolved error reports (skip silently if the Issues service is not reachable):

```bash
# Check for auto-reported errors (Issues service on port 8092)
curl -sf http://localhost:8092/api/v1/errors/recent?status=open 2>/dev/null || true
```

If error reports are found, display them in a table:

```
## Unresolved Error Reports
| Issue | Error | Service | First Seen |
|-------|-------|---------|------------|
| ISS-XX | ERROR_CODE: /api/path | service | date |

Want me to investigate any of these?
```

Report:
- What the last session accomplished
- Whether builds are clean or broken
- Any uncommitted changes from a prior session
- Any open error reports from the Issues service
- What the logical next task is

Then ask the user: "What are we working on today?" and wait for direction before writing any code.
