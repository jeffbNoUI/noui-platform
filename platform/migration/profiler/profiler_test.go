package profiler

import (
	"math"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestProfileCompleteness_AllComplete(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// 100 rows, 0 nulls in each of 2 columns
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "null_col1", "null_col2"}).
			AddRow(100, 0, 0))

	dim, err := ProfileCompleteness(db, "members", []string{"first_name", "last_name"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0", dim.Score)
	}
	if dim.Name != "completeness" {
		t.Errorf("Name = %q, want %q", dim.Name, "completeness")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileCompleteness_PartialNulls(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// 100 rows, 20 nulls in col1, 0 nulls in col2 → avg null rate = (0.2 + 0.0) / 2 = 0.1
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "null_col1", "null_col2"}).
			AddRow(100, 20, 0))

	dim, err := ProfileCompleteness(db, "members", []string{"ssn", "dob"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := 0.9 // 1 - 0.1
	if math.Abs(dim.Score-expected) > 0.001 {
		t.Errorf("Score = %f, want %f", dim.Score, expected)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileCompleteness_NoColumns(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	dim, err := ProfileCompleteness(db, "members", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 for no columns", dim.Score)
	}
}

func TestProfileCompleteness_EmptyTable(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "null_col1"}).AddRow(0, 0))

	dim, err := ProfileCompleteness(db, "members", []string{"first_name"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 for empty table", dim.Score)
	}
}

func TestProfileAccuracy_AllMatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs("^\\d{3}-\\d{2}-\\d{4}$").
		WillReturnRows(sqlmock.NewRows([]string{"count", "matched"}).AddRow(50, 50))

	checks := []PatternCheck{{Column: "ssn", Pattern: "^\\d{3}-\\d{2}-\\d{4}$"}}
	dim, err := ProfileAccuracy(db, "members", checks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0", dim.Score)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileAccuracy_PartialMatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// 80 out of 100 match SSN pattern, 90 out of 100 match date pattern
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs("^\\d{3}-\\d{2}-\\d{4}$").
		WillReturnRows(sqlmock.NewRows([]string{"count", "matched"}).AddRow(100, 80))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs("^\\d{4}-\\d{2}-\\d{2}$").
		WillReturnRows(sqlmock.NewRows([]string{"count", "matched"}).AddRow(100, 90))

	checks := []PatternCheck{
		{Column: "ssn", Pattern: "^\\d{3}-\\d{2}-\\d{4}$"},
		{Column: "dob", Pattern: "^\\d{4}-\\d{2}-\\d{2}$"},
	}
	dim, err := ProfileAccuracy(db, "members", checks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := (0.8 + 0.9) / 2 // 0.85
	if math.Abs(dim.Score-expected) > 0.001 {
		t.Errorf("Score = %f, want %f", dim.Score, expected)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileAccuracy_NoChecks(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	dim, err := ProfileAccuracy(db, "members", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 for no checks", dim.Score)
	}
}

func TestProfileConsistency_AllValid(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "valid"}).AddRow(200, 200))

	refs := []FKReference{{Column: "plan_id", ReferencedTable: "plans", ReferencedColumn: "id"}}
	dim, err := ProfileConsistency(db, "members", refs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0", dim.Score)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileConsistency_Orphans(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// 100 rows, 75 have valid FK references
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "valid"}).AddRow(100, 75))

	refs := []FKReference{{Column: "dept_id", ReferencedTable: "departments", ReferencedColumn: "id"}}
	dim, err := ProfileConsistency(db, "employees", refs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if math.Abs(dim.Score-0.75) > 0.001 {
		t.Errorf("Score = %f, want 0.75", dim.Score)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileConsistency_NoRefs(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	dim, err := ProfileConsistency(db, "members", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 for no refs", dim.Score)
	}
}

func TestProfileTimeliness_Recent(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Data updated 5 days ago — should score 1.0 (within 30-day grace period)
	recentDate := time.Now().Add(-5 * 24 * time.Hour)
	mock.ExpectQuery("SELECT MAX\\(").
		WillReturnRows(sqlmock.NewRows([]string{"max"}).AddRow(recentDate))

	dim, err := ProfileTimeliness(db, "members", []string{"updated_at"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 for recent data", dim.Score)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileTimeliness_Old(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Data 210 days old → 180 days past grace period → score = 0.5
	oldDate := time.Now().Add(-210 * 24 * time.Hour)
	mock.ExpectQuery("SELECT MAX\\(").
		WillReturnRows(sqlmock.NewRows([]string{"max"}).AddRow(oldDate))

	dim, err := ProfileTimeliness(db, "members", []string{"updated_at"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := 0.5 // 0.5^((210-30)/180) = 0.5^1 = 0.5
	if math.Abs(dim.Score-expected) > 0.01 {
		t.Errorf("Score = %f, want ~%f", dim.Score, expected)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileTimeliness_NoColumns(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	dim, err := ProfileTimeliness(db, "members", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 for no date columns", dim.Score)
	}
}

func TestProfileTimeliness_MultipleColumns(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// First column is old, second column is recent — should use the most recent
	oldDate := time.Now().Add(-365 * 24 * time.Hour)
	recentDate := time.Now().Add(-10 * 24 * time.Hour)
	mock.ExpectQuery("SELECT MAX\\(").
		WillReturnRows(sqlmock.NewRows([]string{"max"}).AddRow(oldDate))
	mock.ExpectQuery("SELECT MAX\\(").
		WillReturnRows(sqlmock.NewRows([]string{"max"}).AddRow(recentDate))

	dim, err := ProfileTimeliness(db, "members", []string{"created_at", "updated_at"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 (most recent column is within 30 days)", dim.Score)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileValidity_AllPass(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "passed"}).AddRow(100, 100))

	rules := []BusinessRule{{Name: "positive_salary", Condition: "salary > 0"}}
	dim, err := ProfileValidity(db, "employees", rules)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0", dim.Score)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileValidity_PartialPass(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Rule 1: 90/100 pass, Rule 2: 80/100 pass → avg = 0.85
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "passed"}).AddRow(100, 90))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "passed"}).AddRow(100, 80))

	rules := []BusinessRule{
		{Name: "positive_salary", Condition: "salary > 0"},
		{Name: "valid_dates", Condition: "hire_date < termination_date"},
	}
	dim, err := ProfileValidity(db, "employees", rules)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := 0.85
	if math.Abs(dim.Score-expected) > 0.001 {
		t.Errorf("Score = %f, want %f", dim.Score, expected)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileValidity_NoRules(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	dim, err := ProfileValidity(db, "members", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 for no rules", dim.Score)
	}
}

func TestProfileUniqueness_AllUnique(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "distinct"}).AddRow(100, 100))

	dim, err := ProfileUniqueness(db, "members", []string{"member_id"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0", dim.Score)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileUniqueness_Duplicates(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// 200 rows, 150 distinct → 75% unique
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "distinct"}).AddRow(200, 150))

	dim, err := ProfileUniqueness(db, "members", []string{"ssn"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if math.Abs(dim.Score-0.75) > 0.001 {
		t.Errorf("Score = %f, want 0.75", dim.Score)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestProfileUniqueness_NoKeys(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	dim, err := ProfileUniqueness(db, "members", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dim.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0 for no keys", dim.Score)
	}
}

func TestQuoteIdent_ValidIdentifiers(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"members", `"members"`},
		{"first_name", `"first_name"`},
		{"src_pas.member", `"src_pas"."member"`},
		{"BIRTH_DT", `"BIRTH_DT"`},
		{"col1", `"col1"`},
	}
	for _, tt := range tests {
		got, err := QuoteIdent(tt.input)
		if err != nil {
			t.Errorf("QuoteIdent(%q) error: %v", tt.input, err)
			continue
		}
		if got != tt.want {
			t.Errorf("QuoteIdent(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestQuoteIdent_UnsafeIdentifiers(t *testing.T) {
	unsafe := []string{
		"",
		"table; DROP TABLE members",
		"col' OR 1=1--",
		"col\"; DROP TABLE x;--",
		"table name with spaces",
		"table()",
		"1startswithnumber",
	}
	for _, id := range unsafe {
		_, err := QuoteIdent(id)
		if err == nil {
			t.Errorf("QuoteIdent(%q) should have returned error for unsafe identifier", id)
		}
	}
}

func TestProfileCompleteness_UnsafeTableName(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	_, err = ProfileCompleteness(db, "table; DROP TABLE x", []string{"col1"})
	if err == nil {
		t.Error("expected error for unsafe table name, got nil")
	}
}

func TestProfileTable_Integration(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Row count — table name is now quoted
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM "members"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(500))

	// Completeness: 500 rows, 10 nulls in col1
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "null_col1"}).AddRow(500, 10))

	// Accuracy: 500 non-null, 480 match
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs("^\\d{3}-\\d{2}-\\d{4}$").
		WillReturnRows(sqlmock.NewRows([]string{"count", "matched"}).AddRow(500, 480))

	// Consistency: 500 rows, 490 valid FK
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "valid"}).AddRow(500, 490))

	// Timeliness: recent data
	recentDate := time.Now().Add(-2 * 24 * time.Hour)
	mock.ExpectQuery("SELECT MAX\\(").
		WillReturnRows(sqlmock.NewRows([]string{"max"}).AddRow(recentDate))

	// Validity: 500 rows, 495 pass
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "passed"}).AddRow(500, 495))

	// Uniqueness: 500 total, 500 distinct
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WillReturnRows(sqlmock.NewRows([]string{"count", "distinct"}).AddRow(500, 500))

	cfg := ProfileConfig{
		TableName:       "members",
		RequiredColumns: []string{"ssn"},
		PatternChecks:   []PatternCheck{{Column: "ssn", Pattern: "^\\d{3}-\\d{2}-\\d{4}$"}},
		FKReferences:    []FKReference{{Column: "plan_id", ReferencedTable: "plans", ReferencedColumn: "id"}},
		DateColumns:     []string{"updated_at"},
		BusinessRules:   []BusinessRule{{Name: "positive_salary", Condition: "salary > 0"}},
		KeyColumns:      []string{"member_id"},
	}

	profile, err := ProfileTable(db, cfg)
	if err != nil {
		t.Fatalf("ProfileTable error: %v", err)
	}

	if profile.TableName != "members" {
		t.Errorf("TableName = %q, want %q", profile.TableName, "members")
	}
	if profile.RowCount != 500 {
		t.Errorf("RowCount = %d, want 500", profile.RowCount)
	}
	if len(profile.Dimensions) != 6 {
		t.Fatalf("len(Dimensions) = %d, want 6", len(profile.Dimensions))
	}

	// Verify dimension names
	expectedNames := []string{"completeness", "accuracy", "consistency", "timeliness", "validity", "uniqueness"}
	for i, name := range expectedNames {
		if profile.Dimensions[i].Name != name {
			t.Errorf("Dimension[%d].Name = %q, want %q", i, profile.Dimensions[i].Name, name)
		}
	}

	// Verify each score is in [0, 1]
	for _, d := range profile.Dimensions {
		if d.Score < 0.0 || d.Score > 1.0 {
			t.Errorf("Dimension %q Score = %f, want [0.0, 1.0]", d.Name, d.Score)
		}
	}

	// Verify overall score is the mean
	var sum float64
	for _, d := range profile.Dimensions {
		sum += d.Score
	}
	expectedOverall := sum / 6.0
	if math.Abs(profile.OverallScore-expectedOverall) > 0.001 {
		t.Errorf("OverallScore = %f, want %f", profile.OverallScore, expectedOverall)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestSaveProfile(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	profile := &TableProfile{
		TableName: "members",
		RowCount:  500,
		Dimensions: []QualityDimension{
			{Name: "completeness", Score: 0.98},
			{Name: "accuracy", Score: 0.96},
			{Name: "consistency", Score: 0.98},
			{Name: "timeliness", Score: 1.0},
			{Name: "validity", Score: 0.99},
			{Name: "uniqueness", Score: 1.0},
		},
		OverallScore: 0.985,
	}

	mock.ExpectExec("INSERT INTO migration.quality_profile").
		WithArgs(
			"eng-001",
			"members",
			0.96, // accuracy
			0.98, // completeness
			0.98, // consistency
			1.0,  // timeliness
			0.99, // validity
			1.0,  // uniqueness
			500,  // row_count
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err = SaveProfile(db, "eng-001", profile)
	if err != nil {
		t.Fatalf("SaveProfile error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
