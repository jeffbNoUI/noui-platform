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

Report:
- What the last session accomplished
- Whether builds are clean or broken
- Any uncommitted changes from a prior session
- What the logical next task is

Then ask the user: "What are we working on today?" and wait for direction before writing any code.
