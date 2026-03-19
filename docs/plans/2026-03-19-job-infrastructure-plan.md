# Security Service Background Jobs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add in-process gocron scheduler to the security service with two background jobs: session cleanup and brute-force detection.

**Architecture:** gocron goroutines run alongside the HTTP server in main.go. Job functions live in `platform/security/jobs/` and take `*sql.DB` + config — no globals, fully testable with sqlmock. New store methods in `db/sessions.go` and `db/events.go` for the SQL operations. Stats endpoint extended with brute-force alert count.

**Tech Stack:** Go 1.22, gocron/v2, sqlmock for tests, PostgreSQL

---

## Task 1: Add JobConfig and brute_force_detected Event Type

**Files:**
- Modify: `platform/security/models/types.go`

**Step 1: Add JobConfig struct and brute_force_detected to EventTypeValues**

In `platform/security/models/types.go`, add after `ClerkWebhookPayload`:

```go
// JobConfig holds configuration for background jobs, loaded from environment variables.
type JobConfig struct {
	SessionIdleTimeoutMin int // SESSION_IDLE_TIMEOUT_MIN, default 30
	SessionMaxLifetimeHr  int // SESSION_MAX_LIFETIME_HR, default 8
	BruteForceThreshold   int // BRUTE_FORCE_THRESHOLD, default 5
	BruteForceWindowMin   int // BRUTE_FORCE_WINDOW_MIN, default 15
}
```

Add `"brute_force_detected"` to `EventTypeValues` slice.

Add after `EventStats`:

```go
// BruteForceActor represents an actor who exceeded the failed login threshold.
type BruteForceActor struct {
	ActorID    string `json:"actorId"`
	ActorEmail string `json:"actorEmail"`
	IPAddress  string `json:"ipAddress"`
	FailCount  int    `json:"failCount"`
}
```

**Step 2: Extend EventStats with BruteForceAlerts24h**

Add field to `EventStats`:

```go
type EventStats struct {
	ActiveUsers          int `json:"activeUsers"`
	ActiveSessions       int `json:"activeSessions"`
	FailedLogins24h      int `json:"failedLogins24h"`
	RoleChanges7d        int `json:"roleChanges7d"`
	BruteForceAlerts24h  int `json:"bruteForceAlerts24h"`
}
```

**Step 3: Run existing tests to verify no regression**

Run: `cd platform/security && go test ./... -short -count=1`
Expected: All 49 tests PASS (the stats test will need updating — see Task 5)

**Step 4: Commit**

```bash
git add platform/security/models/types.go
git commit -m "[platform/security] Add JobConfig, BruteForceActor types and brute_force_detected event type"
```

---

## Task 2: Session Cleanup Store Method + Tests

**Files:**
- Modify: `platform/security/db/sessions.go`
- Modify: `platform/security/api/handlers_test.go` (add test)

**Step 1: Write the failing test**

Add to `platform/security/api/handlers_test.go` (reuses sqlmock pattern):

```go
func TestCleanupExpiredSessions(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	store := secdb.NewStore(db)

	mock.ExpectExec("DELETE FROM active_sessions").
		WillReturnResult(sqlmock.NewResult(0, 3))

	count, err := store.CleanupExpiredSessions(context.Background(), 30, 8)
	if err != nil {
		t.Fatalf("CleanupExpiredSessions error: %v", err)
	}
	if count != 3 {
		t.Errorf("cleaned = %d, want 3", count)
	}
}
```

Add `"context"` and `secdb "github.com/noui/platform/security/db"` to imports in handlers_test.go.

**Step 2: Run test to verify it fails**

Run: `cd platform/security && go test ./api/ -run TestCleanupExpiredSessions -v`
Expected: FAIL — `store.CleanupExpiredSessions` not defined

**Step 3: Implement CleanupExpiredSessions**

Add to `platform/security/db/sessions.go`:

```go
// CleanupExpiredSessions deletes sessions that are idle or exceeded max lifetime.
// Returns the number of sessions deleted.
func (s *Store) CleanupExpiredSessions(ctx context.Context, idleTimeoutMin, maxLifetimeHr int) (int64, error) {
	result, err := s.DB.ExecContext(ctx,
		`DELETE FROM active_sessions
		 WHERE last_seen_at < NOW() - ($1 || ' minutes')::INTERVAL
		    OR started_at < NOW() - ($2 || ' hours')::INTERVAL`,
		idleTimeoutMin, maxLifetimeHr,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
```

