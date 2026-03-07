---
description: "Run a comprehensive quality check across all modified code. Use mid-session to verify nothing is broken."
command: "check-quality"
---

# Quality Check

Run all verification steps and report results. Do not fix anything — just report.

## Step 1: Build Verification
Run builds for all layers that have uncommitted changes:

```bash
# Check which files are modified
git diff --name-only
git diff --cached --name-only
```

For each modified Go module, run `go build ./...`.
For frontend changes, run `cd frontend && npm run build`.

## Step 2: Test Verification
For each modified Go module, run `go test ./... -v -count=1 -short`.
For frontend, run `cd frontend && npm test -- --run`.

## Step 3: Lint Verification
For each modified Go module, run `go vet ./...`.
For frontend, run `cd frontend && npm run lint`.

## Step 4: Layer Boundary Check
Review the `git diff` output. Flag any violations:
- Does any file in `connector/` import from `platform/` or `domains/`?
- Does any file in `platform/` import from `connector/`?
- Are Go imports using the correct module path (`github.com/noui/platform/{service}`)?

## Step 5: Report
```
Quality Report
──────────────
Build:        [✓ pass / ✗ fail — details]
Tests:        [✓ N passed / ✗ N failed — details]
Lint:         [✓ clean / ⚠ N warnings / ✗ N errors]
Boundaries:   [✓ clean / ✗ violations found]
```
