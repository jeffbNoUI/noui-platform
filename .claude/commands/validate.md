# Validate

Mid-session quality gate. Run after significant changes to catch issues early.

## Step 1: Detect modified layers

```bash
git diff --name-only HEAD 2>/dev/null || git diff --name-only
git diff --cached --name-only
```

Determine which layers have changes.

## Step 2: Build check

For each modified layer:
- If `platform/migration/` changed: `cd platform/migration && go build ./...`
- If `platform/dataaccess/` changed: `cd platform/dataaccess && go build ./...`
- If `platform/intelligence/` changed: `cd platform/intelligence && go build ./...`
- If `connector/` changed: `cd connector && go build ./...`
- If `frontend/` changed: `cd frontend && npx tsc --noEmit`

If any build fails, STOP and report the error. Do not continue to tests.

## Step 3: Lint check

For each modified layer:
- If Go files changed: `go vet ./...` in each modified service directory
- If frontend files changed: `cd frontend && npx eslint src/ --max-warnings 30`

Report warnings but do not block on them.

## Step 4: Test check

For each modified layer:
- If `platform/migration/` changed: `cd platform/migration && go test ./... -short -count=1`
- If other platform services changed: `cd platform/{service} && go test ./... -short -count=1`
- If `frontend/` changed: `cd frontend && npm test -- --run`
- If `migration-intelligence/` changed: `cd migration-intelligence && python -m pytest`

## Report

```
## Validation Results
| Check | Status | Notes |
|-------|--------|-------|
| Build | PASS/FAIL | ... |
| Lint  | PASS/WARN | ... |
| Tests | PASS/FAIL | X/Y passing |

**Overall: [PASS/FAIL]**
```

If any FAIL, stop and fix before continuing implementation.
