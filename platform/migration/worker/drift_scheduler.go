package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
)

// DriftSchedulerLoop polls drift_schedule every pollInterval for due schedules,
// creates drift detection runs, and enqueues drift_detection jobs.
// Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent duplicate triggers.
// Respects context cancellation for graceful shutdown.
func DriftSchedulerLoop(ctx context.Context, database *sql.DB, jq *jobqueue.Queue, pollInterval time.Duration) {
	slog.Info("drift scheduler loop started", "poll_interval", pollInterval)
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("drift scheduler loop stopping")
			return
		case <-ticker.C:
			processDueSchedules(ctx, database, jq)
		}
	}
}

// processDueSchedules claims due schedules and enqueues drift detection jobs.
func processDueSchedules(ctx context.Context, database *sql.DB, jq *jobqueue.Queue) {
	schedules, err := db.ClaimDueSchedules(database)
	if err != nil {
		slog.Error("drift scheduler: failed to claim due schedules", "error", err)
		return
	}

	if len(schedules) == 0 {
		return
	}

	slog.Info("drift scheduler: processing due schedules", "count", len(schedules))

	for _, s := range schedules {
		// Get active schema version for baseline.
		// Need to look up tenant_id from engagement.
		engagement, err := db.GetEngagement(database, s.EngagementID)
		if err != nil || engagement == nil {
			slog.Warn("drift scheduler: engagement not found, skipping",
				"engagement_id", s.EngagementID, "error", err)
			continue
		}

		baselineID, err := db.GetActiveSchemaVersionID(database, engagement.TenantID)
		if err != nil {
			slog.Warn("drift scheduler: no active schema version, skipping",
				"engagement_id", s.EngagementID, "error", err)
			continue
		}

		// Create drift detection run (BOTH type for scheduled runs).
		run, err := db.CreateDriftDetectionRun(database, s.EngagementID, models.DriftTypeBoth, baselineID)
		if err != nil {
			slog.Error("drift scheduler: failed to create drift run",
				"engagement_id", s.EngagementID, "error", err)
			continue
		}

		// Enqueue drift_detection job.
		input, _ := json.Marshal(DriftDetectionInput{
			RunID:        run.RunID,
			EngagementID: s.EngagementID,
			DriftType:    string(models.DriftTypeBoth),
			BaselineID:   baselineID,
		})
		_, err = jq.Enqueue(ctx, jobqueue.EnqueueParams{
			EngagementID: s.EngagementID,
			JobType:      JobTypeDriftDetection,
			Scope:        "drift_detection_scheduled",
			InputJSON:    json.RawMessage(input),
		})
		if err != nil {
			slog.Error("drift scheduler: failed to enqueue drift detection job",
				"engagement_id", s.EngagementID, "run_id", run.RunID, "error", err)
			continue
		}

		slog.Info("drift scheduler: triggered drift detection",
			"engagement_id", s.EngagementID,
			"run_id", run.RunID,
			"schedule_id", s.ScheduleID,
		)
	}
}
