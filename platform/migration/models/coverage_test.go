package models

import (
	"encoding/json"
	"testing"
)

func TestCoverageReportModel(t *testing.T) {
	t.Run("JSON_roundtrip", func(t *testing.T) {
		report := CoverageReport{
			ReportID:             "rpt-001",
			ProfilingRunID:       "run-001",
			SchemaVersionID:      "sv-001",
			TotalCanonicalFields: 20,
			MappedFields:         15,
			UnmappedFields:       5,
			CoveragePct:          75.0,
			AutoMappedCount:      10,
			ReviewRequiredCount:  3,
			NoMatchCount:         2,
			FieldDetails: []CoverageFieldDetail{
				{
					CanonicalEntity: "canonical_members",
					FieldName:       "member_id",
					DataType:        "VARCHAR(200)",
					IsRequired:      true,
					Status:          CoverageFieldAutoMapped,
					SourceCandidates: []CoverageSourceCandidate{
						{SourceTable: "employees", SourceColumn: "emp_id", Confidence: 0.85, MatchReason: "name_similarity"},
					},
				},
				{
					CanonicalEntity:  "canonical_members",
					FieldName:        "member_status",
					DataType:         "VARCHAR(20)",
					IsRequired:       false,
					Status:           CoverageFieldUnmapped,
					SourceCandidates: []CoverageSourceCandidate{},
				},
			},
		}

		data, err := json.Marshal(report)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded CoverageReport
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.ReportID != "rpt-001" {
			t.Errorf("ReportID = %q, want %q", decoded.ReportID, "rpt-001")
		}
		if decoded.TotalCanonicalFields != 20 {
			t.Errorf("TotalCanonicalFields = %d, want 20", decoded.TotalCanonicalFields)
		}
		if decoded.MappedFields != 15 {
			t.Errorf("MappedFields = %d, want 15", decoded.MappedFields)
		}
		if decoded.CoveragePct != 75.0 {
			t.Errorf("CoveragePct = %.2f, want 75.0", decoded.CoveragePct)
		}
		if len(decoded.FieldDetails) != 2 {
			t.Fatalf("FieldDetails len = %d, want 2", len(decoded.FieldDetails))
		}
		if decoded.FieldDetails[0].Status != CoverageFieldAutoMapped {
			t.Errorf("FieldDetails[0].Status = %q, want %q", decoded.FieldDetails[0].Status, CoverageFieldAutoMapped)
		}
		if len(decoded.FieldDetails[0].SourceCandidates) != 1 {
			t.Errorf("FieldDetails[0].SourceCandidates len = %d, want 1", len(decoded.FieldDetails[0].SourceCandidates))
		}
	})

	t.Run("status_constants", func(t *testing.T) {
		if CoverageFieldMapped != "MAPPED" {
			t.Errorf("CoverageFieldMapped = %q, want MAPPED", CoverageFieldMapped)
		}
		if CoverageFieldAutoMapped != "AUTO_MAPPED" {
			t.Errorf("CoverageFieldAutoMapped = %q, want AUTO_MAPPED", CoverageFieldAutoMapped)
		}
		if CoverageFieldReviewRequired != "REVIEW_REQUIRED" {
			t.Errorf("CoverageFieldReviewRequired = %q, want REVIEW_REQUIRED", CoverageFieldReviewRequired)
		}
		if CoverageFieldUnmapped != "UNMAPPED" {
			t.Errorf("CoverageFieldUnmapped = %q, want UNMAPPED", CoverageFieldUnmapped)
		}
	})

	t.Run("empty_field_details", func(t *testing.T) {
		report := CoverageReport{
			FieldDetails: []CoverageFieldDetail{},
		}
		data, err := json.Marshal(report)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}
		var decoded CoverageReport
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if decoded.FieldDetails == nil {
			t.Error("FieldDetails should be empty slice, not nil")
		}
	})

	t.Run("source_candidate_fields", func(t *testing.T) {
		candidate := CoverageSourceCandidate{
			SourceTable:  "legacy_members",
			SourceColumn: "mbr_id",
			Confidence:   0.95,
			MatchReason:  "exact_name",
		}
		data, err := json.Marshal(candidate)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}
		var decoded CoverageSourceCandidate
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}
		if decoded.SourceTable != "legacy_members" {
			t.Errorf("SourceTable = %q, want legacy_members", decoded.SourceTable)
		}
		if decoded.Confidence != 0.95 {
			t.Errorf("Confidence = %f, want 0.95", decoded.Confidence)
		}
		if decoded.MatchReason != "exact_name" {
			t.Errorf("MatchReason = %q, want exact_name", decoded.MatchReason)
		}
	})
}
