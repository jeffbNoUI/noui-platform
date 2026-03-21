package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/profiler"
)

// ProfileRequest is the JSON body for triggering a quality profile.
type ProfileRequest struct {
	Tables []profiler.ProfileConfig `json:"tables"`
}

// ProfileEngagement handles POST /api/v1/migration/engagements/{id}/profile.
// It runs the ISO 8000 six-dimension quality profiler against the specified
// source tables and persists results to migration.quality_profile.
func (h *Handler) ProfileEngagement(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	// Verify the engagement exists
	engagement, err := migrationdb.GetEngagement(h.DB, id)
	if err != nil {
		slog.Error("failed to get engagement for profiling", "error", err, "engagement_id", id)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
		return
	}
	if engagement == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("engagement %s not found", id))
		return
	}

	var req ProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}
	if len(req.Tables) == 0 {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "at least one table configuration is required")
		return
	}

	var profiles []*profiler.TableProfile
	for _, cfg := range req.Tables {
		profile, err := profiler.ProfileTable(h.DB, cfg)
		if err != nil {
			slog.Error("failed to profile table", "error", err, "table", cfg.TableName, "engagement_id", id)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "PROFILE_ERROR",
				fmt.Sprintf("failed to profile table %s", cfg.TableName))
			return
		}

		if err := profiler.SaveProfile(h.DB, id, profile); err != nil {
			slog.Error("failed to save profile", "error", err, "table", cfg.TableName, "engagement_id", id)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR",
				fmt.Sprintf("failed to save profile for table %s", cfg.TableName))
			return
		}

		profiles = append(profiles, profile)
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", profiles)
}
