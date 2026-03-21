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
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("intelligence service returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result ScoreColumnsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}
