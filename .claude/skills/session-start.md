---
description: "Run at the beginning of every Claude Code session to establish context and verify build state"
command: "session-start"
---

# Session Start Checklist

Execute these steps in order. Do not skip any step. Report the results to the user.

## Step 1: Read Current State
Read `BUILD_HISTORY.md` and summarize the most recent entry (what was last done, current status).

## Step 2: Check for Uncommitted Work
Run `git status` and `git stash list`. If there are uncommitted changes or stashes, inform the user immediately — this means a previous session left unfinished work.

## Step 3: Verify Build State
Run these checks and report pass/fail for each:
- `cd frontend && npm run build` (frontend TypeScript + Vite build)
- For each Go module that the user will be working in, run `go build ./...`
- If unsure which module, ask the user what they're working on today

## Step 4: Identify the Work
Ask the user what they want to accomplish in this session. Based on their answer:
- Identify which layer(s) will be affected (connector, platform, domains, frontend)
- Read the layer-specific `CLAUDE.md` if one exists
- If the task will touch more than 2 files, note that planning is required before coding

## Step 5: Report
Present a brief status summary:
```
Session Ready
─────────────
Last work:    [summary from BUILD_HISTORY.md]
Uncommitted:  [none / list of files]
Build state:  [pass / fail with details]
Today's goal: [what the user said]
Layer(s):     [which layers are involved]
Planning:     [required / not required]
```
