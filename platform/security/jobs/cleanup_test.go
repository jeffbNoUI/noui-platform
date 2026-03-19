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
