package batch

import (
	"fmt"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/transformer"
)

// --- Batch column list for sqlmock ---

var batchCols = []string{
	"batch_id", "engagement_id", "batch_scope", "status", "mapping_version",
	"row_count_source", "row_count_loaded", "row_count_exception",
	"error_rate", "halted_reason", "checkpoint_key", "started_at", "completed_at",
}

// --- Helper: noop pipeline ---

func noopPipeline() *transformer.Pipeline {
	return transformer.NewPipeline([]transformer.TransformHandler{
		{
			Name:     "Noop",
			Priority: 10,
			Apply: func(value interface{}, _ map[string]interface{}, _ transformer.FieldMapping, _ *transformer.TransformContext) (interface{}, error) {
				return value, nil
			},
		},
	})
}

// failingPipeline returns a pipeline where every field produces a hard exception.
func failingPipeline() *transformer.Pipeline {
	return transformer.NewPipeline([]transformer.TransformHandler{
		{
			Name:     "AlwaysFail",
			Priority: 10,
			Apply: func(value interface{}, _ map[string]interface{}, m transformer.FieldMapping, ctx *transformer.TransformContext) (interface{}, error) {
				ctx.AddException("AlwaysFail", m.CanonicalColumn, fmt.Sprintf("%v", value),
					transformer.ExceptionMissingRequired, "required field missing")
				return nil, fmt.Errorf("required field missing")
			},
		},
	})
}

// --- Helper: test emitter ---

type testEmitter struct {
	events []BatchEvent
}

func (e *testEmitter) Emit(event BatchEvent) {
	e.events = append(e.events, event)
}

// --- Helper: in-memory source row provider ---

type memoryProvider struct {
	rows []SourceRow
}

func (p *memoryProvider) FetchRows(scope string, checkpointKey string) ([]SourceRow, error) {
	if checkpointKey == "" {
		return p.rows, nil
	}
	// Return rows after the checkpoint key.
	for i, r := range p.rows {
		if r.Key == checkpointKey {
			if i+1 < len(p.rows) {
				return p.rows[i+1:], nil
			}
			return nil, nil
		}
	}
	return p.rows, nil
}

// --- Tests: CheckThresholds ---

func TestCheckThresholds_NoErrors(t *testing.T) {
	stats := BatchStats{TotalRows: 100, LoadedRows: 100}
	halt, reason := CheckThresholds(stats, DefaultThresholds())
	if halt {
		t.Errorf("expected no halt, got halt with reason: %s", reason)
	}
}

func TestCheckThresholds_HardErrorBreached(t *testing.T) {
	stats := BatchStats{TotalRows: 100, HardErrors: 6}
	halt, reason := CheckThresholds(stats, DefaultThresholds())
	if !halt {
		t.Error("expected halt for 6% hard errors (threshold 5%)")
	}
	if reason == "" {
		t.Error("expected non-empty reason")
	}
}

func TestCheckThresholds_HardErrorExactlyAtThreshold(t *testing.T) {
	stats := BatchStats{TotalRows: 100, HardErrors: 5}
	halt, _ := CheckThresholds(stats, DefaultThresholds())
	if halt {
		t.Error("expected no halt at exactly 5% (threshold is >5%)")
	}
}

func TestCheckThresholds_SoftWarningBreached(t *testing.T) {
	stats := BatchStats{TotalRows: 100, SoftWarnings: 16}
	halt, reason := CheckThresholds(stats, DefaultThresholds())
	if !halt {
		t.Error("expected halt for 16% warnings (threshold 15%)")
	}
	if reason == "" {
		t.Error("expected non-empty reason")
	}
}

func TestCheckThresholds_RetireeZeroTolerance(t *testing.T) {
	stats := BatchStats{TotalRows: 100, RetireeErrors: 1}
	halt, reason := CheckThresholds(stats, DefaultThresholds())
	if !halt {
		t.Error("expected halt for 1 retiree error (tolerance 0)")
	}
	if reason == "" {
		t.Error("expected non-empty reason")
	}
}

func TestCheckThresholds_RetireeCheckedFirst(t *testing.T) {
	// Retiree error should trigger before hard error rate check.
	stats := BatchStats{TotalRows: 1000, HardErrors: 1, RetireeErrors: 1}
	halt, reason := CheckThresholds(stats, DefaultThresholds())
	if !halt {
		t.Error("expected halt for retiree error")
	}
	if reason == "" {
		t.Error("expected non-empty reason")
	}
}

