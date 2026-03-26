package api

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// HandleListAuditLog handles GET /api/v1/migration/engagements/{id}/audit-log.
// Returns paginated, filterable, read-only audit entries.
// Supports ?entity_type=, ?entity_id=, ?actor=, ?page=, ?per_page= query params.
func (h *Handler) HandleListAuditLog(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	filter := migrationdb.AuditLogFilter{
		Page:    1,
		PerPage: 50,
	}

	if v := r.URL.Query().Get("entity_type"); v != "" {
		filter.EntityType = &v
	}
	if v := r.URL.Query().Get("entity_id"); v != "" {
		filter.EntityID = &v
	}
	if v := r.URL.Query().Get("actor"); v != "" {
		filter.Actor = &v
	}
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			filter.Page = n
		}
	}
	if v := r.URL.Query().Get("per_page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			filter.PerPage = n
		}
	}

	result, err := migrationdb.ListAuditLog(h.DB, engagementID, filter)
	if err != nil {
		slog.Error("failed to list audit log", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list audit log")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// parseExportOptions extracts ExportOptions from query parameters.
func parseExportOptions(r *http.Request) (migrationdb.ExportOptions, error) {
	var opts migrationdb.ExportOptions

	if v := r.URL.Query().Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return opts, fmt.Errorf("invalid 'from' date: %w", err)
		}
		opts.From = &t
	}
	if v := r.URL.Query().Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return opts, fmt.Errorf("invalid 'to' date: %w", err)
		}
		opts.To = &t
	}
	if v := r.URL.Query().Get("entity_type"); v != "" {
		opts.EntityType = &v
	}
	if v := r.URL.Query().Get("actor"); v != "" {
		opts.Actor = &v
	}
	return opts, nil
}

// HandleExportAuditLog handles GET /api/v1/migration/engagements/{id}/audit-log/export.
// Streams the audit trail as CSV or JSON download.
// Query params: format=csv|json (required), from=, to=, entity_type=, actor=.
func (h *Handler) HandleExportAuditLog(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	format := r.URL.Query().Get("format")
	if format != "csv" && format != "json" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "format must be 'csv' or 'json'")
		return
	}

	// Verify engagement exists.
	engagement, err := migrationdb.GetEngagement(h.DB, engagementID)
	if err != nil {
		slog.Error("audit export: failed to get engagement", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", engagementID))
		return
	}

	opts, err := parseExportOptions(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", err.Error())
		return
	}

	// Large export guard: count first.
	count, err := migrationdb.CountAuditExport(h.DB, engagementID, opts)
	if err != nil {
		slog.Error("audit export: count failed", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to count audit entries")
		return
	}
	if count > migrationdb.MaxExportRows {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "EXPORT_TOO_LARGE",
			fmt.Sprintf("audit trail has %d entries (max %d); use date range filters (?from=&to=) to reduce scope",
				count, migrationdb.MaxExportRows))
		return
	}

	// Stream the export.
	rows, err := migrationdb.GetAuditExport(h.DB, engagementID, opts)
	if err != nil {
		slog.Error("audit export: query failed", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to query audit entries")
		return
	}
	defer rows.Close()

	// Sanitize filename.
	name := sanitizeFilename(engagement.SourceSystemName)
	date := time.Now().Format("2006-01-02")

	switch format {
	case "csv":
		h.streamAuditCSV(w, rows, name, date)
	case "json":
		h.streamAuditJSON(w, rows, name, date)
	}
}

// streamAuditCSV writes audit rows as CSV to the response.
func (h *Handler) streamAuditCSV(w http.ResponseWriter, rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}, name, date string) {
	filename := fmt.Sprintf("audit-log-%s-%s.csv", name, date)
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)

	cw := csv.NewWriter(w)
	// Write header row.
	_ = cw.Write([]string{"log_id", "actor", "action", "entity_type", "entity_id", "before_state", "after_state", "metadata", "created_at"})

	for rows.Next() {
		var logID, actor, action, entityType, entityID string
		var beforeState, afterState, metadata []byte
		var createdAt time.Time

		if err := rows.Scan(&logID, &actor, &action, &entityType, &entityID,
			&beforeState, &afterState, &metadata, &createdAt); err != nil {
			slog.Error("audit export csv: scan error", "error", err)
			break
		}

		_ = cw.Write([]string{
			logID, actor, action, entityType, entityID,
			string(beforeState), string(afterState), string(metadata),
			createdAt.Format(time.RFC3339),
		})
	}

	cw.Flush()
}

