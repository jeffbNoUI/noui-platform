# Security Service Background Jobs — Design

> **Approved 2026-03-19.** In-process gocron scheduler with two jobs: session cleanup and brute-force detection.

## Decision: In-Process gocron (Not Dedicated Service)

At 2-500 users, a dedicated job runner service with PostgreSQL SKIP LOCKED is over-engineered. In-process `gocron` goroutines are the right fit: one dependency, zero new containers, zero inter-service HTTP. Jobs are plain functions with explicit dependencies (`*sql.DB`, config struct) — testable, extractable later if needed.

**Dependency:** `github.com/go-co-op/gocron/v2`

## Architecture

```
platform/security/
├── main.go              ← ADD: gocron scheduler lifecycle
├── api/handlers.go      ← MODIFY: stats include bruteForceAlerts24h
├── db/
│   ├── sessions.go      ← MODIFY: configurable timeout, CleanupExpiredSessions()
│   └── events.go        ← ADD: CountFailedLoginsByActor()
├── jobs/
│   ├── cleanup.go       ← NEW: session cleanup job
│   └── bruteforce.go    ← NEW: brute-force detection job
├── models/types.go      ← MODIFY: new event types + config struct
└── go.mod               ← ADD: gocron dependency
```

No new services. No new Docker containers. No migrations (security service auto-creates schema).

## Component 1: Scheduler Lifecycle (main.go)

Starts after HTTP server, shuts down on SIGINT/SIGTERM:

| Job | Interval | Function |
|-----|----------|----------|
| Session cleanup | 5 min | `jobs.CleanupExpiredSessions(db, cfg)` |
| Brute-force check | 1 min | `jobs.CheckBruteForce(db, cfg)` |

Both receive `*sql.DB` and a `JobConfig` struct — no globals, no store wrapper needed.

## Component 2: Session Cleanup

**Config (env vars → defaults):**
- `SESSION_IDLE_TIMEOUT_MIN` = 30
- `SESSION_MAX_LIFETIME_HR` = 8

**SQL:**
```sql
DELETE FROM active_sessions
WHERE last_seen_at < NOW() - INTERVAL '$idle_timeout minutes'
   OR started_at < NOW() - INTERVAL '$max_lifetime hours'
RETURNING session_id
```

Log count of cleaned sessions via slog.

**Side effect:** `ListActiveSessions` currently hardcodes `INTERVAL '30 minutes'`. Parameterize to use same idle timeout config.

## Component 3: Brute-Force Detection

**Config (env vars → defaults):**
- `BRUTE_FORCE_THRESHOLD` = 5
- `BRUTE_FORCE_WINDOW_MIN` = 15

**Detection query:**
```sql
SELECT actor_id, actor_email, ip_address, COUNT(*) as fail_count
FROM security_events
WHERE event_type = 'login_failure'
  AND created_at > NOW() - INTERVAL '$window minutes'
GROUP BY actor_id, actor_email, ip_address
HAVING COUNT(*) >= $threshold
```

**Dedup:** Before inserting alert, check if `brute_force_detected` event already exists for that actor in the same window. Skip if so.

**Alert event metadata:**
```json
{"failed_count": 7, "window_minutes": 15, "ip_address": "192.168.1.50"}
```

**New event type:** `brute_force_detected` added to `EventTypeValues`.

## Component 4: Stats Extension

`GetEventStats` adds `bruteForceAlerts24h` to the response — count of `brute_force_detected` events in last 24h.

## Frontend Impact

Zero changes needed. The cross-service audit trail already fetches all security events and renders them with "Security" source badges. Brute-force alerts appear automatically.

## Testing

- Unit tests for `CleanupExpiredSessions` — seed expired/active sessions, verify correct ones deleted
- Unit tests for `CheckBruteForce` — seed login failures, verify alert created, verify dedup
- Unit tests for `CountFailedLoginsByActor` — verify aggregation query
- Unit tests for configurable `ListActiveSessions` — verify parameterized timeout
- Existing 49 security tests must not regress

## Conflict Check

All changes within `platform/security/`. No overlap with employer domain work (`pedantic-kepler` worktree). Zero conflict risk.
