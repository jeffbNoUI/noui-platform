package api

import (
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// DashboardSummary handles GET /api/v1/migration/dashboard/summary.
func (h *Handler) DashboardSummary(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	summary, err := migrationdb.GetDashboardSummary(h.DB, tid)
	if err != nil {
		slog.Error("failed to get dashboard summary", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get dashboard summary")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", summary)
}

// SystemHealth handles GET /api/v1/migration/dashboard/system-health.
func (h *Handler) SystemHealth(w http.ResponseWriter, r *http.Request) {
	status := migrationdb.GetSystemHealth(h.DB)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", status)
}
