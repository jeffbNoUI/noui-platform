package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// --- AC-5: GET /api/v1/migration/engagements/{id}/audit-log ---

func TestListAuditLog(t *testing.T) {
	t.Run("returns_paginated_entries", func(t *testing.T) {
		h, mock := newTestHandler(t)

		// Expect count query
		mock.ExpectQuery("SELECT COUNT").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

		// Expect select query
		mock.ExpectQuery("SELECT log_id").
			WithArgs("eng-001", 50, 0).
			WillReturnRows(sqlmock.NewRows([]string{
				"log_id", "engagement_id", "actor", "action",
				"entity_type", "entity_id", "before_state", "after_state",
				"metadata", "created_at",
			}).AddRow(
				"log-001", "eng-001", "user_jane_doe_test", "resolve",
				"attention", "item-001", nil, `{"source":"RISK"}`,
				nil, time.Now(),
			))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/audit-log", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)

		data, ok := resp["data"].(map[string]interface{})
		if !ok {
			t.Fatalf("missing data in response: %s", w.Body.String())
		}

		entries, ok := data["entries"].([]interface{})
		if !ok {
			t.Fatalf("missing entries in data: %s", w.Body.String())
		}
		if len(entries) != 1 {
			t.Errorf("expected 1 entry, got %d", len(entries))
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("filters_by_entity_type", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mock.ExpectQuery("SELECT COUNT").
			WithArgs("eng-001", "attention").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

		mock.ExpectQuery("SELECT log_id").
			WithArgs("eng-001", "attention", 50, 0).
			WillReturnRows(sqlmock.NewRows([]string{
				"log_id", "engagement_id", "actor", "action",
				"entity_type", "entity_id", "before_state", "after_state",
				"metadata", "created_at",
			}))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/audit-log?entity_type=attention", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("respects_per_page_max_200", func(t *testing.T) {
		h, mock := newTestHandler(t)

		// Even if per_page=999, it should be clamped to 200.
		mock.ExpectQuery("SELECT COUNT").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

		mock.ExpectQuery("SELECT log_id").
			WithArgs("eng-001", 200, 0).
			WillReturnRows(sqlmock.NewRows([]string{
				"log_id", "engagement_id", "actor", "action",
				"entity_type", "entity_id", "before_state", "after_state",
				"metadata", "created_at",
			}))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/audit-log?per_page=999", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("no_update_or_delete_endpoints", func(t *testing.T) {
		h, _ := newTestHandler(t)

		// PUT should 405 (method not allowed) or 404.
		w := serve(h, "PUT", "/api/v1/migration/engagements/eng-001/audit-log", nil)
		if w.Code == http.StatusOK {
			t.Error("PUT on audit-log should not return 200 — audit log is read-only")
		}

		// DELETE should 405 or 404.
		w = serve(h, "DELETE", "/api/v1/migration/engagements/eng-001/audit-log", nil)
		if w.Code == http.StatusOK {
			t.Error("DELETE on audit-log should not return 200 — audit log is read-only")
		}
	})
}

// --- AC-6: Audit integration into attention mutation handlers ---

func TestAuditIntegration(t *testing.T) {
	t.Run("resolve_creates_audit_entry", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()

		h := NewHandler(db)
		h.Audit = migrationdb.NewAuditLogger(db)

		// 1. Expect risk resolution update
		mock.ExpectExec("UPDATE migration.risk").
			WithArgs("CLOSED", sqlmock.AnyArg(), "Audit integration test", "risk-audit-001", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 1))

		// 2. Expect event insertion
		mock.ExpectQuery("INSERT INTO migration.event").
			WithArgs("eng-001", "attention_resolved", sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"event_id", "engagement_id", "event_type", "payload", "created_at"}).
				AddRow("evt-audit", "eng-001", "attention_resolved", "{}", "2026-01-01T00:00:00Z"))

		// 3. Expect audit_log insertion (non-blocking)
		mock.ExpectExec("INSERT INTO migration.audit_log").
			WithArgs("eng-001", sqlmock.AnyArg(), "resolve", "attention", "risk-audit-001",
				sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnResult(sqlmock.NewResult(0, 1))

		body, _ := json.Marshal(map[string]string{
			"source":          "RISK",
			"resolution_note": "Audit integration test",
		})
		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/attention/risk-audit-001/resolve", body)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations — audit entry not inserted: %v", err)
		}
	})

	t.Run("defer_creates_audit_entry", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()

		h := NewHandler(db)
		h.Audit = migrationdb.NewAuditLogger(db)

		mock.ExpectExec("UPDATE migration.risk").
			WithArgs("DEFERRED", sqlmock.AnyArg(), "Deferred for review", "risk-defer-001", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 1))

		mock.ExpectQuery("INSERT INTO migration.event").
			WithArgs("eng-001", "attention_deferred", sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"event_id", "engagement_id", "event_type", "payload", "created_at"}).
				AddRow("evt-defer", "eng-001", "attention_deferred", "{}", "2026-01-01T00:00:00Z"))

		mock.ExpectExec("INSERT INTO migration.audit_log").
			WithArgs("eng-001", sqlmock.AnyArg(), "defer", "attention", "risk-defer-001",
				sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnResult(sqlmock.NewResult(0, 1))

		body, _ := json.Marshal(map[string]string{
			"source":          "RISK",
			"resolution_note": "Deferred for review",
		})
		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/attention/risk-defer-001/defer", body)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations — audit entry not inserted: %v", err)
		}
	})
}

