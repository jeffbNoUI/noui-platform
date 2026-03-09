# Tech Debt Cleanup

Scan the codebase for accumulated tech debt and clean up what's safe to fix.

## Scan

```bash
# Find TODOs and FIXMEs
echo "=== TODOs ==="
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.go" --include="*.ts" --include="*.tsx" connector/ platform/ frontend/src/ | head -30

# Find unused imports (Go)
echo "=== Go Vet ==="
cd connector && go vet ./... 2>&1 | head -10
for svc in dataaccess intelligence crm correspondence dataquality knowledgebase; do
  cd ../platform/$svc && go vet ./... 2>&1 | head -10
done
cd ../..

# Find large files that might need splitting
echo "=== Large files (>300 lines) ==="
find connector/ platform/ frontend/src/ -name "*.go" -o -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | sort -rn | head -20

# Check for any assumption markers that need DERP confirmation
echo "=== Open Assumptions ==="
grep -rn "ASSUMPTION:" --include="*.go" connector/ platform/ | head -20
```

## Prioritize

Report findings grouped by:
1. **Quick wins** — unused imports, dead code, simple cleanup (fix these now)
2. **Needs discussion** — TODOs that reference unresolved questions
3. **Structural** — files that are too large, abstractions that are leaking

## Fix quick wins

For anything that's clearly safe to fix (unused imports, formatting, dead code), fix it now.
Run tests after to confirm nothing broke.

For anything that needs discussion, list it and ask the user.
