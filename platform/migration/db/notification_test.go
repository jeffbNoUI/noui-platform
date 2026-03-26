package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestCreateNotification(t *testing.T) {
	t.Run("creates_notification", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		now := time.Now().UTC()

		mock.ExpectQuery("INSERT INTO migration.notification").
			WithArgs("tenant-001", "eng-001", "LegacyPAS", "DRIFT_CRITICAL", "Critical drift detected").
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "tenant_id", "engagement_id", "engagement_name", "type", "summary", "read", "created_at",
			}).AddRow("notif-001", "tenant-001", "eng-001", "LegacyPAS", "DRIFT_CRITICAL", "Critical drift detected", false, now))

		n, err := CreateNotification(db, "tenant-001", "eng-001", "LegacyPAS", "DRIFT_CRITICAL", "Critical drift detected")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if n.ID != "notif-001" {
			t.Errorf("expected id=notif-001, got %s", n.ID)
		}
		if n.Type != "DRIFT_CRITICAL" {
			t.Errorf("expected type=DRIFT_CRITICAL, got %s", n.Type)
		}
		if n.Read {
			t.Error("expected read=false for new notification")
		}
	})

	t.Run("nil_db_returns_error", func(t *testing.T) {
		_, err := CreateNotification(nil, "t", "e", "n", "type", "summary")
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}
