# Check Quality

Run a comprehensive quality check across all layers that have been modified in this session.

## Build verification
```bash
echo "=== Connector ==="
cd connector && go build ./... && echo "✅ Build OK" || echo "❌ Build FAILED"
cd ..

echo "=== Platform Services ==="
for svc in dataaccess intelligence crm correspondence dataquality knowledgebase; do
  cd platform/$svc && go build ./... && echo "✅ $svc Build OK" || echo "❌ $svc Build FAILED"
  cd ../..
done

echo "=== Frontend ==="
cd frontend && npx tsc --noEmit && echo "✅ Typecheck OK" || echo "❌ Typecheck FAILED"
npm run build 2>&1 | tail -3
cd ..
```

## Test verification
```bash
echo "=== Connector Tests ==="
cd connector && go test ./... -short -count=1 2>&1 | tail -10
cd ..

echo "=== Platform Tests ==="
for svc in dataaccess intelligence crm correspondence dataquality knowledgebase; do
  cd platform/$svc && echo "--- $svc ---" && go test ./... -count=1 2>&1 | tail -5
  cd ../..
done

echo "=== Frontend Tests ==="
cd frontend && npm test -- --run 2>&1 | tail -10
cd ..
```

## Layer boundary check
```bash
echo "=== Layer Boundary Violations ==="
# connector must not import platform
grep -rn "github.com/noui/platform/" connector/ --include="*.go" && echo "❌ VIOLATION: connector imports platform" || echo "✅ No connector→platform imports"

# platform must not import connector
grep -rn "github.com/noui/platform/connector" platform/ --include="*.go" && echo "❌ VIOLATION: platform imports connector" || echo "✅ No platform→connector imports"
```

## Uncommitted changes
```bash
echo "=== Git Status ==="
git status --short
git diff --stat
```

Report a summary: what's passing, what's broken, what needs attention.
