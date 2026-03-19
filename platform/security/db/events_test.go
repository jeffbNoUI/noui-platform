package db

import (
	"context"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/security/models"
)

// --- Test Helpers ---

// eventCols matches the 9-column SELECT used by scanEvent.
var eventCols = []string{
	"id", "tenant_id", "event_type", "actor_id", "actor_email",
	"ip_address", "user_agent", "metadata", "created_at",
}

// sessionCols matches the 10-column SELECT used by scanSession.
var sessionCols = []string{
	"id", "tenant_id", "user_id", "session_id", "email",
	"role", "ip_address", "user_agent", "started_at", "last_seen_at",
}

// addEventRow appends a standard event row with the given key fields.
func addEventRow(rows *sqlmock.Rows, id int, eventType string) *sqlmock.Rows {
	now := time.Now().UTC()
	return rows.AddRow(
		id, "tenant-1", eventType, "user-1", "user@example.com",
		"192.168.1.1", "Mozilla/5.0", "{}", now,
	)
}

// newStore creates a Store backed by sqlmock.
func newStore(t *testing.T) (*Store, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return NewStore(db), mock
}

// --- CreateEvent ---

func TestCreateEvent_Valid(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO security_events").
		WithArgs("tenant-1", "login_success", "user-1", "user@example.com", "192.168.1.1", "Mozilla/5.0", "{}").
		WillReturnRows(sqlmock.NewRows(eventCols).AddRow(
			1, "tenant-1", "login_success", "user-1", "user@example.com",
			"192.168.1.1", "Mozilla/5.0", "{}", now,
		))

	ev, err := s.CreateEvent(context.Background(), "tenant-1", models.CreateEventRequest{
		EventType:  "login_success",
		ActorID:    "user-1",
		ActorEmail: "user@example.com",
		IPAddress:  "192.168.1.1",
		UserAgent:  "Mozilla/5.0",
	})
	if err != nil {
		t.Fatalf("CreateEvent error: %v", err)
	}
	if ev.EventType != "login_success" {
		t.Errorf("EventType = %q, want login_success", ev.EventType)
	}
	if ev.ActorID != "user-1" {
		t.Errorf("ActorID = %q, want user-1", ev.ActorID)
	}
}

func TestCreateEvent_EmptyMetadataDefaults(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO security_events").
		WithArgs("tenant-1", "login_failure", "user-2", "", "", "", "{}").
		WillReturnRows(sqlmock.NewRows(eventCols).AddRow(
			2, "tenant-1", "login_failure", "user-2", "",
			"", "", "{}", now,
		))

	ev, err := s.CreateEvent(context.Background(), "tenant-1", models.CreateEventRequest{
		EventType: "login_failure",
		ActorID:   "user-2",
	})
	if err != nil {
		t.Fatalf("CreateEvent error: %v", err)
	}
	if ev.Metadata != "{}" {
		t.Errorf("Metadata = %q, want {}", ev.Metadata)
	}
}

// --- ListEvents ---

