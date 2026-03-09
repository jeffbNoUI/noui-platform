# Session End

Before ending this session, complete the following checklist:

## 1. Run all tests in modified modules

```bash
# Determine which layers were modified
git diff --name-only HEAD~$(git log --oneline | head -20 | wc -l) | head -50
```

Run tests for each modified layer:
- If connector/ changed: `cd connector && go test ./... -short -count=1`
- If platform/dataaccess/ changed: `cd platform/dataaccess && go test ./... -count=1`
- If platform/intelligence/ changed: `cd platform/intelligence && go test ./... -count=1`
- If platform/crm/ changed: `cd platform/crm && go test ./... -count=1`
- If platform/correspondence/ changed: `cd platform/correspondence && go test ./... -count=1`
- If platform/dataquality/ changed: `cd platform/dataquality && go test ./... -count=1`
- If platform/knowledgebase/ changed: `cd platform/knowledgebase && go test ./... -count=1`
- If frontend/ changed: `cd frontend && npx tsc --noEmit && npm test -- --run`

## 2. Show change summary

```bash
git diff --stat
git status --short
```

## 3. Update BUILD_HISTORY.md

If this session made significant changes, add an entry at the top of BUILD_HISTORY.md with:
- What was accomplished
- Key decisions made
- Any issues encountered and how they were resolved
- Current state for the next session

## 4. Commit and push

```bash
git add -A
git commit -m "[layer/component] Summary of session work"
git push origin HEAD
```

## 5. Report to user

Tell the user:
- What was accomplished this session
- Test results (all passing / any failures)
- What the logical next step would be
- Any open questions or blockers for the next session
