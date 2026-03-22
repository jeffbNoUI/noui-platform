package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// CreateGateTransition inserts a phase gate transition audit record.
func CreateGateTransition(db *sql.DB, t models.PhaseGateTransition) (*models.PhaseGateTransition, error) {
	metricsJSON, _ := json.Marshal(t.GateMetrics)
	overridesJSON, _ := json.Marshal(t.Overrides)

	var result models.PhaseGateTransition
	var metricsRaw, overridesRaw []byte
	err := db.QueryRow(
		`INSERT INTO migration.gate_transition
		   (engagement_id, from_phase, to_phase, direction, gate_metrics, ai_recommendation, overrides, authorized_by, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, engagement_id, from_phase, to_phase, direction, gate_metrics,
		           ai_recommendation, overrides, authorized_by, authorized_at, notes`,
		t.EngagementID, t.FromPhase, t.ToPhase, t.Direction, metricsJSON, t.AIRecommendation, overridesJSON, t.AuthorizedBy, t.Notes,
	).Scan(
		&result.ID, &result.EngagementID, &result.FromPhase, &result.ToPhase,
		&result.Direction, &metricsRaw, &result.AIRecommendation, &overridesRaw,
		&result.AuthorizedBy, &result.AuthorizedAt, &result.Notes,
	)
	if err != nil {
		return nil, fmt.Errorf("create gate transition: %w", err)
	}
	json.Unmarshal(metricsRaw, &result.GateMetrics)
	json.Unmarshal(overridesRaw, &result.Overrides)
	return &result, nil
}

// ListGateTransitions returns all gate transitions for an engagement, newest first.
func ListGateTransitions(db *sql.DB, engagementID string) ([]models.PhaseGateTransition, error) {
	rows, err := db.Query(
		`SELECT id, engagement_id, from_phase, to_phase, direction, gate_metrics,
		        ai_recommendation, overrides, authorized_by, authorized_at, notes
		 FROM migration.gate_transition
		 WHERE engagement_id = $1
		 ORDER BY authorized_at DESC`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("list gate transitions: %w", err)
	}
	defer rows.Close()

	var transitions []models.PhaseGateTransition
	for rows.Next() {
		var t models.PhaseGateTransition
		var metricsRaw, overridesRaw []byte
		if err := rows.Scan(
			&t.ID, &t.EngagementID, &t.FromPhase, &t.ToPhase,
			&t.Direction, &metricsRaw, &t.AIRecommendation, &overridesRaw,
			&t.AuthorizedBy, &t.AuthorizedAt, &t.Notes,
		); err != nil {
			return nil, fmt.Errorf("scan gate transition: %w", err)
		}
		json.Unmarshal(metricsRaw, &t.GateMetrics)
		json.Unmarshal(overridesRaw, &t.Overrides)
		transitions = append(transitions, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list gate transitions rows: %w", err)
	}
	return transitions, nil
}

// GetGateMetrics computes current gate metrics for an engagement from existing data.
func GetGateMetrics(db *sql.DB, engagementID string) (map[string]float64, error) {
	metrics := make(map[string]float64)

	// Quality: min score across all profiled tables.
	var minQuality sql.NullFloat64
	var tableCount int
	_ = db.QueryRow(
		`SELECT LEAST(
			MIN(accuracy_score), MIN(completeness_score), MIN(consistency_score),
			MIN(timeliness_score), MIN(validity_score), MIN(uniqueness_score)
		), COUNT(*)
		FROM migration.quality_profile WHERE engagement_id = $1`,
		engagementID,
	).Scan(&minQuality, &tableCount)
	if minQuality.Valid {
		metrics["quality_min_score"] = minQuality.Float64
	}
	metrics["tables_profiled"] = float64(tableCount)

	// Mapping: agreed percentage.
	var agreed, total int
	_ = db.QueryRow(
		`SELECT COUNT(*) FILTER (WHERE agreement_status = 'AGREED'), COUNT(*)
		FROM migration.field_mapping WHERE engagement_id = $1`,
		engagementID,
	).Scan(&agreed, &total)
	if total > 0 {
		metrics["mapping_agreed_pct"] = float64(agreed) / float64(total)
	}
	metrics["mapping_total"] = float64(total)

	// Reconciliation: gate score and P1 count.
	var gateScore sql.NullFloat64
	var p1Count int
	_ = db.QueryRow(
		`SELECT
			CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE r.category = 'MATCH')::float / COUNT(*)::float ELSE 0 END,
			COUNT(*) FILTER (WHERE r.priority = 'P1')
		FROM migration.reconciliation r
		JOIN migration.batch b ON r.batch_id = b.batch_id
		WHERE b.engagement_id = $1`,
		engagementID,
	).Scan(&gateScore, &p1Count)
	if gateScore.Valid {
		metrics["recon_gate_score"] = gateScore.Float64
	}
	metrics["recon_p1_unresolved"] = float64(p1Count)

	return metrics, nil
}
