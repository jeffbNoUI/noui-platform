# Session Start

Prepare workspace for this session.

## Step 0: Context Identification (run first, always)

Detect where this session is running:

```bash
# Detect project from CLAUDE.md first line
head -1 CLAUDE.md 2>/dev/null || echo "NO CLAUDE.md FOUND"
# Detect if in a worktree
git rev-parse --show-toplevel 2>/dev/null
git worktree list 2>/dev/null | head -5
# Current branch
git branch --show-current
# Commits ahead of master/main
git rev-list --count origin/master..HEAD 2>/dev/null || git rev-list --count origin/main..HEAD 2>/dev/null || echo "0"
```

Report as a context block:

```
## Context Check
- Project:    [detected from CLAUDE.md header]
- Location:   [Main repo | Worktree (path)]
- Branch:     [current branch name]
- Base:       master ([N] commits ahead)
- Dirty:      [YES — list files | NO]
```

**GATE: If dirty state detected, STOP.** Report:
```
BLOCKED: Dirty working tree — [N] uncommitted files detected.
Commit or discard changes before starting a new session.
Run `git status` to see details.
```
Do not proceed past this gate until the working tree is clean.

## Step 1: Stale Worktree Scan

```bash
git worktree list
git branch --merged master 2>/dev/null | grep -v '^\*' | grep -v master
```

If stale worktrees found (worktree branch already merged):
```
WARNING: Stale worktree detected:
  Path:   [worktree-path]
  Branch: [branch] (already merged)
  Action: git worktree remove [path] && git branch -d [branch]
```

## Step 2: Sync with Remote

```bash
git fetch origin
git merge --ff-only origin/master 2>/dev/null || git merge --ff-only origin/main 2>/dev/null || echo "Already up to date or not on main branch"
```

## Step 3: Show Project State

Show the project's build plan or task list — read the first 7 lines of the primary
task tracking file (BUILD_PLAN.md, TODO.md, or equivalent).

## Step 4: Verify Baseline Tests

```bash
cd frontend && npm test -- --run 2>&1 | tail -5
```

## Step 5: Read Starter Prompt

Check for the starter prompt in priority order (user-level survives worktree removal):

1. **User-level memory (canonical):**
   `C:\Users\jeffb\.claude\projects\C--Users-jeffb-noui-platform/starter-prompt.md`
2. **In-repo fallback:**
   `.claude/starter-prompt-next-session.md`

Read whichever exists (prefer user-level). This is the handoff from the previous session.

If the user provided arguments to `/session-start`, follow those instead.

## Step 6: Read Behavioral Guidelines

Read CLAUDE.md behavioral guidelines section.

## Step 7: Session Naming Reminder

If this session wasn't started with `claude --name "task-id-description"`, recommend doing so.

## Report

Report concisely: context check, sync status, stale worktrees (if any), test count,
starter prompt summary (if found), and current next task.

Then print the quick reference:

```
Quick Reference:
  Shift+Tab        Plan mode (persona review runs if needed)
  /validate        After significant changes — lint + test check
  /precommit       Before committing — graded 4-category evaluation
  /commit          Stage + commit with proper message
  /simplify        After task complete — iterative cleanup (up to 3 cycles)
  /session-end     End session — exit gates, starter prompt, clean state
```
