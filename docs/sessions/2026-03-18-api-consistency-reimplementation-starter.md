# API Consistency Re-Implementation — Session Starter

> **Read this before writing any code.**

## Background

PR #79 (`claude/nostalgic-moser` — "API consistency + quality review close-out") cannot be merged due to massive rebase conflicts. The branch diverged from main during 10+ portal redesign sessions. The work needs to be **re-implemented fresh** on a new branch from current main.

**First steps:** Close PR #79, remove the `nostalgic-moser` worktree and branch, then start fresh.

```bash
gh pr close 79 --comment "Closing — will re-implement on fresh branch from current main. Branch diverged too far during portal redesign sessions."
git worktree remove .claude/worktrees/nostalgic-moser --force
git branch -D claude/nostalgic-moser
git push origin --delete claude/nostalgic-moser
```

## What PR #79 Did (Re-Implement All of This)

### 1. Shared `platform/apiresponse` Package (NEW — does not exist on main)

Create `platform/apiresponse/` with:
- `apiresponse.go` — `WriteSuccess`, `WriteError`, `WritePaginated`, `WriteJSON` helpers
- `apiresponse_test.go` — 6 tests (shape, error format, pagination, content-type, requestId presence, timestamp)
- `go.mod` — module `github.com/noui/platform/apiresponse`, Go 1.22, depends on `github.com/google/uuid`

**Key design:** Every response wraps in `{ "data": ..., "meta": { "requestId": "...", "timestamp": "...", "service": "..." } }`. Error responses use `{ "error": { "message": "...", "code": "..." }, "meta": { ... } }`.

### 2. Wire All Services to Shared Package (7 services)

Replace local `writeSuccess`/`writeError`/`writePaginated`/`writeJSON` functions in each service's `handlers.go` with calls to `apiresponse.WriteSuccess()` etc.

**Services to update:**
- `platform/dataaccess/api/handlers.go`
- `platform/intelligence/api/handlers.go`
- `platform/crm/api/handlers.go`
- `platform/correspondence/api/handlers.go`
- `platform/dataquality/api/handlers.go`
- `platform/knowledgebase/api/handlers.go`
- `platform/casemanagement/api/handlers.go`

Each service:
1. Add `require github.com/noui/platform/apiresponse v0.0.0` + `replace` directive to `go.mod`
2. Replace local helper functions with `apiresponse.WriteSuccess(w, status, "servicename", data)` etc.
3. Delete the local helper functions (~30 lines per service, ~210 lines total)
4. Update tests if they assert on response structure

### 3. Standardize `requestId` (camelCase)

**Current issue:** `platform/intelligence/api/handlers.go` uses `request_id` (snake_case) in two places. All other services use `requestId` (camelCase). The shared package enforces camelCase.

**Frontend:** Update `APIResponse` type in `frontend/src/lib/apiClient.ts` if it references `request_id`. Update ~30 test mock files that hardcode the meta field.

### 4. Delete Dead Code

- Delete `platform/dataaccess/models/response.go` (struct-based response types superseded by shared package)

## Key Patterns (from current main)

### Current local helper pattern (in each handlers.go):
```go
func writeSuccess(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "data": data,
        "meta": map[string]interface{}{
            "requestId": uuid.New().String(),
            "timestamp": time.Now().UTC().Format(time.RFC3339),
            "service":   "dataaccess",
        },
    })
}
```

### Target shared package call:
```go
apiresponse.WriteSuccess(w, http.StatusOK, "dataaccess", data)
```

## Verification

After implementation:
1. All Go services build: `cd platform/<service> && go build ./...` for each
2. All Go tests pass: `cd platform/<service> && go test ./... -short -count=1` for each
3. Frontend typecheck: `cd frontend && npx tsc --noEmit`
4. Frontend tests: `cd frontend && npx vitest run`
5. `platform/apiresponse` tests: `cd platform/apiresponse && go test ./... -v -count=1`

## Original Implementation Plan

The full task-by-task plan is preserved at:
`docs/plans/2026-03-16-api-consistency-final-regression.md` (on the `nostalgic-moser` branch — save it before deleting the branch, or reconstruct from this starter)

## CI Note

The CI workflow (`.github/workflows/ci.yml`) was fixed this session — platform service tests now run with `-short` flag, so RLS tests (which need live PostgreSQL) are properly skipped. The service matrix currently covers: `[dataaccess, intelligence, crm, correspondence, dataquality, knowledgebase]`. Consider adding `casemanagement, issues, preferences, security` to the matrix.
