# Session End

Wrap up this session cleanly with enforced exit gates.

## Gate 1: Test Suite

```bash
cd frontend && npm test -- --run 2>&1 | tail -5
```

If tests fail, STOP. Do not proceed until tests pass or failures are documented.

## Gate 2: Clean Working Tree

```bash
git status --short
```

If uncommitted changes exist:
- List the changed files
- Ask: "Commit these changes, or discard?"
- Do NOT proceed with uncommitted changes. Every session ends clean.

## Gate 3: Worktree Disposition + PR Status

```bash
# Detect if in worktree
git rev-parse --git-common-dir 2>/dev/null
BRANCH=$(git branch --show-current)
echo "Branch: $BRANCH"
```

If in a worktree, determine the branch state:

```bash
# Check if branch has been merged to master
git fetch origin
git branch --merged origin/master | grep "$BRANCH" && echo "MERGED" || echo "NOT_MERGED"

# Check if a PR exists for this branch
gh pr status --json headRefName,state,url 2>/dev/null || echo "No PR found"
```

### Path A — Branch merged to master

```
✓ Branch merged. Cleaning up:
  1. ExitWorktree (action: "remove") — removes worktree + local branch
  2. git push origin --delete [branch-name] — remove remote branch
  3. In main repo: git fetch origin && git merge --ff-only origin/master
```

Use the ExitWorktree tool with `action: "remove"`. This returns the session to the
main repo automatically. Then delete the remote branch and fast-forward master.

### Path B — PR exists, approved, not yet merged

```
✓ PR #[number] is approved and ready to merge.
  → Merge to master and clean up? (yes / keep for later)
```

**Ask for explicit confirmation.** If the user confirms:
1. `gh pr merge [number] --merge` — merge the PR
2. ExitWorktree (action: "remove") — removes worktree + local branch
3. `git push origin --delete [branch-name]` — remove remote branch
4. In main repo: `git fetch origin && git merge --ff-only origin/master`
5. Report: "PR merged, worktree removed, remote branch deleted, master updated."

If the user says "keep for later":
- ExitWorktree (action: "keep") — preserves worktree for follow-up

### Path C — Work complete, no PR yet

```
Branch ready for review. Creating PR:
  1. git push -u origin [branch-name]
  2. gh pr create --base master
  3. ExitWorktree (action: "keep") — preserves worktree for PR feedback
```

Push, create the PR, then use ExitWorktree with `action: "keep"`.
The worktree stays so the user can return if the PR needs changes.

### Path D — Work in progress

```
WIP branch. Options:
  1. Commit current state + ExitWorktree (action: "keep") — return later
  2. ExitWorktree (action: "remove", discard_changes: true) — abandon work
```

### Post-Merge Cleanup (can be triggered mid-session)

If at any point the user says "PR is merged", "clean up", or "merge and clean up":

**If PR not yet merged but approved — merge first (with confirmation):**
```bash
gh pr merge [number] --merge
```

**Then clean up:**
```bash
git fetch origin
# Verify merge
git branch --merged origin/master | grep "$BRANCH"
```

If confirmed merged:
1. ExitWorktree (action: "remove")
2. `git push origin --delete [branch-name]`
3. In main repo: `git fetch origin && git merge --ff-only origin/master`
4. Report: "PR merged, worktree removed, remote branch deleted, master updated."

## Gate 4: Stale Worktree Scan

```bash
git worktree list
git branch --merged master 2>/dev/null | grep -v '^\*' | grep -v master
```

Report any stale worktrees with cleanup commands.

## Step 5: Session Summary

```bash
git log --oneline origin/master..HEAD
git diff --stat origin/master..HEAD
```

## Step 6: CLAUDE.md Check

Were any corrections or learnings discovered this session? If yes, update CLAUDE.md.

## Step 7: Write Starter Prompt for Next Session

Write the starter prompt to **both** locations:

1. **Canonical (user-level memory):**
   `C:\Users\jeffb\.claude\projects\C--Users-jeffb-noui-platform/starter-prompt.md`
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

## Step 8: Memory Update

Update `C:\Users\jeffb\.claude\projects\C--Users-jeffb-noui-platform/project-status.md` with:
- What was completed
- Current test count
- What the next task should be

## Report

Session summary: commits, tests, files modified, CLAUDE.md updates, worktree status, starter prompt written, next task.
