package intelligence

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestScoreColumns_Success(t *testing.T) {
	// Set up a mock Python intelligence server.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/intelligence/score-columns" {
			t.Errorf("expected /intelligence/score-columns, got %s", r.URL.Path)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", ct)
		}

		// Verify the request body is well-formed.
		var req ScoreColumnsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		if len(req.Columns) != 2 {
			t.Errorf("expected 2 columns, got %d", len(req.Columns))
		}
		if req.ConceptTag != "employee-master" {
			t.Errorf("expected concept_tag employee-master, got %s", req.ConceptTag)
		}
		if req.CanonicalTable != "member" {
			t.Errorf("expected canonical_table member, got %s", req.CanonicalTable)
		}
		if req.TenantID != "test-tenant" {
			t.Errorf("expected tenant_id test-tenant, got %s", req.TenantID)
		}

		// Return a mock response.
		resp := ScoreColumnsResponse{
			Mappings: []ScoredMapping{
				{
					SourceColumn:    "MBR_NBR",
					CanonicalColumn: "member_id",
					Confidence:      0.85,
					Signals:         map[string]float64{"name": 0.7, "type": 1.0},
				},
				{
					SourceColumn:    "BIRTH_DT",
					CanonicalColumn: "birth_date",
					Confidence:      0.90,
					Signals:         map[string]float64{"name": 0.8, "type": 1.0},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	resp, err := client.ScoreColumns(context.Background(), ScoreColumnsRequest{
		Columns: []ColumnInfo{
			{ColumnName: "MBR_NBR", DataType: "INTEGER", NullRate: 0.0, Cardinality: 500, RowCount: 500},
			{ColumnName: "BIRTH_DT", DataType: "VARCHAR(10)", NullRate: 0.0, Cardinality: 480, RowCount: 500},
		},
		ConceptTag:     "employee-master",
		CanonicalTable: "member",
		TenantID:       "test-tenant",
	})
	if err != nil {
		t.Fatalf("ScoreColumns error: %v", err)
	}

	if len(resp.Mappings) != 2 {
		t.Fatalf("expected 2 mappings, got %d", len(resp.Mappings))
	}
	if resp.Mappings[0].SourceColumn != "MBR_NBR" {
		t.Errorf("mapping[0].source_column = %s, want MBR_NBR", resp.Mappings[0].SourceColumn)
	}
	if resp.Mappings[0].CanonicalColumn != "member_id" {
		t.Errorf("mapping[0].canonical_column = %s, want member_id", resp.Mappings[0].CanonicalColumn)
	}
	if resp.Mappings[0].Confidence != 0.85 {
		t.Errorf("mapping[0].confidence = %f, want 0.85", resp.Mappings[0].Confidence)
	}
	if resp.Mappings[1].SourceColumn != "BIRTH_DT" {
		t.Errorf("mapping[1].source_column = %s, want BIRTH_DT", resp.Mappings[1].SourceColumn)
	}
}

func TestScoreColumns_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error": "model unavailable"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.ScoreColumns(context.Background(), ScoreColumnsRequest{
		Columns:        []ColumnInfo{{ColumnName: "X", DataType: "INT"}},
		ConceptTag:     "employee-master",
		CanonicalTable: "member",
		TenantID:       "test-tenant",
	})
	if err == nil {
		t.Fatal("expected error for 500 response, got nil")
	}
}

