package db

import (
	"github.com/noui/platform/casemanagement/models"
)

// GetCaseStats returns aggregated case metrics for a tenant's supervisor dashboard.
func (s *Store) GetCaseStats(tenantID string) (*models.CaseStats, error) {
	stats := &models.CaseStats{
		CaseloadByStage: []models.StageCaseCount{},
		CasesByStatus:   []models.StatusCount{},
		CasesByPriority: []models.PriorityCount{},
		CasesByAssignee: []models.AssigneeStats{},
	}

	// Query 1: Caseload by stage (active cases only)
	stageRows, err := s.DB.Query(
		`SELECT current_stage, current_stage_idx, COUNT(*)
		 FROM retirement_case
		 WHERE tenant_id = $1 AND status = 'active'
		 GROUP BY current_stage, current_stage_idx
		 ORDER BY current_stage_idx`, tenantID)
	if err != nil {
		return nil, err
	}
	defer stageRows.Close()
	for stageRows.Next() {
		var sc models.StageCaseCount
		if err := stageRows.Scan(&sc.Stage, &sc.StageIdx, &sc.Count); err != nil {
			return nil, err
		}
		stats.CaseloadByStage = append(stats.CaseloadByStage, sc)
	}
	if err := stageRows.Err(); err != nil {
		return nil, err
	}

	// Query 2: Cases by status
	statusRows, err := s.DB.Query(
		`SELECT status, COUNT(*)
		 FROM retirement_case
		 WHERE tenant_id = $1
		 GROUP BY status
		 ORDER BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	defer statusRows.Close()
	for statusRows.Next() {
		var sc models.StatusCount
		if err := statusRows.Scan(&sc.Status, &sc.Count); err != nil {
			return nil, err
		}
		stats.CasesByStatus = append(stats.CasesByStatus, sc)
	}
	if err := statusRows.Err(); err != nil {
		return nil, err
	}

	// Query 3: Cases by priority
	prioRows, err := s.DB.Query(
		`SELECT priority, COUNT(*)
		 FROM retirement_case
		 WHERE tenant_id = $1
		 GROUP BY priority
		 ORDER BY priority`, tenantID)
	if err != nil {
		return nil, err
	}
	defer prioRows.Close()
	for prioRows.Next() {
		var pc models.PriorityCount
		if err := prioRows.Scan(&pc.Priority, &pc.Count); err != nil {
			return nil, err
		}
		stats.CasesByPriority = append(stats.CasesByPriority, pc)
	}
	if err := prioRows.Err(); err != nil {
		return nil, err
	}

	// Query 4: Cases by assignee (active only)
	assigneeRows, err := s.DB.Query(
		`SELECT COALESCE(assigned_to, 'Unassigned'), COUNT(*), COALESCE(AVG(days_open), 0)
		 FROM retirement_case
		 WHERE tenant_id = $1 AND status = 'active'
		 GROUP BY assigned_to
		 ORDER BY count DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer assigneeRows.Close()
	for assigneeRows.Next() {
		var as models.AssigneeStats
		if err := assigneeRows.Scan(&as.AssignedTo, &as.Count, &as.AvgDaysOpen); err != nil {
			return nil, err
		}
		stats.CasesByAssignee = append(stats.CasesByAssignee, as)
	}
	if err := assigneeRows.Err(); err != nil {
		return nil, err
	}

	// Query 5: Summary counts
	err = s.DB.QueryRow(
		`SELECT
			COUNT(*) FILTER (WHERE status = 'active'),
			COUNT(*) FILTER (WHERE status = 'completed' AND updated_at >= DATE_TRUNC('month', NOW())),
			COUNT(*) FILTER (WHERE status = 'active' AND sla_deadline_at IS NOT NULL AND sla_deadline_at < NOW() + (sla_target_days * 0.20 || ' days')::INTERVAL)
		 FROM retirement_case
		 WHERE tenant_id = $1`, tenantID).
		Scan(&stats.TotalActive, &stats.CompletedMTD, &stats.AtRiskCount)
	if err != nil {
		return nil, err
	}

	return stats, nil
}

// GetSLAStats returns SLA health metrics for active cases in a tenant.
func (s *Store) GetSLAStats(tenantID string) (*models.SLAStats, error) {
	stats := &models.SLAStats{
		Thresholds: models.SLAThresholds{
			Urgent:   6,
			High:     12,
			Standard: 18,
		},
	}

	err := s.DB.QueryRow(
		`SELECT
			COUNT(*) FILTER (WHERE sla_deadline_at >= NOW() AND sla_deadline_at >= NOW() + (sla_target_days * 0.20 || ' days')::INTERVAL) AS on_track,
			COUNT(*) FILTER (WHERE sla_deadline_at >= NOW() AND sla_deadline_at < NOW() + (sla_target_days * 0.20 || ' days')::INTERVAL) AS at_risk,
			COUNT(*) FILTER (WHERE sla_deadline_at < NOW()) AS overdue,
			COALESCE(AVG(EXTRACT(EPOCH FROM NOW() - created_at) / 86400), 0) AS avg_processing_days
		 FROM retirement_case
		 WHERE tenant_id = $1 AND status = 'active'`, tenantID).
		Scan(&stats.OnTrack, &stats.AtRisk, &stats.Overdue, &stats.AvgProcessingDays)
	if err != nil {
		return nil, err
	}

	return stats, nil
}
