# Session End

Wrap up this session cleanly with enforced exit gates.

## Gate 1: Test Suite

Run tests for each modified layer:
- If connector/ changed: `cd connector && go test ./... -short -count=1`
- If platform/* changed: `cd platform/<svc> && go test ./... -count=1` for each modified service
- If frontend/ changed: `cd frontend && npx tsc --noEmit && npm test -- --run`

If tests fail, STOP. Do not proceed until tests pass or failures are documented.

## Gate 2: Clean Working Tree

```bash
git status --short
```

If uncommitted changes exist:
- List the changed files
- Ask: "Commit these changes, or discard?"
- Do NOT proceed with uncommitted changes. Every session ends clean.

## Gate 3: Worktree Disposition

```bash
git rev-parse --git-common-dir 2>/dev/null
git branch --show-current
```

If in a worktree:
- Check if branch has been merged:
  ```bash
  git branch --merged main | grep "$(git branch --show-current)"
  ```
- **If merged:** Use app-managed cleanup:
  ```
  Branch merged. Cleaning up:
    1. ExitWorktree (action: "remove") — removes worktree + local branch
    2. git push origin --delete [branch-name] — remove remote branch
  ```

- **If not merged and work is complete:** Push and PR:
  ```
  Branch ready for review:
    1. git push -u origin [branch-name]
    2. gh pr create --base main
    3. ExitWorktree (action: "keep") — preserves worktree for follow-up
  ```

- **If not merged and work is in progress:**
  ```
  WIP branch:
    1. Commit current state + ExitWorktree (action: "keep") — return later
    2. ExitWorktree (action: "remove", discard_changes: true) — abandon work
  ```

## Gate 4: Stale Worktree Scan

```bash
git worktree list
git branch --merged main 2>/dev/null | grep -v '^\*' | grep -v main
```

Report any stale worktrees with cleanup commands.

## Step 5: Session Summary

```bash
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```

## Step 6: CLAUDE.md Check

Were any corrections or learnings discovered this session? If yes, update CLAUDE.md.

## Step 7: Update BUILD_HISTORY.md

If this session made significant changes, add an entry at the top of BUILD_HISTORY.md with:
- What was accomplished
- Key decisions made
- Any issues encountered and how they were resolved
- Current state for the next session

## Step 8: Write Starter Prompt for Next Session

Write the starter prompt to **both** locations:

1. **Canonical (user-level memory):**
   `~/.claude/projects/C--Users-jeffb-noui-platform/starter-prompt.md`
2. **In-repo copy (for PR context):**
   `.claude/starter-prompt-next-session.md`

Template:
```markdown
# Starter Prompt: [Brief description]

## What was completed last session
[Bullet list with specifics]

## Files changed
[List of files modified/created/deleted]

## Current project state
[Test count, phase status, known issues]

## What needs to happen next
[Concrete next steps with context]

## Key architecture notes for next session
[Patterns, gotchas, decisions — include file paths]

## Verification baseline
[Test count, validation commands]
```

Commit the in-repo copy:
```bash
git add .claude/starter-prompt-next-session.md
git commit -m "docs: update starter prompt for next session"
```

## Step 9: Memory Update

Update `~/.claude/projects/C--Users-jeffb-noui-platform/project-status.md` with:
- What was completed
- Current test count
- What the next task should be

## Report

Session summary: commits, tests, files modified, CLAUDE.md updates, worktree status, starter prompt written, next task.
