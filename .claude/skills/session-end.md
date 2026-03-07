---
description: "Run at the end of every Claude Code session to verify, document, and close cleanly"
command: "session-end"
---

# Session End Checklist

Execute these steps in order. Do not skip any step.

## Step 1: Show All Changes
Run `git status` and `git diff --stat` to show the user exactly what changed.
If there are unstaged changes, list them explicitly.

## Step 2: Run All Tests in Modified Modules
Identify which Go modules and frontend files were modified. Run tests:
- For each modified Go module: `cd {module} && go test ./... -v -count=1`
- If frontend files changed: `cd frontend && npm test -- --run`
- If any test fails, stop and fix before proceeding

## Step 3: Lint Check
- For modified Go modules: `go vet ./...`
- For frontend: `npm run lint`

## Step 4: Update BUILD_HISTORY.md
If significant work was done (new features, bug fixes, architectural changes):
- Add a new entry at the top of BUILD_HISTORY.md (below the header, above existing entries)
- Format: `## [Brief Title] (YYYY-MM-DD)`
- Include: what changed, why, current status
- Ask the user to review the entry before committing

If only minor work (typos, config tweaks), skip this step.

## Step 5: Commit
If there are uncommitted changes and tests pass:
- Stage the relevant files (not `git add .` — be specific)
- Commit with the proper format: `[layer/component] Brief description`
- Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Step 6: Push and Verify CI
- Push to GitHub
- Show the CI run URL
- Wait for CI results and report pass/fail

## Step 7: Report
```
Session Complete
────────────────
Changes:      [N files modified, N files created]
Tests:        [all passing / failures noted]
Committed:    [commit hash and message]
CI:           [pass / pending / fail]
BUILD_HISTORY: [updated / not needed]
```