**Step 4: Run test to verify it passes**

Run: `cd platform/security && go test ./api/ -run TestCleanupExpiredSessions -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/security/db/sessions.go platform/security/api/handlers_test.go
git commit -m "[platform/security] Add CleanupExpiredSessions store method"
```

---

## Task 3: Parameterize ListActiveSessions + Test

**Files:**
- Modify: `platform/security/db/sessions.go`
- Modify: `platform/security/api/handlers.go` (pass config)

Currently `ListActiveSessions` hardcodes `INTERVAL '30 minutes'`. We need to parameterize it.

**Step 1: Update ListActiveSessions signature**

Change `ListActiveSessions` in `platform/security/db/sessions.go` to accept timeout:

```go
// ListActiveSessions returns sessions seen within the given idle timeout.
func (s *Store) ListActiveSessions(ctx context.Context, tenantID string, idleTimeoutMin ...int) ([]models.ActiveSession, error) {
	timeout := 30
	if len(idleTimeoutMin) > 0 && idleTimeoutMin[0] > 0 {
		timeout = idleTimeoutMin[0]
	}

	query := fmt.Sprintf(
		"SELECT %s FROM active_sessions s WHERE s.tenant_id = $1 AND s.last_seen_at > NOW() - ($2 || ' minutes')::INTERVAL ORDER BY s.last_seen_at DESC",
		sessionColumns,
	)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, query, tenantID, timeout)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.ActiveSession
	for rows.Next() {
		sess, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, *sess)
	}

	return sessions, rows.Err()
}
```

Note: Using variadic `idleTimeoutMin ...int` maintains backward compatibility — existing callers don't need to change. The handler continues to call `store.ListActiveSessions(ctx, tid)` with no timeout arg, which defaults to 30.

**Step 2: Run all tests to verify no regression**

