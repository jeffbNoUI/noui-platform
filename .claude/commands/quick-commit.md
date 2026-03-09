# Quick Commit

Stage all changes, generate a descriptive commit message following the project convention, and push.

## Steps

1. Show what's being committed:
```bash
git diff --stat
git status --short
```

2. Determine the primary layer affected and generate a commit message:
- Format: `[layer/component] Brief description`
- If multiple layers changed, use the primary one or `[multi]`
- Include a brief body if the change is non-obvious

3. Stage, commit, and push:
```bash
git add -A
git commit -m "[layer/component] Description"
git push origin HEAD
```

4. Confirm success:
```bash
git log --oneline -1
```