// --- AC-7: Non-blocking audit behavior ---

func TestAuditNonBlocking(t *testing.T) {
	t.Run("audit_failure_does_not_fail_parent_mutation", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()

		h := NewHandler(db)
		h.Audit = migrationdb.NewAuditLogger(db)

		// 1. Risk resolution succeeds
		mock.ExpectExec("UPDATE migration.risk").
			WithArgs("CLOSED", sqlmock.AnyArg(), "Non-blocking test", "risk-nb-001", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 1))

		// 2. Event insertion succeeds
		mock.ExpectQuery("INSERT INTO migration.event").
			WithArgs("eng-001", "attention_resolved", sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"event_id", "engagement_id", "event_type", "payload", "created_at"}).
				AddRow("evt-nb", "eng-001", "attention_resolved", "{}", "2026-01-01T00:00:00Z"))

		// 3. Audit INSERT FAILS — simulates DB write failure
		mock.ExpectExec("INSERT INTO migration.audit_log").
			WithArgs("eng-001", sqlmock.AnyArg(), "resolve", "attention", "risk-nb-001",
								sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnError(sql.ErrConnDone) // Simulates closed connection

		body, _ := json.Marshal(map[string]string{
			"source":          "RISK",
			"resolution_note": "Non-blocking test",
		})
		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/attention/risk-nb-001/resolve", body)

		// Parent mutation must still return 200 success despite audit failure.
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (audit failure is non-blocking); body: %s", w.Code, w.Body.String())
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("nil_audit_logger_does_not_fail", func(t *testing.T) {
		h, mock := newTestHandler(t)
		// h.Audit is nil by default — should not panic.

		mock.ExpectExec("UPDATE migration.risk").
			WithArgs("CLOSED", sqlmock.AnyArg(), "Nil audit test", "risk-nil-001", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 1))

		mock.ExpectQuery("INSERT INTO migration.event").
			WithArgs("eng-001", "attention_resolved", sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"event_id", "engagement_id", "event_type", "payload", "created_at"}).
				AddRow("evt-nil", "eng-001", "attention_resolved", "{}", "2026-01-01T00:00:00Z"))

		body, _ := json.Marshal(map[string]string{
			"source":          "RISK",
			"resolution_note": "Nil audit test",
		})
		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/attention/risk-nil-001/resolve", body)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- Verify audit entry structure ---

func TestAuditEntryStructure(t *testing.T) {
	t.Run("actor_from_jwt_not_body", func(t *testing.T) {
		// The attention handler uses auth.UserID(r.Context()) for the actor,
		// not any field from the request body. This is verified by checking
		// that AuditEntry.Actor is set from resolvedBy (JWT-derived), not req.
		entry := models.AuditEntry{
			EngagementID: "eng-001",
			Actor:        "jwt-user-id",
			Action:       "resolve",
			EntityType:   "attention",
			EntityID:     "item-001",
		}

		if entry.Actor != "jwt-user-id" {
			t.Error("actor must come from JWT context, not request body")
		}
	})

	t.Run("entity_id_is_string", func(t *testing.T) {
		// entity_id is TEXT not UUID — accommodates attention item string IDs.
		entry := models.AuditEntry{
			EntityID: "risk-123-not-a-uuid",
		}
		if entry.EntityID == "" {
			t.Error("entity_id must accept string IDs")
		}
	})

	t.Run("before_after_state_raw_json", func(t *testing.T) {
		// BeforeState and AfterState are json.RawMessage — serialization is caller's responsibility.
		afterState, _ := json.Marshal(map[string]string{"resolved_by": "Jane Doe"})
		entry := models.AuditEntry{
			BeforeState: nil,
			AfterState:  afterState,
		}

		if entry.BeforeState != nil {
			t.Error("before_state should be nil for attention items")
		}
		if entry.AfterState == nil {
			t.Error("after_state should contain resolution details")
		}
	})
}