Run: `cd platform/security && go test ./... -short -count=1`
Expected: All tests PASS (existing tests don't pass a timeout, so they use the default 30)

**Step 3: Commit**

```bash
git add platform/security/db/sessions.go
git commit -m "[platform/security] Parameterize ListActiveSessions idle timeout"
```

---

## Task 4: CountFailedLoginsByActor Store Method + Tests

**Files:**
- Modify: `platform/security/db/events.go`
- Modify: `platform/security/api/handlers_test.go` (add tests)

**Step 1: Write the failing tests**

Add to `platform/security/api/handlers_test.go`:

```go
func TestCountFailedLoginsByActor_AboveThreshold(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	store := secdb.NewStore(db)

	mock.ExpectQuery("SELECT actor_id, actor_email, ip_address").
		WillReturnRows(sqlmock.NewRows([]string{"actor_id", "actor_email", "ip_address", "fail_count"}).
			AddRow("user-1", "user@example.com", "10.0.0.1", 7).
			AddRow("user-2", "user2@example.com", "10.0.0.2", 5))

	actors, err := store.CountFailedLoginsByActor(context.Background(), 5, 15)
	if err != nil {
		t.Fatalf("CountFailedLoginsByActor error: %v", err)
	}
	if len(actors) != 2 {
		t.Fatalf("got %d actors, want 2", len(actors))
	}
	if actors[0].FailCount != 7 {
		t.Errorf("actors[0].FailCount = %d, want 7", actors[0].FailCount)
	}
}

func TestCountFailedLoginsByActor_NoneAboveThreshold(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	store := secdb.NewStore(db)

	mock.ExpectQuery("SELECT actor_id, actor_email, ip_address").
		WillReturnRows(sqlmock.NewRows([]string{"actor_id", "actor_email", "ip_address", "fail_count"}))

	actors, err := store.CountFailedLoginsByActor(context.Background(), 5, 15)
	if err != nil {
		t.Fatalf("CountFailedLoginsByActor error: %v", err)
	}
	if len(actors) != 0 {
		t.Errorf("got %d actors, want 0", len(actors))
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/security && go test ./api/ -run TestCountFailedLoginsByActor -v`
Expected: FAIL — method not defined

**Step 3: Implement CountFailedLoginsByActor**

Add to `platform/security/db/events.go`:

```go
// CountFailedLoginsByActor returns actors who exceeded the failed login threshold within the window.
func (s *Store) CountFailedLoginsByActor(ctx context.Context, threshold, windowMin int) ([]models.BruteForceActor, error) {
	rows, err := s.DB.QueryContext(ctx,
		`SELECT actor_id, actor_email, ip_address, COUNT(*) AS fail_count
		 FROM security_events
		 WHERE event_type = 'login_failure'
		   AND created_at > NOW() - ($1 || ' minutes')::INTERVAL
		 GROUP BY actor_id, actor_email, ip_address
		 HAVING COUNT(*) >= $2`,
		windowMin, threshold,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var actors []models.BruteForceActor
	for rows.Next() {
		var a models.BruteForceActor
		if err := rows.Scan(&a.ActorID, &a.ActorEmail, &a.IPAddress, &a.FailCount); err != nil {
			return nil, err
		}
		actors = append(actors, a)
	}
	return actors, rows.Err()
}
```

**Step 4: Add HasRecentBruteForceAlert for dedup**

Add to `platform/security/db/events.go`:

```go
// HasRecentBruteForceAlert checks if a brute_force_detected event exists for the actor in the window.
func (s *Store) HasRecentBruteForceAlert(ctx context.Context, actorID string, windowMin int) (bool, error) {
	var count int
	err := s.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM security_events
		 WHERE event_type = 'brute_force_detected'
		   AND actor_id = $1
		   AND created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
		actorID, windowMin,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
```

**Step 5: Add dedup test**

Add to `platform/security/api/handlers_test.go`:

```go
func TestHasRecentBruteForceAlert(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	store := secdb.NewStore(db)

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	has, err := store.HasRecentBruteForceAlert(context.Background(), "user-1", 15)
	if err != nil {
		t.Fatalf("HasRecentBruteForceAlert error: %v", err)
	}
	if !has {
		t.Error("expected true, got false")
	}
}
```

**Step 6: Run tests to verify they pass**

Run: `cd platform/security && go test ./api/ -run "TestCountFailedLoginsByActor|TestHasRecentBruteForceAlert" -v`
Expected: All 3 new tests PASS

**Step 7: Commit**

```bash
git add platform/security/db/events.go platform/security/api/handlers_test.go
git commit -m "[platform/security] Add CountFailedLoginsByActor and HasRecentBruteForceAlert store methods"
```

---

## Task 5: Extend GetEventStats with BruteForceAlerts24h + Fix Test

**Files:**
- Modify: `platform/security/db/events.go`
- Modify: `platform/security/api/handlers_test.go`

**Step 1: Update GetEventStats query**

In `platform/security/db/events.go`, update the `GetEventStats` method to add a 5th subquery:

```go
func (s *Store) GetEventStats(ctx context.Context, tenantID string) (*models.EventStats, error) {
	stats := &models.EventStats{}

	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(DISTINCT actor_id) FROM security_events
			 WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '24 hours') AS active_users,
			(SELECT COUNT(*) FROM active_sessions
			 WHERE tenant_id = $1 AND last_seen_at > NOW() - INTERVAL '30 minutes') AS active_sessions,
			(SELECT COUNT(*) FROM security_events
			 WHERE tenant_id = $1 AND event_type = 'login_failure' AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h,
			(SELECT COUNT(*) FROM security_events
			 WHERE tenant_id = $1 AND event_type = 'role_change' AND created_at > NOW() - INTERVAL '7 days') AS role_changes_7d,
			(SELECT COUNT(*) FROM security_events
			 WHERE tenant_id = $1 AND event_type = 'brute_force_detected' AND created_at > NOW() - INTERVAL '24 hours') AS brute_force_alerts_24h
	`, tenantID).Scan(&stats.ActiveUsers, &stats.ActiveSessions, &stats.FailedLogins24h, &stats.RoleChanges7d, &stats.BruteForceAlerts24h)
	if err != nil {
		return nil, err
	}

	return stats, nil
}
```

**Step 2: Update TestGetEventStats mock**

In `platform/security/api/handlers_test.go`, find `TestGetEventStats` and update the mock to return 5 columns:

```go
func TestGetEventStats(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs(defaultTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"active_users", "active_sessions", "failed_logins_24h", "role_changes_7d", "brute_force_alerts_24h"}).
			AddRow(12, 5, 3, 1, 2))

	w := serve(h, "GET", "/api/v1/security/events/stats", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("GetEventStats status = %d, want %d\nbody: %s",
			w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data models.EventStats      `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if body.Data.ActiveUsers != 12 {
		t.Errorf("ActiveUsers = %d, want 12", body.Data.ActiveUsers)
	}
	if body.Data.FailedLogins24h != 3 {
		t.Errorf("FailedLogins24h = %d, want 3", body.Data.FailedLogins24h)
	}
	if body.Data.BruteForceAlerts24h != 2 {
		t.Errorf("BruteForceAlerts24h = %d, want 2", body.Data.BruteForceAlerts24h)
	}
	if body.Meta["requestId"] == nil || body.Meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
}
```

**Step 3: Run tests**

Run: `cd platform/security && go test ./... -short -count=1`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add platform/security/db/events.go platform/security/api/handlers_test.go
git commit -m "[platform/security] Extend EventStats with bruteForceAlerts24h"
```

---

## Task 6: Session Cleanup Job + Tests

**Files:**
- Create: `platform/security/jobs/cleanup.go`
- Create: `platform/security/jobs/cleanup_test.go`

**Step 1: Write the test**

Create `platform/security/jobs/cleanup_test.go`:

```go
package jobs

import (
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/security/models"
)

func TestCleanupExpiredSessions_DeletesSome(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectExec("DELETE FROM active_sessions").
		WillReturnResult(sqlmock.NewResult(0, 5))

	cfg := models.JobConfig{
		SessionIdleTimeoutMin: 30,
		SessionMaxLifetimeHr:  8,
	}

	// Should not panic or error — it logs internally
	CleanupExpiredSessions(db, cfg)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCleanupExpiredSessions_DeletesNone(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectExec("DELETE FROM active_sessions").
		WillReturnResult(sqlmock.NewResult(0, 0))

	cfg := models.JobConfig{
		SessionIdleTimeoutMin: 30,
		SessionMaxLifetimeHr:  8,
	}

	CleanupExpiredSessions(db, cfg)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/security && go test ./jobs/ -run TestCleanupExpiredSessions -v`
Expected: FAIL — package/function not defined

**Step 3: Implement the cleanup job**

Create `platform/security/jobs/cleanup.go`:

```go
// Package jobs contains background job functions for the security service.
package jobs

import (
	"context"
	"database/sql"
	"log/slog"

	"github.com/noui/platform/security/models"
)

// CleanupExpiredSessions deletes sessions that are idle or exceeded max lifetime.
func CleanupExpiredSessions(db *sql.DB, cfg models.JobConfig) {
	result, err := db.ExecContext(context.Background(),
		`DELETE FROM active_sessions
		 WHERE last_seen_at < NOW() - ($1 || ' minutes')::INTERVAL
		    OR started_at < NOW() - ($2 || ' hours')::INTERVAL`,
		cfg.SessionIdleTimeoutMin, cfg.SessionMaxLifetimeHr,
	)
	if err != nil {
		slog.Error("session cleanup failed", "error", err)
		return
	}

	count, _ := result.RowsAffected()
	if count > 0 {
		slog.Info("cleaned up expired sessions", "count", count,
			"idle_timeout_min", cfg.SessionIdleTimeoutMin,
			"max_lifetime_hr", cfg.SessionMaxLifetimeHr)
	}
}
```

**Step 4: Run test to verify it passes**

Run: `cd platform/security && go test ./jobs/ -run TestCleanupExpiredSessions -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/security/jobs/cleanup.go platform/security/jobs/cleanup_test.go
git commit -m "[platform/security] Add session cleanup background job"
```

---

## Task 7: Brute-Force Detection Job + Tests

**Files:**
- Create: `platform/security/jobs/bruteforce.go`
- Create: `platform/security/jobs/bruteforce_test.go`

**Step 1: Write the tests**

Create `platform/security/jobs/bruteforce_test.go`:

```go
package jobs

import (
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/security/models"
)

func TestCheckBruteForce_DetectsAndCreatesAlert(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	cfg := models.JobConfig{
		BruteForceThreshold: 5,
		BruteForceWindowMin: 15,
	}

	// Step 1: query returns one actor above threshold
	mock.ExpectQuery("SELECT actor_id, actor_email, ip_address").
		WillReturnRows(sqlmock.NewRows([]string{"actor_id", "actor_email", "ip_address", "fail_count"}).
			AddRow("user-1", "user@example.com", "10.0.0.1", 7))

	// Step 2: check for existing alert — none found
	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	// Step 3: insert brute_force_detected event
	mock.ExpectExec("INSERT INTO security_events").
		WillReturnResult(sqlmock.NewResult(1, 1))

	CheckBruteForce(db, cfg)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCheckBruteForce_SkipsDuplicateAlert(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	cfg := models.JobConfig{
		BruteForceThreshold: 5,
		BruteForceWindowMin: 15,
	}

	// Actor above threshold
	mock.ExpectQuery("SELECT actor_id, actor_email, ip_address").
		WillReturnRows(sqlmock.NewRows([]string{"actor_id", "actor_email", "ip_address", "fail_count"}).
			AddRow("user-1", "user@example.com", "10.0.0.1", 7))

	// Existing alert found — should skip insert
	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	// No INSERT expected

	CheckBruteForce(db, cfg)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCheckBruteForce_NobodyAboveThreshold(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	cfg := models.JobConfig{
		BruteForceThreshold: 5,
		BruteForceWindowMin: 15,
	}

	mock.ExpectQuery("SELECT actor_id, actor_email, ip_address").
		WillReturnRows(sqlmock.NewRows([]string{"actor_id", "actor_email", "ip_address", "fail_count"}))

	CheckBruteForce(db, cfg)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
```

**Step 2: Run tests to verify they fail**

Run: `cd platform/security && go test ./jobs/ -run TestCheckBruteForce -v`
Expected: FAIL — function not defined

**Step 3: Implement brute-force detection job**

Create `platform/security/jobs/bruteforce.go`:

```go
package jobs

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	"github.com/noui/platform/security/models"
)

// CheckBruteForce detects actors who exceeded the failed login threshold and creates alert events.
func CheckBruteForce(db *sql.DB, cfg models.JobConfig) {
	ctx := context.Background()

	// Find actors above threshold
	rows, err := db.QueryContext(ctx,
		`SELECT actor_id, actor_email, ip_address, COUNT(*) AS fail_count
		 FROM security_events
		 WHERE event_type = 'login_failure'
		   AND created_at > NOW() - ($1 || ' minutes')::INTERVAL
		 GROUP BY actor_id, actor_email, ip_address
		 HAVING COUNT(*) >= $2`,
		cfg.BruteForceWindowMin, cfg.BruteForceThreshold,
	)
	if err != nil {
		slog.Error("brute-force check query failed", "error", err)
		return
	}
	defer rows.Close()

	var actors []models.BruteForceActor
	for rows.Next() {
		var a models.BruteForceActor
		if err := rows.Scan(&a.ActorID, &a.ActorEmail, &a.IPAddress, &a.FailCount); err != nil {
			slog.Error("brute-force scan failed", "error", err)
			return
		}
		actors = append(actors, a)
	}
	if err := rows.Err(); err != nil {
		slog.Error("brute-force rows error", "error", err)
		return
	}

	for _, actor := range actors {
		// Dedup: check if alert already exists for this actor in the window
		var alertCount int
		err := db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM security_events
			 WHERE event_type = 'brute_force_detected'
			   AND actor_id = $1
			   AND created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
			actor.ActorID, cfg.BruteForceWindowMin,
		).Scan(&alertCount)
		if err != nil {
			slog.Error("brute-force dedup check failed", "error", err, "actor_id", actor.ActorID)
			continue
		}
		if alertCount > 0 {
			continue
		}

		// Insert alert event
		metadata := fmt.Sprintf(`{"failed_count":%d,"window_minutes":%d,"ip_address":"%s"}`,
			actor.FailCount, cfg.BruteForceWindowMin, actor.IPAddress)

		_, err = db.ExecContext(ctx,
			`INSERT INTO security_events (tenant_id, event_type, actor_id, actor_email, ip_address, metadata)
			 VALUES ((SELECT COALESCE(
			   (SELECT DISTINCT tenant_id FROM security_events WHERE actor_id = $1 ORDER BY tenant_id LIMIT 1),
			   '00000000-0000-0000-0000-000000000001'::UUID
			 )), 'brute_force_detected', $1, $2, $3, $4)`,
			actor.ActorID, actor.ActorEmail, actor.IPAddress, metadata,
		)
		if err != nil {
			slog.Error("brute-force alert insert failed", "error", err, "actor_id", actor.ActorID)
			continue
		}

		slog.Warn("brute-force detected",
			"actor_id", actor.ActorID,
			"actor_email", actor.ActorEmail,
			"ip_address", actor.IPAddress,
			"failed_count", actor.FailCount,
			"window_minutes", cfg.BruteForceWindowMin)
	}
}
```

**Step 4: Run tests to verify they pass**

Run: `cd platform/security && go test ./jobs/ -v`
Expected: All 5 job tests PASS

**Step 5: Commit**

```bash
git add platform/security/jobs/bruteforce.go platform/security/jobs/bruteforce_test.go
git commit -m "[platform/security] Add brute-force detection background job"
```

---

## Task 8: Wire gocron into main.go

**Files:**
- Modify: `platform/security/main.go`
- Modify: `platform/security/go.mod`

**Step 1: Add gocron dependency**

Run: `cd platform/security && go get github.com/go-co-op/gocron/v2`

**Step 2: Add JobConfig loading and scheduler to main.go**

Add imports to `platform/security/main.go`:

```go
import (
	// ... existing imports ...
	"github.com/go-co-op/gocron/v2"
	"github.com/noui/platform/security/jobs"
	"github.com/noui/platform/security/models"
)
```

Add after `database` setup (after `defer database.Close()`):

```go
	// Load job configuration from environment
	jobCfg := models.JobConfig{
		SessionIdleTimeoutMin: envutil.GetEnvInt("SESSION_IDLE_TIMEOUT_MIN", 30),
		SessionMaxLifetimeHr:  envutil.GetEnvInt("SESSION_MAX_LIFETIME_HR", 8),
		BruteForceThreshold:   envutil.GetEnvInt("BRUTE_FORCE_THRESHOLD", 5),
		BruteForceWindowMin:   envutil.GetEnvInt("BRUTE_FORCE_WINDOW_MIN", 15),
	}

	// Start background job scheduler
	scheduler, err := gocron.NewScheduler()
	if err != nil {
		slog.Error("failed to create scheduler", "error", err)
		os.Exit(1)
	}

	_, err = scheduler.NewJob(
		gocron.DurationJob(5*time.Minute),
		gocron.NewTask(func() { jobs.CleanupExpiredSessions(database, jobCfg) }),
	)
	if err != nil {
		slog.Error("failed to register cleanup job", "error", err)
		os.Exit(1)
	}

	_, err = scheduler.NewJob(
		gocron.DurationJob(1*time.Minute),
		gocron.NewTask(func() { jobs.CheckBruteForce(database, jobCfg) }),
	)
	if err != nil {
		slog.Error("failed to register brute-force job", "error", err)
		os.Exit(1)
	}

	scheduler.Start()
	slog.Info("background jobs started",
		"session_cleanup_interval", "5m",
		"brute_force_interval", "1m",
		"idle_timeout_min", jobCfg.SessionIdleTimeoutMin,
		"max_lifetime_hr", jobCfg.SessionMaxLifetimeHr,
		"brute_force_threshold", jobCfg.BruteForceThreshold,
		"brute_force_window_min", jobCfg.BruteForceWindowMin)
```

Add before existing shutdown code (before `ctx, cancel := context.WithTimeout`):

```go
	if err := scheduler.Shutdown(); err != nil {
		slog.Error("scheduler shutdown error", "error", err)
	}
```

Add `"github.com/noui/platform/envutil"` to imports if not already present.

**Step 3: Verify build**

Run: `cd platform/security && go build ./...`
Expected: Build succeeds

**Step 4: Run all tests**

Run: `cd platform/security && go test ./... -short -count=1`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add platform/security/main.go platform/security/go.mod platform/security/go.sum
git commit -m "[platform/security] Wire gocron scheduler — session cleanup (5m) + brute-force detection (1m)"
```

---

## Task 9: Final Verification + Dependency Flag

**Step 1: Run full test suite**

Run: `cd platform/security && go test ./... -short -count=1 -v`
Expected: All tests PASS — should be ~56+ tests (49 existing + 7 new)

**Step 2: Verify build**

Run: `cd platform/security && go build ./...`
Expected: Clean build

**Step 3: Run frontend typecheck (verify no cross-impact)**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 4: Update BUILD_HISTORY.md**

Add new entry at the top of BUILD_HISTORY.md documenting:
- What was built (gocron scheduler, session cleanup job, brute-force detection job)
- New dependency: `github.com/go-co-op/gocron/v2`
- Test count (existing + new)
- Config env vars added
- Next session should start with

**Step 5: Final commit**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Update BUILD_HISTORY with job infrastructure session"
```
