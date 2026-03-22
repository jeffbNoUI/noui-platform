package api

import (
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
)

// HandleGetNotifications handles GET /api/v1/migration/notifications.
func (h *Handler) HandleGetNotifications(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	notifs, err := migrationdb.ListNotifications(h.DB, tid)
	if err != nil {
		slog.Error("failed to list notifications", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list notifications")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", notifs)
}

// HandleMarkNotificationRead handles PUT /api/v1/migration/notifications/{id}/read.
func (h *Handler) HandleMarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "notification id is required")
		return
	}

	if err := migrationdb.MarkNotificationRead(h.DB, id); err != nil {
		slog.Error("failed to mark notification read", "error", err, "notification_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to mark notification read")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]string{"marked_read": id})
}

// HandleMarkAllNotificationsRead handles PUT /api/v1/migration/notifications/read-all.
func (h *Handler) HandleMarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)

	if err := migrationdb.MarkAllNotificationsRead(h.DB, tid); err != nil {
		slog.Error("failed to mark all notifications read", "error", err, "tenant_id", tid)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to mark all notifications read")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]string{"status": "all_marked_read"})
}
