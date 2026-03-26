package worker

import (
	"encoding/json"
	"testing"

	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// --- AC-1: Executor interface compliance ---

func TestProfileL4Executor_ImplementsExecutor(t *testing.T) {
	var _ Executor = (*ProfileL4Executor)(nil)
}

// --- AC-3: L4Input deserialization ---

func TestL4Input_Unmarshal(t *testing.T) {
	raw := `{
		"profiling_run_id": "run-001",
		"engagement_id": "eng-001"
	}`
	var input L4Input
	if err := json.Unmarshal([]byte(raw), &input); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if input.ProfilingRunID != "run-001" {
		t.Errorf("ProfilingRunID = %q, want run-001", input.ProfilingRunID)
	}
	if input.EngagementID != "eng-001" {
		t.Errorf("EngagementID = %q, want eng-001", input.EngagementID)
	}
}

// --- AC-3: Name normalization ---

func TestNormalizeName(t *testing.T) {
	tests := []struct {
		input, want string
	}{
		{"member_id", "member_id"},
		{"MEMBER_ID", "member_id"},
		{"fk_member_id", "member_id"},
		{"idx_member_status", "member_status"},
		{"pk_id", "id"},
		{"tbl_employees", "employees"},
		{"src_salary", "salary"},
		{"col_name", "name"},
		{"  Member_ID  ", "member_id"},
	}
	for _, tt := range tests {
		got := normalizeName(tt.input)
		if got != tt.want {
			t.Errorf("normalizeName(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

// --- AC-3: Name similarity ---

func TestNameSimilarity(t *testing.T) {
	tests := []struct {
		a, b   string
		minSim float64
		desc   string
	}{
		{"member_id", "member_id", 1.0, "exact match"},
		{"member", "member_id", 0.5, "containment"},
		{"birth_date", "date_of_birth", 0.3, "shared tokens"},
		{"salary_amount", "amount", 0.4, "partial containment"},
		{"xyz", "abc", 0.0, "no match"},
		{"", "abc", 0.0, "empty a"},
		{"abc", "", 0.0, "empty b"},
	}
	for _, tt := range tests {
		got := nameSimilarity(tt.a, tt.b)
		if got < tt.minSim {
			t.Errorf("nameSimilarity(%q, %q) = %.2f, want >= %.2f (%s)", tt.a, tt.b, got, tt.minSim, tt.desc)
		}
	}
}

// --- AC-3: Data type compatibility ---

func TestDataTypeCompatible(t *testing.T) {
	compatible := []struct {
		source, canonical string
	}{
		{"INTEGER", "INT"},
		{"VARCHAR(200)", "TEXT"},
		{"TIMESTAMPTZ", "TIMESTAMP"},
		{"NUMERIC(18,2)", "DECIMAL"},
		{"BOOLEAN", "BOOL"},
		{"DATE", "DATE"},
	}
	for _, tt := range compatible {
		if !dataTypeCompatible(tt.source, tt.canonical) {
			t.Errorf("dataTypeCompatible(%q, %q) = false, want true", tt.source, tt.canonical)
		}
	}

	incompatible := []struct {
		source, canonical string
	}{
		{"INTEGER", "TEXT"},
		{"DATE", "BOOLEAN"},
		{"VARCHAR", "NUMERIC"},
	}
	for _, tt := range incompatible {
		if dataTypeCompatible(tt.source, tt.canonical) {
			t.Errorf("dataTypeCompatible(%q, %q) = true, want false", tt.source, tt.canonical)
		}
	}
}

// --- AC-3: Type family classification ---

func TestTypeFamily(t *testing.T) {
	tests := []struct {
		input, want string
	}{
		{"integer", "integer"},
		{"bigint", "integer"},
		{"serial", "integer"},
		{"numeric(18,2)", "numeric"},
		{"decimal", "numeric"},
		{"float", "numeric"},
		{"double precision", "numeric"},
		{"money", "numeric"},
		{"varchar(200)", "text"},
		{"text", "text"},
		{"character varying", "text"},
		{"timestamp", "timestamp"},
		{"timestamptz", "timestamp"},
		{"datetime", "timestamp"},
		{"date", "date"},
		{"boolean", "boolean"},
		{"uuid", "uuid"},
		{"jsonb", "json"},
		{"blob", ""},
	}
	for _, tt := range tests {
		got := typeFamily(tt.input)
		if got != tt.want {
			t.Errorf("typeFamily(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

// --- AC-3: Partial name match ---

func TestPartialNameMatch(t *testing.T) {
	if !partialNameMatch("member_id", "member_status") {
		t.Error("expected partial match on 'member' token")
	}
	if !partialNameMatch("salary_amount", "amount_total") {
		t.Error("expected partial match on 'amount' token")
	}
	if partialNameMatch("xyz_abc", "def_ghi") {
		t.Error("expected no partial match")
	}
	if partialNameMatch("a_b", "c_d") {
		t.Error("single-char tokens should not match")
	}
}

// --- AC-3: Candidate finding ---

func TestL4Executor_FindCandidates(t *testing.T) {
	exec := &ProfileL4Executor{}

	sourceColumns := []db.SourceColumnWithTable{
		{SourceColumnProfile: models.SourceColumnProfile{ColumnName: "member_id", DataType: "VARCHAR"}, TableName: "legacy_members"},
		{SourceColumnProfile: models.SourceColumnProfile{ColumnName: "mbr_status", DataType: "VARCHAR"}, TableName: "legacy_members"},
		{SourceColumnProfile: models.SourceColumnProfile{ColumnName: "salary_amount", DataType: "NUMERIC"}, TableName: "legacy_salaries"},
		{SourceColumnProfile: models.SourceColumnProfile{ColumnName: "random_xyz", DataType: "TEXT"}, TableName: "junk"},
	}

	t.Run("exact_match", func(t *testing.T) {
		cf := models.SchemaVersionField{
			Entity:    "canonical_members",
			FieldName: "member_id",
			DataType:  "VARCHAR(200)",
		}
		candidates := exec.findCandidates(cf, sourceColumns)
		if len(candidates) == 0 {
			t.Fatal("expected at least one candidate for member_id")
		}
		if candidates[0].Confidence != 0.95 {
			t.Errorf("best confidence = %.2f, want 0.95", candidates[0].Confidence)
		}
		if candidates[0].MatchReason != "exact_name" {
			t.Errorf("match_reason = %q, want exact_name", candidates[0].MatchReason)
		}
		if candidates[0].SourceTable != "legacy_members" {
			t.Errorf("source_table = %q, want legacy_members", candidates[0].SourceTable)
		}
	})

	t.Run("no_match", func(t *testing.T) {
		cf := models.SchemaVersionField{
			Entity:    "canonical_members",
			FieldName: "completely_unique_field",
			DataType:  "TEXT",
		}
		candidates := exec.findCandidates(cf, sourceColumns)
		if len(candidates) != 0 {
			t.Errorf("expected 0 candidates, got %d", len(candidates))
		}
	})

	t.Run("candidates_sorted_by_confidence", func(t *testing.T) {
		cf := models.SchemaVersionField{
			Entity:    "canonical_members",
			FieldName: "member_status",
			DataType:  "VARCHAR(20)",
		}
		candidates := exec.findCandidates(cf, sourceColumns)
		for i := 1; i < len(candidates); i++ {
			if candidates[i].Confidence > candidates[i-1].Confidence {
				t.Error("candidates not sorted by confidence descending")
			}
		}
	})
}

// --- AC-3: Build coverage report ---

func TestL4Executor_BuildCoverageReport(t *testing.T) {
	exec := &ProfileL4Executor{}

	canonicalFields := []models.SchemaVersionField{
		{FieldID: "f1", Entity: "canonical_members", FieldName: "member_id", DataType: "VARCHAR(200)", IsRequired: true},
		{FieldID: "f2", Entity: "canonical_members", FieldName: "member_status", DataType: "VARCHAR(20)", IsRequired: false},
		{FieldID: "f3", Entity: "canonical_salaries", FieldName: "salary_amount", DataType: "NUMERIC(18,2)", IsRequired: true},
		{FieldID: "f4", Entity: "canonical_members", FieldName: "completely_unknown_field", DataType: "TEXT", IsRequired: false},
	}

	sourceColumns := []db.SourceColumnWithTable{
		{SourceColumnProfile: models.SourceColumnProfile{ColumnName: "member_id", DataType: "VARCHAR"}, TableName: "src_members"},
		{SourceColumnProfile: models.SourceColumnProfile{ColumnName: "salary_amount", DataType: "NUMERIC"}, TableName: "src_salaries"},
	}

	t.Run("with_existing_mapping", func(t *testing.T) {
		existingMappings := map[string]string{
			"canonical_members.member_status": "src_members.status_code",
		}

		report := exec.buildCoverageReport("run-001", "sv-001", canonicalFields, sourceColumns, existingMappings)

		if report.TotalCanonicalFields != 4 {
			t.Errorf("TotalCanonicalFields = %d, want 4", report.TotalCanonicalFields)
		}

		// member_id: exact match (AUTO_MAPPED, confidence 0.95)
		// member_status: existing mapping (MAPPED)
		// salary_amount: exact match (AUTO_MAPPED, confidence 0.95)
		// completely_unknown_field: no match (UNMAPPED)

		// Count by status.
		statusCounts := map[models.CoverageFieldStatus]int{}
		for _, fd := range report.FieldDetails {
			statusCounts[fd.Status]++
		}

		if statusCounts[models.CoverageFieldMapped] != 1 {
			t.Errorf("MAPPED count = %d, want 1", statusCounts[models.CoverageFieldMapped])
		}
		if statusCounts[models.CoverageFieldAutoMapped] != 2 {
			t.Errorf("AUTO_MAPPED count = %d, want 2", statusCounts[models.CoverageFieldAutoMapped])
		}
		if statusCounts[models.CoverageFieldUnmapped] != 1 {
			t.Errorf("UNMAPPED count = %d, want 1", statusCounts[models.CoverageFieldUnmapped])
		}

		if report.MappedFields != 3 {
			t.Errorf("MappedFields = %d, want 3", report.MappedFields)
		}
		if report.UnmappedFields != 1 {
			t.Errorf("UnmappedFields = %d, want 1", report.UnmappedFields)
		}
		if report.AutoMappedCount != 2 {
			t.Errorf("AutoMappedCount = %d, want 2", report.AutoMappedCount)
		}
		if report.NoMatchCount != 1 {
			t.Errorf("NoMatchCount = %d, want 1", report.NoMatchCount)
		}

		expectedPct := 75.0 // 3/4 * 100
		if report.CoveragePct != expectedPct {
			t.Errorf("CoveragePct = %.2f, want %.2f", report.CoveragePct, expectedPct)
		}
	})

	t.Run("no_mappings", func(t *testing.T) {
		report := exec.buildCoverageReport("run-002", "sv-001", canonicalFields, sourceColumns, map[string]string{})

		if report.TotalCanonicalFields != 4 {
			t.Errorf("TotalCanonicalFields = %d, want 4", report.TotalCanonicalFields)
		}

		// member_id: exact (AUTO_MAPPED)
		// member_status: no exact match, no candidates above 0.5 (UNMAPPED likely)
		// salary_amount: exact (AUTO_MAPPED)
		// completely_unknown_field: no match (UNMAPPED)

		if report.AutoMappedCount < 2 {
			t.Errorf("AutoMappedCount = %d, want >= 2", report.AutoMappedCount)
		}
	})

	t.Run("candidate_limit_5", func(t *testing.T) {
		// Create many source columns that could match.
		var manySources []db.SourceColumnWithTable
		for i := 0; i < 10; i++ {
			manySources = append(manySources, db.SourceColumnWithTable{
				SourceColumnProfile: models.SourceColumnProfile{
					ColumnName: "member_id",
					DataType:   "VARCHAR",
				},
				TableName: "table_" + string(rune('a'+i)),
			})
		}

		fields := []models.SchemaVersionField{
			{FieldID: "f1", Entity: "canonical_members", FieldName: "member_id", DataType: "VARCHAR(200)"},
		}
		report := exec.buildCoverageReport("run-003", "sv-001", fields, manySources, map[string]string{})

		for _, fd := range report.FieldDetails {
			if len(fd.SourceCandidates) > 5 {
				t.Errorf("source_candidates count = %d, want <= 5", len(fd.SourceCandidates))
			}
		}
	})

	t.Run("empty_fields", func(t *testing.T) {
		report := exec.buildCoverageReport("run-004", "sv-001", []models.SchemaVersionField{}, sourceColumns, map[string]string{})
		if report.TotalCanonicalFields != 0 {
			t.Errorf("TotalCanonicalFields = %d, want 0", report.TotalCanonicalFields)
		}
		if report.CoveragePct != 0 {
			t.Errorf("CoveragePct = %.2f, want 0", report.CoveragePct)
		}
	})
}
