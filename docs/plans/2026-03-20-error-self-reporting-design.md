# Error Self-Reporting Pipeline — Design Document

**Date:** 2026-03-20
**Goal:** Create a feedback loop where user-facing runtime errors are automatically logged as Issues, deduplicated, and surfaced to Claude Code at session start for triage and remediation.

---

## Overview

Three components working together:

1. **Frontend Error Reporter** — Captures user-facing errors and POSTs them to the Issues service
2. **Issues Service Error Intake** — Receives reports, deduplicates via fingerprinting, creates/updates Issues
3. **Session-Start Integration** — Surfaces unresolved error-reports when Claude Code starts a session

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Extend Issues service, not a new microservice | Issues already has the data model, lifecycle, and tenant isolation. One new endpoint is simpler than a new service. |
| Fire-and-forget from frontend | Error reporting must never block or degrade the user experience. |
| Fingerprint-based dedup | Same error (errorCode + url + httpStatus) gets one Issue with occurrence tracking, not N duplicates. |
| Every error creates/updates an Issue | During active development, every error is signal. Will relax threshold for production/user testing. |
| `[Auto]` prefix on titles | Distinguishes system-reported errors from human-filed issues. |
| Session-start is read-only triage | Claude Code surfaces errors and asks which to investigate. No auto-fix until trust is established. |

---

## Component 1: Frontend Error Reporter

### Module: `frontend/src/lib/errorReporter.ts`

**Function signature:**
```typescript
export function reportError(error: {
  requestId: string;
  url: string;
  httpStatus: number;
  errorCode: string;
  errorMessage: string;
  portal: string;          // staff | member | employer | retirement
  route: string;           // window.location.pathname
  componentStack?: string; // from ErrorBoundary only
}): void
```

**Behavior:**
- POSTs to `/api/v1/errors/report` on the Issues service (port 8092)
- Fire-and-forget: no `await`, wrapped in try/catch
- Skips reporting if the failed URL is the error reporting endpoint itself (infinite loop guard)
- Forwards the user's existing JWT for tenant scoping

### Integration Points

**1. `apiClient.ts` — after retry exhaustion:**
- On 4xx/5xx after all retries, call `reportError()` with:
  - `requestId` from the response envelope or generated ID
  - `url` — the endpoint that failed
  - `httpStatus` — the response status code
  - `errorCode` — from `error.code` in the response envelope
  - `errorMessage` — from `error.message` in the response envelope
  - `portal` — determined from current route context
  - `route` — `window.location.pathname`

**2. `ErrorBoundary.tsx` — in componentDidCatch:**
- Call `reportError()` with:
  - `requestId` — generate a UUID
  - `url` — empty string (no API call involved)
  - `httpStatus` — 0 (not an HTTP error)
  - `errorCode` — `"REACT_CRASH"`
  - `errorMessage` — `error.message`
  - `portal` — from `portalName` prop
  - `route` — `window.location.pathname`
  - `componentStack` — from `errorInfo.componentStack`

---

## Component 2: Issues Service Error Intake

### New Endpoint: `POST /api/v1/errors/report`

**Request type:**
```go
type ErrorReport struct {
    RequestID      string `json:"requestId"`
    URL            string `json:"url"`
    HTTPStatus     int    `json:"httpStatus"`
    ErrorCode      string `json:"errorCode"`
    ErrorMessage   string `json:"errorMessage"`
    Portal         string `json:"portal"`
    Route          string `json:"route"`
    ComponentStack string `json:"componentStack,omitempty"`
}
```

**Validation:**
- `requestId` — required
- `url` — required (unless REACT_CRASH)
- `httpStatus` — required, >= 0

### Deduplication Logic

**Fingerprint:** `sha256(errorCode + ":" + url + ":" + strconv.Itoa(httpStatus))`

The fingerprint is embedded in the issue description as `fingerprint:{hash}` for future matching.

**Lookup:** Query for existing open issue with matching fingerprint:
```sql
SELECT id FROM issues
WHERE tenant_id = $1
  AND category = 'error-report'
  AND description LIKE '%fingerprint:' || $2 || '%'
  AND status NOT IN ('resolved', 'closed')
LIMIT 1
```

### Existing Issue Found → Update

1. Parse current occurrence count from title
2. Update title: `"[Auto] {errorCode}: {method} {urlPath} — {count+1} occurrences"`
3. Add a comment with this occurrence's details:
   ```
   Occurrence at {timestamp}
   Request ID: {requestId}
   Portal: {portal}
   Route: {route}
   User: {userId}
   ```

### No Existing Issue → Create

| Field | Value |
|-------|-------|
| `title` | `"[Auto] {errorCode}: {method} {urlPath}"` |
| `description` | Full error details + `fingerprint:{hash}` |
| `category` | `"error-report"` |
| `severity` | 5xx → `"high"`, 4xx → `"medium"`, REACT_CRASH → `"critical"` |
| `status` | `"open"` |
| `reported_by` | `"system:error-reporter"` |
| `affected_service` | Parsed from URL path (e.g., `/api/v1/members` → `"dataaccess"`) |

### Schema Change

Add `"error-report"` to category enum validation in `models/types.go`. No new tables or columns required.

---

## Component 3: Session-Start Integration

### New Query Endpoint: `GET /api/v1/errors/recent`

**Query parameters:**
- `since` — ISO8601 timestamp, only return issues reported after this time
- `status` — filter by status (default: `open`)

**Response:** Standard paginated response, filtered to `category=error-report`, sorted by most recent first.

### Session-Start Skill Update

Add a step after the build health check:

1. Call `GET /api/v1/errors/recent?since={last_session_date}&status=open`
2. If errors exist, display summary table:
   ```
   ## Unresolved Error Reports
   | Issue | Error | Service | Occurrences | First Seen |
   |-------|-------|---------|-------------|------------|
   | ISS-47 | DB_ERROR: GET /api/v1/members | dataaccess | 3 | 2026-03-19 |
   ```
3. Ask: "Want me to investigate any of these?"
4. If no errors or service unreachable: silently skip

**Fail-safe:** The Issues service may not be running during local dev. The session-start step fails silently — a network error means "skip error review," not "block the session."

---

## Future Enhancements (Not In Scope)

- **Scheduled mode:** `/loop` or cron that periodically checks for new errors and auto-investigates
- **Auto-investigate (B mode):** Claude Code traces errors through codebase and proposes fixes
- **Auto-fix (C mode):** Claude Code fixes obvious issues and commits to a branch
- **Relaxed thresholds:** For production, require N occurrences before creating an Issue
- **Error rate alerting:** Prometheus metrics for error rates by service
- **Stack trace capture:** Backend stack traces correlated via request ID

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/lib/errorReporter.ts` | Create | Error reporting module |
| `frontend/src/lib/apiClient.ts` | Modify | Add reportError call after retry exhaustion |
| `frontend/src/components/ErrorBoundary.tsx` | Modify | Add reportError call in componentDidCatch |
| `platform/issues/models/types.go` | Modify | Add `"error-report"` category, `ErrorReport` type |
| `platform/issues/api/handlers.go` | Modify | Add `ReportError` handler |
| `platform/issues/db/issues.go` | Modify | Add `FindByFingerprint`, update occurrence logic |
| `platform/issues/main.go` | Modify | Register new route |
| `.claude/commands/session-start.md` | Modify | Add error review step |

---

*NoUI Platform — Error Self-Reporting Pipeline v1.0*
