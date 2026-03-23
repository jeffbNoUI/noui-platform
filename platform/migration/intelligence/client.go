// Package intelligence provides an HTTP client for the Python intelligence
// service that scores source columns against canonical schemas using signal-based
// analysis (column name patterns, data type, cardinality, null rates, etc.).
package intelligence

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ColumnInfo describes a single source column sent to the intelligence service.
type ColumnInfo struct {
	ColumnName  string  `json:"column_name"`
	DataType    string  `json:"data_type"`
	NullRate    float64 `json:"null_rate"`
	Cardinality int     `json:"cardinality"`
	RowCount    int     `json:"row_count"`
}

// ScoreColumnsRequest is the request body for POST /intelligence/score-columns.
type ScoreColumnsRequest struct {
	Columns        []ColumnInfo `json:"columns"`
	ConceptTag     string       `json:"concept_tag"`
	CanonicalTable string       `json:"canonical_table"`
	TenantID       string       `json:"tenant_id"`
}

// ScoredMapping is a single mapping result returned by the intelligence service.
type ScoredMapping struct {
	SourceColumn    string             `json:"source_column"`
	CanonicalColumn string             `json:"canonical_column"`
	Confidence      float64            `json:"confidence"`
	Signals         map[string]float64 `json:"signals"`
}

// ScoreColumnsResponse is the response body from POST /intelligence/score-columns.
type ScoreColumnsResponse struct {
	Mappings []ScoredMapping `json:"mappings"`
}

// Scorer defines the interface for scoring columns, enabling test mocking.
type Scorer interface {
	ScoreColumns(ctx context.Context, req ScoreColumnsRequest) (*ScoreColumnsResponse, error)
}

// Client is an HTTP client for the Python intelligence service.
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient creates a new intelligence service client pointing at the given base URL.
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ScoreColumns calls POST /intelligence/score-columns on the Python service.
func (c *Client) ScoreColumns(ctx context.Context, req ScoreColumnsRequest) (*ScoreColumnsResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := c.BaseURL + "/intelligence/score-columns"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("intelligence service call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("intelligence service returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result ScoreColumnsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// --- Mismatch Analysis Types ---

// MismatchRecord describes a single member's reconciliation variance,
// sent to the intelligence service for pattern detection.
type MismatchRecord struct {
	MemberID        string  `json:"member_id"`
	VarianceAmount  string  `json:"variance_amount"`
	VariancePct     float64 `json:"variance_pct"`
	SuspectedDomain string  `json:"suspected_domain"`
	MemberStatus    string  `json:"member_status"`
	PlanCode        string  `json:"plan_code"`
	Category        string  `json:"category"`
}

// FieldMappingRecord describes a source->canonical field mapping for context.
type FieldMappingRecord struct {
	SourceField    string `json:"source_field"`
	CanonicalField string `json:"canonical_field"`
	Domain         string `json:"domain"`
	TransformType  string `json:"transform_type"`
}

// AnalyzeMismatchesRequest is the request body for POST /intelligence/analyze-mismatches.
type AnalyzeMismatchesRequest struct {
	TenantID              string               `json:"tenant_id"`
	ReconciliationResults []MismatchRecord     `json:"reconciliation_results"`
	FieldMappings         []FieldMappingRecord `json:"field_mappings"`
}

// DetectedPattern describes a systematic variance cluster found by the intelligence service.
type DetectedPattern struct {
	PatternID       string   `json:"pattern_id"`
	SuspectedDomain string   `json:"suspected_domain"`
	PlanCode        string   `json:"plan_code"`
	Direction       string   `json:"direction"`
	MemberCount     int      `json:"member_count"`
	MeanVariance    string   `json:"mean_variance"`
	CV              float64  `json:"cv"`
	AffectedMembers []string `json:"affected_members"`
}

// CorrectionSuggestion describes a proposed fix for a detected pattern.
type CorrectionSuggestion struct {
	CorrectionType      string  `json:"correction_type"`
	AffectedField       string  `json:"affected_field"`
	CurrentMapping      string  `json:"current_mapping"`
	ProposedMapping     string  `json:"proposed_mapping"`
	Confidence          float64 `json:"confidence"`
	Evidence            string  `json:"evidence"`
	AffectedMemberCount int     `json:"affected_member_count"`
}

// AnalyzeMismatchesResponse is the response from POST /intelligence/analyze-mismatches.
type AnalyzeMismatchesResponse struct {
	Patterns    []DetectedPattern      `json:"patterns"`
	Suggestions []CorrectionSuggestion `json:"suggestions"`
}

// Analyzer defines the interface for mismatch pattern analysis.
type Analyzer interface {
	AnalyzeMismatches(ctx context.Context, req AnalyzeMismatchesRequest) (*AnalyzeMismatchesResponse, error)
}

// AnalyzeMismatches calls POST /intelligence/analyze-mismatches on the Python service.
func (c *Client) AnalyzeMismatches(ctx context.Context, req AnalyzeMismatchesRequest) (*AnalyzeMismatchesResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := c.BaseURL + "/intelligence/analyze-mismatches"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("intelligence service call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("intelligence service returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result AnalyzeMismatchesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}
