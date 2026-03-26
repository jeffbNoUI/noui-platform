package models

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDriftModels(t *testing.T) {
	t.Run("drift_detection_run_status_constants", func(t *testing.T) {
		statuses := []DriftDetectionRunStatus{
			DriftRunPending, DriftRunRunning, DriftRunCompleted, DriftRunFailed,
		}
		expected := []string{"PENDING", "RUNNING", "COMPLETED", "FAILED"}
		for i, s := range statuses {
			if string(s) != expected[i] {
				t.Errorf("expected %q, got %q", expected[i], s)
			}
		}
	})

	t.Run("drift_type_constants", func(t *testing.T) {
		types := []DriftType{DriftTypeSchema, DriftTypeData, DriftTypeBoth}
		expected := []string{"SCHEMA", "DATA", "BOTH"}
		for i, dt := range types {
			if string(dt) != expected[i] {
				t.Errorf("expected %q, got %q", expected[i], dt)
			}
		}
	})

	t.Run("drift_change_type_constants", func(t *testing.T) {
		changeTypes := []DriftChangeType{
			DriftColumnAdded, DriftColumnRemoved, DriftColumnTypeChanged,
			DriftTableAdded, DriftTableRemoved, DriftRowCountDrift,
		}
		expected := []string{
			"COLUMN_ADDED", "COLUMN_REMOVED", "COLUMN_TYPE_CHANGED",
			"TABLE_ADDED", "TABLE_REMOVED", "ROW_COUNT_DRIFT",
		}
		for i, ct := range changeTypes {
			if string(ct) != expected[i] {
				t.Errorf("expected %q, got %q", expected[i], ct)
			}
		}
	})

	t.Run("drift_severity_constants", func(t *testing.T) {
		severities := []DriftSeverity{
			DriftSeverityCritical, DriftSeverityHigh,
			DriftSeverityMedium, DriftSeverityLow,
		}
		expected := []string{"CRITICAL", "HIGH", "MEDIUM", "LOW"}
		for i, s := range severities {
			if string(s) != expected[i] {
				t.Errorf("expected %q, got %q", expected[i], s)
			}
		}
	})

	t.Run("drift_row_count_threshold_default", func(t *testing.T) {
		if DriftRowCountThresholdPct != 0.10 {
			t.Errorf("expected DriftRowCountThresholdPct=0.10, got %f", DriftRowCountThresholdPct)
		}
	})

	t.Run("drift_detection_run_json_roundtrip", func(t *testing.T) {
		now := time.Now()
		run := DriftDetectionRun{
			RunID:              "run-001",
			EngagementID:       "eng-001",
			Status:             DriftRunCompleted,
			DriftType:          DriftTypeBoth,
			BaselineSnapshotID: "sv-001",
			DetectedChanges:    5,
			CriticalChanges:    2,
			StartedAt:          &now,
			CompletedAt:        &now,
			CreatedAt:          now,
		}
		b, err := json.Marshal(run)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}
		var out map[string]interface{}
		json.Unmarshal(b, &out)

		if out["run_id"] != "run-001" {
			t.Errorf("unexpected run_id: %v", out["run_id"])
		}
		if out["drift_type"] != "BOTH" {
			t.Errorf("unexpected drift_type: %v", out["drift_type"])
		}
		if int(out["detected_changes"].(float64)) != 5 {
			t.Errorf("unexpected detected_changes: %v", out["detected_changes"])
		}
	})

	t.Run("drift_record_json_roundtrip", func(t *testing.T) {
		now := time.Now()
		rec := DriftRecord{
			RecordID:       "rec-001",
			RunID:          "run-001",
			ChangeType:     DriftColumnAdded,
			Entity:         "members.new_col",
			Detail:         json.RawMessage(`{"new_type":"varchar(100)"}`),
			Severity:       DriftSeverityLow,
			AffectsMapping: false,
			CreatedAt:      now,
		}
		b, err := json.Marshal(rec)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}
		var out map[string]interface{}
		json.Unmarshal(b, &out)

		if out["change_type"] != "COLUMN_ADDED" {
			t.Errorf("unexpected change_type: %v", out["change_type"])
		}
		if out["affects_mapping"] != false {
			t.Errorf("expected affects_mapping=false")
		}
	})

	t.Run("create_request_default", func(t *testing.T) {
		req := CreateDriftDetectionRequest{}
		if req.DriftType != "" {
			t.Errorf("expected empty default drift_type, got %s", req.DriftType)
		}
		req.DriftType = DriftTypeBoth
		if req.DriftType != DriftTypeBoth {
			t.Error("failed to set drift_type")
		}
	})
}
