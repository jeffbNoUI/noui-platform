package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/intelligence"
	"github.com/noui/platform/migration/mapper"
)

// --- Request / Response types ---

// GenerateMappingsRequest is the JSON body for POST .../generate-mappings.
type GenerateMappingsRequest struct {
	Tables []GenerateMappingsTable `json:"tables"`
}

// GenerateMappingsTable describes one concept-tagged source table.
type GenerateMappingsTable struct {
	SourceTable string                   `json:"source_table"`
	ConceptTag  string                   `json:"concept_tag"`
	Columns     []GenerateMappingsColumn `json:"columns"`
}

// GenerateMappingsColumn describes one source column in the request.
type GenerateMappingsColumn struct {
	Name       string `json:"name"`
	DataType   string `json:"data_type"`
	IsNullable bool   `json:"is_nullable"`
	IsKey      bool   `json:"is_key"`
}

// GenerateMappingsSummary is the response for generate-mappings.
type GenerateMappingsSummary struct {
	TotalColumns int `json:"total_columns"`
	Agreed       int `json:"agreed"`
	Disagreed    int `json:"disagreed"`
	TemplateOnly int `json:"template_only"`
	SignalOnly   int `json:"signal_only"`
	AutoApproved int `json:"auto_approved"`
}

// FieldMapping represents a stored field mapping record.
type FieldMapping struct {
	MappingID          string     `json:"mapping_id"`
	EngagementID       string     `json:"engagement_id"`
	MappingVersion     string     `json:"mapping_version"`
	SourceTable        string     `json:"source_table"`
	SourceColumn       string     `json:"source_column"`
	CanonicalTable     string     `json:"canonical_table"`
	CanonicalColumn    string     `json:"canonical_column"`
	TemplateConfidence *float64   `json:"template_confidence"`
	SignalConfidence   *float64   `json:"signal_confidence"`
	AgreementStatus    string     `json:"agreement_status"`
	ApprovalStatus     string     `json:"approval_status"`
	ApprovedBy         *string    `json:"approved_by"`
	ApprovedAt         *time.Time `json:"approved_at"`
}

// UpdateMappingRequest is the JSON body for PUT .../mappings/{mapping_id}.
type UpdateMappingRequest struct {
	ApprovalStatus string `json:"approval_status"`
	ApprovedBy     string `json:"approved_by"`
}

// --- Handlers ---