// auditExportEntry is the JSON structure for a single audit export row.
type auditExportEntry struct {
	LogID       string          `json:"log_id"`
	Actor       string          `json:"actor"`
	Action      string          `json:"action"`
	EntityType  string          `json:"entity_type"`
	EntityID    string          `json:"entity_id"`
	BeforeState json.RawMessage `json:"before_state"`
	AfterState  json.RawMessage `json:"after_state"`
	Metadata    json.RawMessage `json:"metadata"`
	CreatedAt   string          `json:"created_at"`
}

// streamAuditJSON writes audit rows as a JSON array to the response, streaming each entry.
func (h *Handler) streamAuditJSON(w http.ResponseWriter, rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}, name, date string) {
	filename := fmt.Sprintf("audit-log-%s-%s.json", name, date)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)

	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)

	// Write opening bracket.
	_, _ = w.Write([]byte("["))
	first := true

	for rows.Next() {
		var logID, actor, action, entityType, entityID string
		var beforeState, afterState, metadata []byte
		var createdAt time.Time

		if err := rows.Scan(&logID, &actor, &action, &entityType, &entityID,
			&beforeState, &afterState, &metadata, &createdAt); err != nil {
			slog.Error("audit export json: scan error", "error", err)
			break
		}

		if !first {
			_, _ = w.Write([]byte(","))
		}
		first = false

		entry := auditExportEntry{
			LogID:       logID,
			Actor:       actor,
			Action:      action,
			EntityType:  entityType,
			EntityID:    entityID,
			BeforeState: nullSafeJSON(beforeState),
			AfterState:  nullSafeJSON(afterState),
			Metadata:    nullSafeJSON(metadata),
			CreatedAt:   createdAt.Format(time.RFC3339),
		}
		_ = enc.Encode(entry)
	}

	_, _ = w.Write([]byte("]"))
}

// nullSafeJSON returns null JSON if the byte slice is nil or empty.
func nullSafeJSON(b []byte) json.RawMessage {
	if len(b) == 0 {
		return json.RawMessage("null")
	}
	return json.RawMessage(b)
}

// HandleGetRetentionPolicy handles GET /api/v1/migration/engagements/{id}/retention-policy.
func (h *Handler) HandleGetRetentionPolicy(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	policy, err := migrationdb.GetRetentionPolicy(h.DB, engagementID)
	if err != nil {
		slog.Error("get retention policy failed", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get retention policy")
		return
	}

	if policy == nil {
		apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]interface{}{
			"retention_policy": nil,
		})
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]interface{}{
		"retention_policy": policy,
	})
}

// HandleSetRetentionPolicy handles PATCH /api/v1/migration/engagements/{id}/retention-policy.
func (h *Handler) HandleSetRetentionPolicy(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req migrationdb.RetentionPolicy
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "invalid request body")
		return
	}

	if req.EventRetentionDays < migrationdb.MinRetentionDays || req.AuditLogRetentionDays < migrationdb.MinRetentionDays {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "VALIDATION_ERROR",
			fmt.Sprintf("retention periods must be >= %d days", migrationdb.MinRetentionDays))
		return
	}

	if err := migrationdb.SetRetentionPolicy(h.DB, engagementID, req); err != nil {
		slog.Error("set retention policy failed", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to set retention policy")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]interface{}{
		"retention_policy": req,
	})
}
