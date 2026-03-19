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