// GenerateMappings handles POST /api/v1/migration/engagements/{id}/generate-mappings.
func (h *Handler) GenerateMappings(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// 1. Validate engagement exists and quality baseline is approved.
	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}
	if engagement.QualityBaselineApprovedAt == nil {
		apiresponse.WriteError(w, http.StatusConflict, "migration", "QUALITY_GATE_FAILED",
			"quality baseline must be approved before generating mappings")
		return
	}

	// 2. Parse request body.
	var req GenerateMappingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}
	if len(req.Tables) == 0 {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "at least one table is required")
		return
	}

	registry := mapper.NewRegistry()
	tid := tenantID(r)

	var allResults []mapper.AgreementResult
	var allCanonicalTables []string // parallel slice: canonical table per result

	for _, tbl := range req.Tables {
		// 3a. Look up template.
		template, ok := registry.Get(tbl.ConceptTag)
		if !ok {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "UNKNOWN_CONCEPT_TAG",
				fmt.Sprintf("unknown concept tag: %s", tbl.ConceptTag))
			return
		}

		// Convert request columns to mapper.SourceColumn for template matching.
		sourceCols := make([]mapper.SourceColumn, len(tbl.Columns))
		for i, c := range tbl.Columns {
			sourceCols[i] = mapper.SourceColumn{
				Name:       c.Name,
				DataType:   c.DataType,
				IsNullable: c.IsNullable,
				IsKey:      c.IsKey,
			}
		}

		// 3b. Run local template matching.
		templateMatches := mapper.MatchColumns(sourceCols, template)

		// 3c. Call intelligence service for signal scoring.
		var signalMatches []mapper.ScoredMapping
		if h.IntelClient != nil {
			intelCols := make([]intelligence.ColumnInfo, len(tbl.Columns))
			for i, c := range tbl.Columns {
				intelCols[i] = intelligence.ColumnInfo{
					ColumnName:  c.Name,
					DataType:    c.DataType,
					NullRate:    0.0, // not available in request; default to 0
					Cardinality: 0,
					RowCount:    0,
				}
			}

			intelResp, err := h.IntelClient.ScoreColumns(r.Context(), intelligence.ScoreColumnsRequest{
				Columns:        intelCols,
				ConceptTag:     tbl.ConceptTag,
				CanonicalTable: template.CanonicalTable,
				TenantID:       tid,
			})
			if err != nil {
				slog.Warn("intelligence service call failed, proceeding with template-only",
					"error", err, "table", tbl.SourceTable, "engagement_id", id)
			} else {
				for _, m := range intelResp.Mappings {
					signalMatches = append(signalMatches, mapper.ScoredMapping{
						SourceColumn:    m.SourceColumn,
						CanonicalColumn: m.CanonicalColumn,
						Confidence:      m.Confidence,
						Signals:         m.Signals,
					})
				}
			}
		}

		// 3d. Run agreement analysis.
		results := mapper.AnalyzeTableMappings(templateMatches, signalMatches)

		for range results {
			allCanonicalTables = append(allCanonicalTables, template.CanonicalTable)
		}
		allResults = append(allResults, results...)

		// 4. Store proposed mappings in migration.field_mapping.
		for i, res := range results {
			_ = i
			approvalStatus := "PROPOSED"
			if res.AutoApproved {
				approvalStatus = "APPROVED"
			}

			var tmplConf, sigConf *float64
			if res.TemplateConfidence > 0 {
				v := res.TemplateConfidence
				tmplConf = &v
			}
			if res.SignalConfidence > 0 {
				v := res.SignalConfidence
				sigConf = &v
			}

			_, err := h.DB.Exec(
				`INSERT INTO migration.field_mapping
				 (engagement_id, source_table, source_column, canonical_table, canonical_column,
				  template_confidence, signal_confidence, agreement_status, approval_status)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				id, tbl.SourceTable, res.SourceColumn, template.CanonicalTable, res.CanonicalColumn,
				tmplConf, sigConf, string(res.AgreementStatus), approvalStatus,
			)
			if err != nil {
				slog.Error("failed to insert field mapping", "error", err,
					"engagement_id", id, "source_column", res.SourceColumn)
				apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR",
					"failed to store field mapping")
				return
			}
		}
	}

	// 5. Return summary.
	summary := mapper.Summarize(allResults)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", GenerateMappingsSummary{
		TotalColumns: summary.TotalColumns,
		Agreed:       summary.Agreed,
		Disagreed:    summary.Disagreed,
		TemplateOnly: summary.TemplateOnly,
		SignalOnly:   summary.SignalOnly,
		AutoApproved: summary.AutoApproved,
	})
}

// ListMappings handles GET /api/v1/migration/engagements/{id}/mappings.
// Supports ?status=AGREED and ?approval=PROPOSED query filters.
func (h *Handler) ListMappings(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// Build query with optional filters.
	query := `SELECT mapping_id, engagement_id, mapping_version, source_table, source_column,
	                 canonical_table, canonical_column, template_confidence, signal_confidence,
	                 agreement_status, approval_status, approved_by, approved_at
	          FROM migration.field_mapping
	          WHERE engagement_id = $1`
	args := []any{id}
	argIdx := 2

	if status := r.URL.Query().Get("status"); status != "" {
		query += fmt.Sprintf(" AND agreement_status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if approval := r.URL.Query().Get("approval"); approval != "" {
		query += fmt.Sprintf(" AND approval_status = $%d", argIdx)
		args = append(args, approval)
		argIdx++
	}

	query += " ORDER BY source_table, source_column"

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		slog.Error("failed to list mappings", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list mappings")
		return
	}
	defer rows.Close()

	var mappings []FieldMapping
	for rows.Next() {
		var m FieldMapping
		if err := rows.Scan(
			&m.MappingID, &m.EngagementID, &m.MappingVersion,
			&m.SourceTable, &m.SourceColumn,
			&m.CanonicalTable, &m.CanonicalColumn,
			&m.TemplateConfidence, &m.SignalConfidence,
			&m.AgreementStatus, &m.ApprovalStatus,
			&m.ApprovedBy, &m.ApprovedAt,
		); err != nil {
			slog.Error("failed to scan mapping", "error", err)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to read mapping")
			return
		}
		mappings = append(mappings, m)
	}
	if err := rows.Err(); err != nil {
		slog.Error("failed to iterate mappings", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list mappings")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", mappings)
}

// UpdateMapping handles PUT /api/v1/migration/engagements/{id}/mappings/{mapping_id}.
func (h *Handler) UpdateMapping(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	mappingID := r.PathValue("mapping_id")
	if id == "" || mappingID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and mapping id are required")
		return
	}

	var req UpdateMappingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	if req.ApprovalStatus != "APPROVED" && req.ApprovalStatus != "REJECTED" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
			"approval_status must be APPROVED or REJECTED")
		return
	}

	var m FieldMapping
	var approvedAt *time.Time
	var approvedBy *string
	if req.ApprovalStatus == "APPROVED" {
		now := time.Now().UTC()
		approvedAt = &now
		approvedBy = &req.ApprovedBy
	}

	err := h.DB.QueryRow(
		`UPDATE migration.field_mapping
		 SET approval_status = $1, approved_by = $2, approved_at = $3
		 WHERE mapping_id = $4 AND engagement_id = $5
		 RETURNING mapping_id, engagement_id, mapping_version, source_table, source_column,
		           canonical_table, canonical_column, template_confidence, signal_confidence,
		           agreement_status, approval_status, approved_by, approved_at`,
		req.ApprovalStatus, approvedBy, approvedAt, mappingID, id,
	).Scan(
		&m.MappingID, &m.EngagementID, &m.MappingVersion,
		&m.SourceTable, &m.SourceColumn,
		&m.CanonicalTable, &m.CanonicalColumn,
		&m.TemplateConfidence, &m.SignalConfidence,
		&m.AgreementStatus, &m.ApprovalStatus,
		&m.ApprovedBy, &m.ApprovedAt,
	)
	if err != nil {
		slog.Error("failed to update mapping", "error", err, "mapping_id", mappingID, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND",
			fmt.Sprintf("mapping %s not found in engagement %s", mappingID, id))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", m)
}