func TestListEvents_NoFilters(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", 25, 0).
		WillReturnRows(sqlmock.NewRows(eventCols))

	events, total, err := s.ListEvents(context.Background(), "tenant-1", models.EventFilter{})
	if err != nil {
		t.Fatalf("ListEvents error: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
	if events != nil {
		t.Errorf("events = %v, want nil (empty result)", events)
	}
}

func TestListEvents_SingleFilter(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "login_failure").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(eventCols)
	addEventRow(dataRows, 1, "login_failure")
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "login_failure", 25, 0).
		WillReturnRows(dataRows)

	events, total, err := s.ListEvents(context.Background(), "tenant-1", models.EventFilter{EventType: "login_failure"})
	if err != nil {
		t.Fatalf("ListEvents error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(events) != 1 {
		t.Fatalf("len(events) = %d, want 1", len(events))
	}
	if events[0].EventType != "login_failure" {
		t.Errorf("EventType = %q, want login_failure", events[0].EventType)
	}
}

func TestListEvents_MultipleFilters(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "login_success", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	dataRows := sqlmock.NewRows(eventCols)
	addEventRow(dataRows, 1, "login_success")
	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", "login_success", "user-1", 10, 0).
		WillReturnRows(dataRows)

	events, total, err := s.ListEvents(context.Background(), "tenant-1", models.EventFilter{
		EventType: "login_success",
		ActorID:   "user-1",
		Limit:     10,
		Offset:    0,
	})
	if err != nil {
		t.Fatalf("ListEvents error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(events) != 1 {
		t.Fatalf("len(events) = %d, want 1", len(events))
	}
}

func TestListEvents_NegativeLimit(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", 25, 0).
		WillReturnRows(sqlmock.NewRows(eventCols))

	_, total, err := s.ListEvents(context.Background(), "tenant-1", models.EventFilter{Limit: -5})
	if err != nil {
		t.Fatalf("ListEvents(negative limit) error: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
}

// --- GetEventStats ---

func TestGetEventStats(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"active_users", "active_sessions", "failed_logins_24h", "role_changes_7d"}).
			AddRow(12, 5, 3, 1))

	stats, err := s.GetEventStats(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetEventStats error: %v", err)
	}
	if stats.ActiveUsers != 12 {
		t.Errorf("ActiveUsers = %d, want 12", stats.ActiveUsers)
	}
	if stats.ActiveSessions != 5 {
		t.Errorf("ActiveSessions = %d, want 5", stats.ActiveSessions)
	}
	if stats.FailedLogins24h != 3 {
		t.Errorf("FailedLogins24h = %d, want 3", stats.FailedLogins24h)
	}
	if stats.RoleChanges7d != 1 {
		t.Errorf("RoleChanges7d = %d, want 1", stats.RoleChanges7d)
	}
}

// --- Sessions ---

func TestUpsertSession_New(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO active_sessions").
		WithArgs("tenant-1", "user-1", "sess-abc", "user@example.com", "admin", "192.168.1.1", "Mozilla/5.0").
		WillReturnRows(sqlmock.NewRows(sessionCols).AddRow(
			1, "tenant-1", "user-1", "sess-abc", "user@example.com",
			"admin", "192.168.1.1", "Mozilla/5.0", now, now,
		))

	sess, err := s.UpsertSession(context.Background(), "tenant-1", models.CreateSessionRequest{
		UserID:    "user-1",
		SessionID: "sess-abc",
		Email:     "user@example.com",
		Role:      "admin",
		IPAddress: "192.168.1.1",
		UserAgent: "Mozilla/5.0",
	})
	if err != nil {
		t.Fatalf("UpsertSession error: %v", err)
	}
	if sess.SessionID != "sess-abc" {
		t.Errorf("SessionID = %q, want sess-abc", sess.SessionID)
	}
	if sess.UserID != "user-1" {
		t.Errorf("UserID = %q, want user-1", sess.UserID)
	}
}

func TestListActiveSessions_Empty(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", 30).
		WillReturnRows(sqlmock.NewRows(sessionCols))

	sessions, err := s.ListActiveSessions(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("ListActiveSessions error: %v", err)
	}
	if sessions != nil {
		t.Errorf("sessions = %v, want nil (empty result)", sessions)
	}
}

func TestListActiveSessions_WithResults(t *testing.T) {
	s, mock := newStore(t)

	now := time.Now().UTC()
	rows := sqlmock.NewRows(sessionCols).
		AddRow(1, "tenant-1", "user-1", "sess-1", "user1@example.com", "admin", "10.0.0.1", "Chrome", now, now).
		AddRow(2, "tenant-1", "user-2", "sess-2", "user2@example.com", "viewer", "10.0.0.2", "Firefox", now, now)

	mock.ExpectQuery("SELECT").
		WithArgs("tenant-1", 30).
		WillReturnRows(rows)

	sessions, err := s.ListActiveSessions(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("ListActiveSessions error: %v", err)
	}
	if len(sessions) != 2 {
		t.Fatalf("len(sessions) = %d, want 2", len(sessions))
	}
	if sessions[0].SessionID != "sess-1" {
		t.Errorf("sessions[0].SessionID = %q, want sess-1", sessions[0].SessionID)
	}
}

func TestDeleteSession_NotFound(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectExec("DELETE FROM active_sessions").
		WithArgs("nonexistent", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := s.DeleteSession(context.Background(), "tenant-1", "nonexistent")
	if err != ErrNotFound {
		t.Errorf("DeleteSession(nonexistent) error = %v, want ErrNotFound", err)
	}
}

func TestDeleteSession_Valid(t *testing.T) {
	s, mock := newStore(t)

	mock.ExpectExec("DELETE FROM active_sessions").
		WithArgs("sess-abc", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := s.DeleteSession(context.Background(), "tenant-1", "sess-abc")
	if err != nil {
		t.Errorf("DeleteSession error: %v", err)
	}
}
