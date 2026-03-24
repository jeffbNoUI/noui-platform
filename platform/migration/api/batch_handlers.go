package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/migration/batch"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/transformer"
)

// ListBatches handles GET /api/v1/migration/engagements/{id}/batches.
func (h *Handler) ListBatches(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	batches, err := migrationdb.ListBatches(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to list batches", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list batches")
		return
	}

	if batches == nil {
		batches = []models.MigrationBatch{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", batches)
}

// GetBatch handles GET /api/v1/migration/batches/{id}.
func (h *Handler) GetBatch(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	batch, err := migrationdb.GetBatch(h.DB, batchID)
	if err != nil {
		slog.Error("failed to get batch", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get batch")
		return
	}
	if batch == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("batch %s not found", batchID))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", batch)
}

// CreateBatch handles POST /api/v1/migration/engagements/{id}/batches.
func (h *Handler) CreateBatch(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// Verify engagement exists.
	engagement, err := migrationdb.GetEngagement(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to get engagement for batch create", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to verify engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", engagementID))
		return
	}

	var req models.CreateBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	req.BatchScope = strings.TrimSpace(req.BatchScope)
	if req.BatchScope == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch_scope is required")
		return
	}

	req.MappingVersion = strings.TrimSpace(req.MappingVersion)
	if req.MappingVersion == "" {
		req.MappingVersion = "v1.0"
	}

	batch, err := migrationdb.CreateBatch(h.DB, engagementID, req.BatchScope, req.MappingVersion)
	if err != nil {
		slog.Error("failed to create batch", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create batch")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", batch)
}