func TestCheckThresholds_EmptyBatch(t *testing.T) {
	stats := BatchStats{TotalRows: 0}
	halt, _ := CheckThresholds(stats, DefaultThresholds())
	if halt {
		t.Error("expected no halt for empty batch")
	}
}

func TestCheckThresholds_CustomThresholds(t *testing.T) {
	thresholds := ErrorThresholds{
		HardErrorHaltPct:      0.10,
		SoftWarningMaxPct:     0.20,
		RetireeErrorTolerance: 2,
		FinancialBalanceTol:   "0.01",
	}
	// 2 retiree errors at tolerance 2 should NOT halt.
	stats := BatchStats{TotalRows: 100, RetireeErrors: 2, HardErrors: 2}
	halt, _ := CheckThresholds(stats, thresholds)
	if halt {
		t.Error("expected no halt with 2 retiree errors at tolerance 2")
	}

	// 3 retiree errors should halt.
	stats.RetireeErrors = 3
	halt, _ = CheckThresholds(stats, thresholds)
	if !halt {
		t.Error("expected halt with 3 retiree errors at tolerance 2")
	}
}

// --- Tests: DefaultThresholds ---

func TestDefaultThresholds(t *testing.T) {
	d := DefaultThresholds()
	if d.HardErrorHaltPct != 0.05 {
		t.Errorf("HardErrorHaltPct = %f, want 0.05", d.HardErrorHaltPct)
	}
	if d.SoftWarningMaxPct != 0.15 {
		t.Errorf("SoftWarningMaxPct = %f, want 0.15", d.SoftWarningMaxPct)
	}
	if d.RetireeErrorTolerance != 0 {
		t.Errorf("RetireeErrorTolerance = %d, want 0", d.RetireeErrorTolerance)
	}
	if d.FinancialBalanceTol != "0.01" {
		t.Errorf("FinancialBalanceTol = %q, want 0.01", d.FinancialBalanceTol)
	}
}

// --- Tests: BatchStats ---

func TestBatchStats_ErrorRate(t *testing.T) {
	stats := BatchStats{TotalRows: 200, HardErrors: 10}
	if rate := stats.ErrorRate(); rate != 0.05 {
		t.Errorf("ErrorRate() = %f, want 0.05", rate)
	}
}

func TestBatchStats_ErrorRate_Zero(t *testing.T) {
	stats := BatchStats{TotalRows: 0}
	if rate := stats.ErrorRate(); rate != 0 {
		t.Errorf("ErrorRate() = %f, want 0", rate)
	}
}

func TestBatchStats_WarningRate(t *testing.T) {
	stats := BatchStats{TotalRows: 100, SoftWarnings: 15}
	if rate := stats.WarningRate(); rate != 0.15 {
		t.Errorf("WarningRate() = %f, want 0.15", rate)
	}
}

// --- Tests: CreateBatch ---

func TestCreateBatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("INSERT INTO migration.batch").
		WithArgs("eng-001", "members", "v1").
		WillReturnRows(sqlmock.NewRows(batchCols).AddRow(
			"batch-001", "eng-001", "members", "PENDING", "v1",
			nil, nil, nil, nil, nil, nil, nil, nil,
		))

	b, err := CreateBatch(db, "eng-001", "members", "v1")
	if err != nil {
		t.Fatalf("CreateBatch error: %v", err)
	}
	if b.BatchID != "batch-001" {
		t.Errorf("BatchID = %q, want batch-001", b.BatchID)
	}
	if b.Status != StatusPending {
		t.Errorf("Status = %q, want PENDING", b.Status)
	}
	if b.EngagementID != "eng-001" {
		t.Errorf("EngagementID = %q, want eng-001", b.EngagementID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- Tests: GetBatch ---

func TestGetBatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.batch").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(batchCols).AddRow(
			"batch-001", "eng-001", "members", "LOADED", "v1",
			100, 95, 5, 0.05, nil, "row-100", now, now,
		))

	b, err := GetBatch(db, "batch-001")
	if err != nil {
		t.Fatalf("GetBatch error: %v", err)
	}
	if b == nil {
		t.Fatal("GetBatch returned nil")
	}
	if b.Status != StatusLoaded {
		t.Errorf("Status = %q, want LOADED", b.Status)
	}
	if *b.RowCountLoaded != 95 {
		t.Errorf("RowCountLoaded = %d, want 95", *b.RowCountLoaded)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetBatch_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT .+ FROM migration.batch").
		WithArgs("batch-999").
		WillReturnRows(sqlmock.NewRows(batchCols))

	b, err := GetBatch(db, "batch-999")
	if err != nil {
		t.Fatalf("GetBatch error: %v", err)
	}
	if b != nil {
		t.Errorf("expected nil for not-found, got %+v", b)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- Tests: ExecuteBatch ---

func TestExecuteBatch_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	batch := &Batch{
		BatchID:        "batch-001",
		EngagementID:   "eng-001",
		BatchScope:     "members",
		Status:         StatusPending,
		MappingVersion: "v1",
	}

	provider := &memoryProvider{
		rows: []SourceRow{
			{Key: "row-1", Data: map[string]interface{}{"name": "Alice"}},
			{Key: "row-2", Data: map[string]interface{}{"name": "Bob"}},
			{Key: "row-3", Data: map[string]interface{}{"name": "Carol"}},
		},
	}

	mappings := []transformer.FieldMapping{
		{SourceColumn: "name", CanonicalColumn: "full_name", CanonicalType: "VARCHAR"},
	}

	emitter := &testEmitter{}

	// Expect: update status to RUNNING
	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "RUNNING").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect: begin transaction
	mock.ExpectBegin()

	// Expect: clear prior data (3 deletes)
	mock.ExpectExec("DELETE FROM migration.lineage").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.canonical_row").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.exception").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))

	// Expect: 3 rows - canonical insert + checkpoint update for each
	for _, key := range []string{"row-1", "row-2", "row-3"} {
		mock.ExpectExec("INSERT INTO migration.canonical_row").
			WithArgs("batch-001", key, "ACTUAL").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectExec("UPDATE migration.batch SET checkpoint_key").
			WithArgs("batch-001", key).
			WillReturnResult(sqlmock.NewResult(0, 1))
	}

	// Expect: commit
	mock.ExpectCommit()

	// Expect: update results
	mock.ExpectExec("UPDATE migration.batch").
		WithArgs("batch-001", 3, 3, 0, float64(0)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Expect: update status to LOADED
	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "LOADED").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = ExecuteBatch(db, batch, provider, noopPipeline(), mappings, DefaultThresholds(), emitter)
	if err != nil {
		t.Fatalf("ExecuteBatch error: %v", err)
	}

	if batch.Status != StatusLoaded {
		t.Errorf("batch.Status = %q, want LOADED", batch.Status)
	}

	// Verify events.
	if len(emitter.events) < 2 {
		t.Fatalf("expected at least 2 events, got %d", len(emitter.events))
	}
	if emitter.events[0].Type != EventBatchStarted {
		t.Errorf("first event = %q, want batch_started", emitter.events[0].Type)
	}
	lastEvent := emitter.events[len(emitter.events)-1]
	if lastEvent.Type != EventBatchCompleted {
		t.Errorf("last event = %q, want batch_completed", lastEvent.Type)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestExecuteBatch_Idempotent verifies that running a batch twice produces the same
// output by confirming that prior data is cleared before re-processing.
func TestExecuteBatch_Idempotent(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	batch := &Batch{
		BatchID:        "batch-001",
		EngagementID:   "eng-001",
		BatchScope:     "members",
		Status:         StatusLoaded,
		MappingVersion: "v1",
	}

	provider := &memoryProvider{
		rows: []SourceRow{
			{Key: "row-1", Data: map[string]interface{}{"name": "Alice"}},
		},
	}

	mappings := []transformer.FieldMapping{
		{SourceColumn: "name", CanonicalColumn: "full_name", CanonicalType: "VARCHAR"},
	}

	// Second run expectations — clearPriorBatchData should delete existing rows.
	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "RUNNING").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectBegin()

	// Clear prior data — this time rows exist.
	mock.ExpectExec("DELETE FROM migration.lineage").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 5)) // had 5 lineage rows
	mock.ExpectExec("DELETE FROM migration.canonical_row").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 1)) // had 1 canonical row
	mock.ExpectExec("DELETE FROM migration.exception").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))

	mock.ExpectExec("INSERT INTO migration.canonical_row").
		WithArgs("batch-001", "row-1", "ACTUAL").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE migration.batch SET checkpoint_key").
		WithArgs("batch-001", "row-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()
	mock.ExpectExec("UPDATE migration.batch").
		WithArgs("batch-001", 1, 1, 0, float64(0)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "LOADED").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = ExecuteBatch(db, batch, provider, noopPipeline(), mappings, DefaultThresholds(), nil)
	if err != nil {
		t.Fatalf("ExecuteBatch (re-run) error: %v", err)
	}

	if batch.Status != StatusLoaded {
		t.Errorf("batch.Status = %q, want LOADED", batch.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestExecuteBatch_ThresholdHalt verifies the batch halts when error thresholds are breached.
func TestExecuteBatch_ThresholdHalt(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	batch := &Batch{
		BatchID:        "batch-001",
		EngagementID:   "eng-001",
		BatchScope:     "members",
		Status:         StatusPending,
		MappingVersion: "v1",
	}

	// 2 rows, both will fail -> 100% error rate, exceeds 5% threshold.
	provider := &memoryProvider{
		rows: []SourceRow{
			{Key: "row-1", Data: map[string]interface{}{"name": "Alice"}},
			{Key: "row-2", Data: map[string]interface{}{"name": "Bob"}},
		},
	}

	mappings := []transformer.FieldMapping{
		{SourceColumn: "name", CanonicalColumn: "full_name", CanonicalType: "VARCHAR", Required: true},
	}

	// Use a custom threshold of 0% to force halt on any error.
	thresholds := ErrorThresholds{
		HardErrorHaltPct:      0.0,
		SoftWarningMaxPct:     0.15,
		RetireeErrorTolerance: 0,
		FinancialBalanceTol:   "0.01",
	}

	emitter := &testEmitter{}

	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "RUNNING").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM migration.lineage").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.canonical_row").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.exception").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))

	// Transaction rolled back on halt.
	mock.ExpectRollback()

	// Halt batch.
	mock.ExpectExec("UPDATE migration.batch").
		WithArgs("batch-001", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = ExecuteBatch(db, batch, provider, failingPipeline(), mappings, thresholds, emitter)
	if err == nil {
		t.Fatal("expected error from halted batch")
	}

	if batch.Status != StatusFailed {
		t.Errorf("batch.Status = %q, want FAILED", batch.Status)
	}

	// Check that a batch_halted event was emitted.
	found := false
	for _, e := range emitter.events {
		if e.Type == EventBatchHalted {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected batch_halted event")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestExecuteBatch_RetireeZeroTolerance verifies immediate halt on retiree hard errors.
func TestExecuteBatch_RetireeZeroTolerance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	batch := &Batch{
		BatchID:        "batch-001",
		EngagementID:   "eng-001",
		BatchScope:     "retirees",
		Status:         StatusPending,
		MappingVersion: "v1",
	}

	provider := &memoryProvider{
		rows: []SourceRow{
			{Key: "ret-1", Data: map[string]interface{}{"name": "Retiree1"}, IsRetiree: true},
		},
	}

	mappings := []transformer.FieldMapping{
		{SourceColumn: "name", CanonicalColumn: "full_name", CanonicalType: "VARCHAR", Required: true},
	}

	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "RUNNING").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM migration.lineage").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.canonical_row").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.exception").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()
	mock.ExpectExec("UPDATE migration.batch").
		WithArgs("batch-001", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = ExecuteBatch(db, batch, provider, failingPipeline(), mappings, DefaultThresholds(), nil)
	if err == nil {
		t.Fatal("expected error for retiree hard error")
	}

	if batch.Status != StatusFailed {
		t.Errorf("batch.Status = %q, want FAILED", batch.Status)
	}
	if batch.HaltedReason == nil {
		t.Fatal("expected halted_reason to be set")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestResumeBatch_FromCheckpoint verifies that ResumeBatch picks up from the checkpoint key.
func TestResumeBatch_FromCheckpoint(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	checkpointKey := "row-2"
	prevLoaded := 2
	batch := &Batch{
		BatchID:        "batch-001",
		EngagementID:   "eng-001",
		BatchScope:     "members",
		Status:         StatusFailed,
		MappingVersion: "v1",
		CheckpointKey:  &checkpointKey,
		RowCountLoaded: &prevLoaded,
	}

	// Provider returns rows after checkpoint: row-3, row-4.
	provider := &memoryProvider{
		rows: []SourceRow{
			{Key: "row-1", Data: map[string]interface{}{"name": "Alice"}},
			{Key: "row-2", Data: map[string]interface{}{"name": "Bob"}},
			{Key: "row-3", Data: map[string]interface{}{"name": "Carol"}},
			{Key: "row-4", Data: map[string]interface{}{"name": "Dave"}},
		},
	}

	mappings := []transformer.FieldMapping{
		{SourceColumn: "name", CanonicalColumn: "full_name", CanonicalType: "VARCHAR"},
	}

	emitter := &testEmitter{}

	// Update status to RUNNING.
	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "RUNNING").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Clear halt reason.
	mock.ExpectExec("UPDATE migration.batch SET halted_reason").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Count prior errors for threshold restoration.
	mock.ExpectQuery("SELECT exception_type, COUNT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows([]string{"exception_type", "count"}))

	mock.ExpectBegin()

	// Process row-3 and row-4.
	for _, key := range []string{"row-3", "row-4"} {
		mock.ExpectExec("INSERT INTO migration.canonical_row").
			WithArgs("batch-001", key, "ACTUAL").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectExec("UPDATE migration.batch SET checkpoint_key").
			WithArgs("batch-001", key).
			WillReturnResult(sqlmock.NewResult(0, 1))
	}

	mock.ExpectCommit()

	// Update results: total = 2 (remaining) + 2 (prev) = 4, loaded = 2+2 = 4.
	mock.ExpectExec("UPDATE migration.batch").
		WithArgs("batch-001", 4, 4, 0, float64(0)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "LOADED").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = ResumeBatch(db, batch, provider, noopPipeline(), mappings, DefaultThresholds(), emitter)
	if err != nil {
		t.Fatalf("ResumeBatch error: %v", err)
	}

	if batch.Status != StatusLoaded {
		t.Errorf("batch.Status = %q, want LOADED", batch.Status)
	}

	// Verify events include started and completed.
	hasStarted := false
	hasCompleted := false
	for _, e := range emitter.events {
		if e.Type == EventBatchStarted {
			hasStarted = true
		}
		if e.Type == EventBatchCompleted {
			hasCompleted = true
		}
	}
	if !hasStarted {
		t.Error("expected batch_started event")
	}
	if !hasCompleted {
		t.Error("expected batch_completed event")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestExecuteBatch_EmptyBatch verifies that an empty batch completes successfully.
func TestExecuteBatch_EmptyBatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	batch := &Batch{
		BatchID:        "batch-001",
		EngagementID:   "eng-001",
		BatchScope:     "empty",
		Status:         StatusPending,
		MappingVersion: "v1",
	}

	provider := &memoryProvider{rows: []SourceRow{}}
	mappings := []transformer.FieldMapping{}

	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "RUNNING").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM migration.lineage").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.canonical_row").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.exception").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()
	mock.ExpectExec("UPDATE migration.batch").
		WithArgs("batch-001", 0, 0, 0, float64(0)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "LOADED").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = ExecuteBatch(db, batch, provider, noopPipeline(), mappings, DefaultThresholds(), nil)
	if err != nil {
		t.Fatalf("ExecuteBatch error: %v", err)
	}
	if batch.Status != StatusLoaded {
		t.Errorf("batch.Status = %q, want LOADED", batch.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- Tests: Event types ---

func TestEventTypeConstants(t *testing.T) {
	if EventBatchStarted != "batch_started" {
		t.Errorf("EventBatchStarted = %q", EventBatchStarted)
	}
	if EventBatchProgress != "batch_progress" {
		t.Errorf("EventBatchProgress = %q", EventBatchProgress)
	}
	if EventBatchCompleted != "batch_completed" {
		t.Errorf("EventBatchCompleted = %q", EventBatchCompleted)
	}
	if EventBatchHalted != "batch_halted" {
		t.Errorf("EventBatchHalted = %q", EventBatchHalted)
	}
}

// --- Tests: isHardError ---

func TestIsHardError(t *testing.T) {
	hardTypes := []transformer.ExceptionType{
		transformer.ExceptionMissingRequired,
		transformer.ExceptionBusinessRule,
		transformer.ExceptionReferentialIntegrity,
	}
	for _, et := range hardTypes {
		if !isHardError(et) {
			t.Errorf("expected %q to be a hard error", et)
		}
	}

	softTypes := []transformer.ExceptionType{
		transformer.ExceptionInvalidFormat,
		transformer.ExceptionCrossTableMismatch,
		transformer.ExceptionThresholdBreach,
	}
	for _, et := range softTypes {
		if isHardError(et) {
			t.Errorf("expected %q to NOT be a hard error", et)
		}
	}
}

// --- Tests: noopEmitter ---

func TestNoopEmitter_DoesNotPanic(t *testing.T) {
	e := noopEmitter{}
	e.Emit(BatchEvent{Type: "test"})
	// If we get here without panic, the test passes.
}

// --- Tests: ExecuteBatch with exceptions that produce lineage ---

func TestExecuteBatch_WithExceptions(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Pipeline that only warns on rows where name starts with "bad_".
	warnPipeline := transformer.NewPipeline([]transformer.TransformHandler{
		{
			Name:     "WarnBadOnly",
			Priority: 10,
			Apply: func(value interface{}, _ map[string]interface{}, m transformer.FieldMapping, ctx *transformer.TransformContext) (interface{}, error) {
				s, ok := value.(string)
				if ok && len(s) >= 4 && s[:4] == "bad_" {
					ctx.AddException("WarnBadOnly", m.CanonicalColumn, s,
						transformer.ExceptionInvalidFormat, "format warning")
					return nil, fmt.Errorf("format warning")
				}
				return value, nil
			},
		},
	})

	batch := &Batch{
		BatchID:        "batch-001",
		EngagementID:   "eng-001",
		BatchScope:     "members",
		Status:         StatusPending,
		MappingVersion: "v1",
	}

	// 10 rows, 1 bad -> 10% warning rate, under 15% threshold.
	provider := &memoryProvider{
		rows: []SourceRow{
			{Key: "row-1", Data: map[string]interface{}{"name": "bad_Alice"}},
			{Key: "row-2", Data: map[string]interface{}{"name": "Bob"}},
			{Key: "row-3", Data: map[string]interface{}{"name": "Carol"}},
			{Key: "row-4", Data: map[string]interface{}{"name": "Dave"}},
			{Key: "row-5", Data: map[string]interface{}{"name": "Eve"}},
			{Key: "row-6", Data: map[string]interface{}{"name": "Frank"}},
			{Key: "row-7", Data: map[string]interface{}{"name": "Grace"}},
			{Key: "row-8", Data: map[string]interface{}{"name": "Heidi"}},
			{Key: "row-9", Data: map[string]interface{}{"name": "Ivan"}},
			{Key: "row-10", Data: map[string]interface{}{"name": "Judy"}},
		},
	}

	mappings := []transformer.FieldMapping{
		{SourceColumn: "name", CanonicalColumn: "full_name", CanonicalType: "VARCHAR"},
	}

	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "RUNNING").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM migration.lineage").WithArgs("batch-001").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.canonical_row").WithArgs("batch-001").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM migration.exception").WithArgs("batch-001").WillReturnResult(sqlmock.NewResult(0, 0))

	// Row 1: bad row -> canonical + exception + checkpoint.
	mock.ExpectExec("INSERT INTO migration.canonical_row").
		WithArgs("batch-001", "row-1", "ESTIMATED").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO migration.exception").
		WithArgs("batch-001", "row-1", "WarnBadOnly", "full_name", "bad_Alice", "INVALID_FORMAT", "format warning").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE migration.batch SET checkpoint_key").
		WithArgs("batch-001", "row-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Rows 2-10: clean rows -> canonical + checkpoint each.
	for i := 2; i <= 10; i++ {
		key := fmt.Sprintf("row-%d", i)
		mock.ExpectExec("INSERT INTO migration.canonical_row").
			WithArgs("batch-001", key, "ACTUAL").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectExec("UPDATE migration.batch SET checkpoint_key").
			WithArgs("batch-001", key).
			WillReturnResult(sqlmock.NewResult(0, 1))
	}

	mock.ExpectCommit()
	// 10 total, 10 loaded, 1 exception, 0% hard error rate.
	mock.ExpectExec("UPDATE migration.batch").
		WithArgs("batch-001", 10, 10, 1, float64(0)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE migration.batch SET status").
		WithArgs("batch-001", "LOADED").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = ExecuteBatch(db, batch, provider, warnPipeline, mappings, DefaultThresholds(), nil)
	if err != nil {
		t.Fatalf("ExecuteBatch error: %v", err)
	}
	if batch.Status != StatusLoaded {
		t.Errorf("batch.Status = %q, want LOADED", batch.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