func TestScoreColumns_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{invalid json`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.ScoreColumns(context.Background(), ScoreColumnsRequest{
		Columns:        []ColumnInfo{{ColumnName: "X", DataType: "INT"}},
		ConceptTag:     "employee-master",
		CanonicalTable: "member",
		TenantID:       "test-tenant",
	})
	if err == nil {
		t.Fatal("expected error for invalid JSON response, got nil")
	}
}

func TestScoreColumns_ConnectionRefused(t *testing.T) {
	// Point at a port that's not listening.
	client := NewClient("http://127.0.0.1:19999")
	_, err := client.ScoreColumns(context.Background(), ScoreColumnsRequest{
		Columns:        []ColumnInfo{{ColumnName: "X", DataType: "INT"}},
		ConceptTag:     "employee-master",
		CanonicalTable: "member",
		TenantID:       "test-tenant",
	})
	if err == nil {
		t.Fatal("expected error for connection refused, got nil")
	}
}

func TestScoreColumns_EmptyMappings(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ScoreColumnsResponse{Mappings: []ScoredMapping{}})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	resp, err := client.ScoreColumns(context.Background(), ScoreColumnsRequest{
		Columns:        []ColumnInfo{{ColumnName: "UNKNOWN_COL", DataType: "INT"}},
		ConceptTag:     "employee-master",
		CanonicalTable: "member",
		TenantID:       "test-tenant",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Mappings) != 0 {
		t.Errorf("expected 0 mappings, got %d", len(resp.Mappings))
	}
}

func TestAnalyzeMismatches_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/intelligence/analyze-mismatches" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}

		var req AnalyzeMismatchesRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if len(req.ReconciliationResults) != 2 {
			t.Errorf("expected 2 results, got %d", len(req.ReconciliationResults))
		}

		resp := AnalyzeMismatchesResponse{
			Patterns: []DetectedPattern{
				{
					PatternID:       "salary_TIER_1_negative",
					SuspectedDomain: "salary",
					PlanCode:        "TIER_1",
					Direction:       "negative",
					MemberCount:     23,
					MeanVariance:    "-142.75",
					CV:              0.18,
					AffectedMembers: []string{"M001", "M002"},
				},
			},
			Suggestions: []CorrectionSuggestion{
				{
					CorrectionType:      "MAPPING_FIX",
					AffectedField:       "gross_amount",
					Confidence:          0.82,
					Evidence:            "23 members in TIER_1 show -142.75 salary variance",
					AffectedMemberCount: 23,
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	resp, err := client.AnalyzeMismatches(context.Background(), AnalyzeMismatchesRequest{
		TenantID: "test-tenant",
		ReconciliationResults: []MismatchRecord{
			{MemberID: "M001", VarianceAmount: "-150.50", Category: "MAJOR", SuspectedDomain: "salary", PlanCode: "TIER_1"},
			{MemberID: "M002", VarianceAmount: "-135.00", Category: "MAJOR", SuspectedDomain: "salary", PlanCode: "TIER_1"},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Patterns) != 1 {
		t.Fatalf("expected 1 pattern, got %d", len(resp.Patterns))
	}
	if resp.Patterns[0].MemberCount != 23 {
		t.Errorf("expected member_count=23, got %d", resp.Patterns[0].MemberCount)
	}
	if len(resp.Suggestions) != 1 {
		t.Fatalf("expected 1 suggestion, got %d", len(resp.Suggestions))
	}
	if resp.Suggestions[0].CorrectionType != "MAPPING_FIX" {
		t.Errorf("expected MAPPING_FIX, got %s", resp.Suggestions[0].CorrectionType)
	}
}

func TestAnalyzeMismatches_ServiceDown(t *testing.T) {
	client := NewClient("http://127.0.0.1:1")
	_, err := client.AnalyzeMismatches(context.Background(), AnalyzeMismatchesRequest{
		TenantID: "test-tenant",
		ReconciliationResults: []MismatchRecord{
			{MemberID: "M001", VarianceAmount: "-150.50", Category: "MAJOR"},
		},
	})
	if err == nil {
		t.Fatal("expected error when service is unreachable")
	}
}

func TestAnalyzeMismatches_EmptyResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(AnalyzeMismatchesResponse{})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	resp, err := client.AnalyzeMismatches(context.Background(), AnalyzeMismatchesRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Patterns) != 0 {
		t.Errorf("expected 0 patterns, got %d", len(resp.Patterns))
	}
}