// ListExceptions handles GET /api/v1/migration/batches/{id}/exceptions.
func (h *Handler) ListExceptions(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	exceptions, err := migrationdb.ListExceptions(h.DB, batchID)
	if err != nil {
		slog.Error("failed to list exceptions", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list exceptions")
		return
	}

	if exceptions == nil {
		exceptions = []models.MigrationException{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", exceptions)
}

// ExecuteBatchHandler handles POST /api/v1/migration/batches/{id}/execute.
// It starts batch execution asynchronously and returns 202 Accepted immediately.
func (h *Handler) ExecuteBatchHandler(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	// Get batch record.
	b, err := migrationdb.GetBatch(h.DB, batchID)
	if err != nil {
		slog.Error("failed to get batch for execute", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get batch")
		return
	}
	if b == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("batch %s not found", batchID))
		return
	}

	// Get engagement for source connection info.
	engagement, err := migrationdb.GetEngagement(h.DB, b.EngagementID)
	if err != nil {
		slog.Error("failed to get engagement for batch execute", "error", err, "engagement_id", b.EngagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", b.EngagementID))
		return
	}
	if engagement.SourceConnection == nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement has no source connection configured")
		return
	}

	// Build source DSN.
	dsn := migrationdb.BuildSourceDSN(engagement.SourceConnection)

	// Get field mappings for this engagement.
	mappings, err := queryFieldMappings(h.DB, engagement.EngagementID)
	if err != nil {
		slog.Error("failed to get field mappings for batch execute", "error", err, "engagement_id", engagement.EngagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get field mappings")
		return
	}

	// Determine source table from field mappings (authoritative), falling
	// back to hard-coded system name → table mapping.
	tableName := resolveSourceTable(engagement.SourceSystemName, b.BatchScope, mappings)
	keyColumn := resolvePrimaryKey(engagement.SourceSystemName, tableName, dsn)

	provider := &batch.DBSourceRowProvider{
		DSN:       dsn,
		TableName: tableName,
		KeyColumn: keyColumn,
	}

	// Build transformation pipeline and convert mappings.
	pipeline := transformer.DefaultPipeline()
	tmappings := toTransformerMappings(mappings)

	// Capture source info for reference data loading after batch execution.
	sourceSystem := engagement.SourceSystemName

	// Execute async.
	engID := b.EngagementID
	go func() {
		batchObj := &batch.Batch{
			BatchID:        b.BatchID,
			EngagementID:   engID,
			BatchScope:     b.BatchScope,
			MappingVersion: b.MappingVersion,
		}
		if err := batch.ExecuteBatch(h.DB, batchObj, provider, pipeline, tmappings, batch.DefaultThresholds(), nil); err != nil {
			slog.Error("batch execution failed", "error", err, "batch_id", batchID)
			h.broadcast(engID, "batch_failed", map[string]string{"batch_id": batchID, "error": err.Error()})
			return
		}
		// After successful batch execution, load source reference data
		// (stored calculations and payment history) for reconciliation.
		if err := batch.LoadSourceReferenceData(h.DB, batchID, sourceSystem, dsn); err != nil {
			slog.Error("source reference data load failed", "error", err, "batch_id", batchID)
		}
		h.broadcast(engID, "batch_completed", map[string]string{"batch_id": batchID, "status": "COMPLETED"})
	}()

	apiresponse.WriteSuccess(w, http.StatusAccepted, "migration", map[string]string{
		"batch_id": batchID,
		"status":   "RUNNING",
	})
}

// scopeCanonicalHints maps batch scopes to canonical table keywords that help
// identify the correct source table from field mappings.
var scopeCanonicalHints = map[string][]string{
	"ACTIVE_MEMBERS":  {"member"},
	"ALL_MEMBERS":     {"member"},
	"RETIREES":        {"member"},
	"SALARY_HISTORY":  {"sal", "salary"},
	"CONTRIBUTIONS":   {"contrib"},
	"BENEFICIARIES":   {"beneficiary"},
	"SERVICE_CREDITS": {"svc_credit", "service"},
	"BENEFIT_CALCS":   {"benefit_calc"},
}

// resolveSourceTable determines the schema-qualified source table for batch
// execution. It uses the batch scope to find the best-matching source table
// from field mappings, then falls back to hard-coded system name → table mapping.
func resolveSourceTable(sourceSystem, scope string, mappings []FieldMapping) string {
	// Primary: match scope to the correct source table via canonical hints.
	if len(mappings) > 0 {
		hints := scopeCanonicalHints[scope]

		// If we have hints for this scope, find a mapping whose source table
		// matches one of the hints (e.g., ACTIVE_MEMBERS → *member*).
		if len(hints) > 0 {
			for _, m := range mappings {
				if m.SourceTable == "" {
					continue
				}
				lower := strings.ToLower(m.SourceTable)
				for _, hint := range hints {
					if strings.Contains(lower, hint) {
						slog.Info("resolveSourceTable: scope-matched source_table",
							"table", m.SourceTable, "scope", scope, "hint", hint)
						return m.SourceTable
					}
				}
			}
		}

		// No scope hints or no match — use first non-empty mapping.
		for _, m := range mappings {
			if m.SourceTable != "" {
				slog.Info("resolveSourceTable: using first mapping source_table",
					"table", m.SourceTable, "scope", scope)
				return m.SourceTable
			}
		}
	}

	// Fallback: hard-coded system name → table mapping for known systems.
	switch sourceSystem {
	case "PRISM":
		return "src_prism.prism_member"
	case "PAS":
		return "src_pas.member"
	default:
		return scope
	}
}

// resolvePrimaryKey determines the primary key column for the source table.
// It queries the source DB's information_schema when possible, falling back
// to known system defaults and then to "id".
func resolvePrimaryKey(sourceSystem, tableName, dsn string) string {
	// Try to discover the PK from the source DB.
	if dsn != "" && tableName != "" {
		if pk := discoverPrimaryKey(dsn, tableName); pk != "" {
			return pk
		}
	}

	// Fallback: known system defaults.
	switch sourceSystem {
	case "PRISM":
		return "mbr_nbr"
	case "PAS":
		return "member_id"
	default:
		return "id"
	}
}

// discoverPrimaryKey queries the source DB for the primary key column of the
// given table. Returns empty string if discovery fails.
func discoverPrimaryKey(dsn, tableName string) string {
	// Parse schema.table if present.
	schema, table := "public", tableName
	if parts := strings.SplitN(tableName, ".", 2); len(parts) == 2 {
		schema, table = parts[0], parts[1]
	}

	driver := "postgres"
	if strings.HasPrefix(dsn, "sqlserver:") {
		driver = "sqlserver"
	}

	db, err := sql.Open(driver, dsn)
	if err != nil {
		slog.Warn("discoverPrimaryKey: open failed", "error", err)
		return ""
	}
	defer db.Close()

	var col string
	err = db.QueryRow(`
		SELECT kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
			ON tc.constraint_name = kcu.constraint_name
			AND tc.table_schema = kcu.table_schema
		WHERE tc.constraint_type = 'PRIMARY KEY'
			AND tc.table_schema = $1
			AND tc.table_name = $2
		ORDER BY kcu.ordinal_position
		LIMIT 1`, schema, table).Scan(&col)
	if err != nil {
		slog.Warn("discoverPrimaryKey: query failed", "error", err, "table", tableName)
		return ""
	}
	slog.Info("discoverPrimaryKey: discovered", "table", tableName, "column", col)
	return col
}

// queryFieldMappings loads field mappings for an engagement from the database.
func queryFieldMappings(db *sql.DB, engagementID string) ([]FieldMapping, error) {
	rows, err := db.Query(
		`SELECT mapping_id, engagement_id, mapping_version, source_table, source_column,
		        canonical_table, canonical_column, template_confidence, signal_confidence,
		        agreement_status, approval_status, approved_by, approved_at
		 FROM migration.field_mapping
		 WHERE engagement_id = $1
		 ORDER BY source_table, source_column`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("query field mappings: %w", err)
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
			return nil, fmt.Errorf("scan field mapping: %w", err)
		}
		mappings = append(mappings, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate field mappings: %w", err)
	}
	return mappings, nil
}

// toTransformerMappings converts API FieldMapping records to transformer.FieldMapping values.
func toTransformerMappings(mappings []FieldMapping) []transformer.FieldMapping {
	out := make([]transformer.FieldMapping, 0, len(mappings))
	for _, m := range mappings {
		out = append(out, transformer.FieldMapping{
			SourceColumn:    m.SourceColumn,
			CanonicalColumn: m.CanonicalColumn,
		})
	}
	return out
}
