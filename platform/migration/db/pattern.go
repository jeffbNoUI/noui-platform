package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// PersistPatterns stores intelligence-detected patterns for a batch.
// It replaces any prior patterns for the same batch within a transaction.
func PersistPatterns(tx *sql.Tx, batchID string, patterns []models.ReconciliationPattern) error {
	if _, err := tx.Exec(`DELETE FROM migration.reconciliation_pattern WHERE batch_id = $1`, batchID); err != nil {
		return fmt.Errorf("clear prior patterns: %w", err)
	}

	const insertSQL = `INSERT INTO migration.reconciliation_pattern
		(batch_id, suspected_domain, plan_code, direction, member_count,
		 mean_variance, coefficient_of_var, affected_members,
		 correction_type, affected_field, confidence, evidence)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)`

	for _, p := range patterns {
		membersJSON, err := json.Marshal(p.AffectedMembers)
		if err != nil {
			return fmt.Errorf("marshal affected_members: %w", err)
		}
		if _, err := tx.Exec(insertSQL,
			batchID,
			p.SuspectedDomain,
			p.PlanCode,
			p.Direction,
			p.MemberCount,
			p.MeanVariance,
			p.CoefficientOfVar,
			string(membersJSON),
			p.CorrectionType,
			p.AffectedField,
			p.Confidence,
			p.Evidence,
		); err != nil {
			return fmt.Errorf("insert pattern %s: %w", p.SuspectedDomain, err)
		}
	}

	return nil
}

// GetPatternsByEngagement returns all reconciliation patterns for an
// engagement's latest batch.
func GetPatternsByEngagement(db *sql.DB, engagementID string) ([]models.ReconciliationPattern, error) {
	rows, err := db.Query(`
		SELECT p.pattern_id, p.batch_id, p.suspected_domain, p.plan_code,
		       p.direction, p.member_count, p.mean_variance, p.coefficient_of_var,
		       p.affected_members, p.correction_type, p.affected_field,
		       p.confidence, p.evidence, p.resolved, p.resolved_at, p.created_at
		FROM migration.reconciliation_pattern p
		JOIN migration.batch b ON b.batch_id = p.batch_id
		WHERE b.engagement_id = $1
		ORDER BY p.member_count DESC, p.suspected_domain`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("query patterns: %w", err)
	}
	defer rows.Close()

	var patterns []models.ReconciliationPattern
	for rows.Next() {
		var p models.ReconciliationPattern
		var membersJSON []byte
		var resolvedAt *string
		if err := rows.Scan(
			&p.PatternID, &p.BatchID, &p.SuspectedDomain, &p.PlanCode,
			&p.Direction, &p.MemberCount, &p.MeanVariance, &p.CoefficientOfVar,
			&membersJSON, &p.CorrectionType, &p.AffectedField,
			&p.Confidence, &p.Evidence, &p.Resolved, &resolvedAt, &p.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan pattern: %w", err)
		}
		if err := json.Unmarshal(membersJSON, &p.AffectedMembers); err != nil {
			p.AffectedMembers = []string{}
		}
		p.ResolvedAt = resolvedAt
		patterns = append(patterns, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("pattern rows: %w", err)
	}
	return patterns, nil
}

// ResolvePattern marks a pattern as resolved by the given user.
func ResolvePattern(db *sql.DB, patternID, userID string) (*models.ReconciliationPattern, error) {
	var p models.ReconciliationPattern
	var membersJSON []byte
	var resolvedAt *string
	err := db.QueryRow(`
		UPDATE migration.reconciliation_pattern
		SET resolved = TRUE, resolved_at = NOW(), resolved_by = $2
		WHERE pattern_id = $1
		RETURNING pattern_id, batch_id, suspected_domain, plan_code,
		          direction, member_count, mean_variance, coefficient_of_var,
		          affected_members, correction_type, affected_field,
		          confidence, evidence, resolved, resolved_at, created_at`,
		patternID, userID,
	).Scan(
		&p.PatternID, &p.BatchID, &p.SuspectedDomain, &p.PlanCode,
		&p.Direction, &p.MemberCount, &p.MeanVariance, &p.CoefficientOfVar,
		&membersJSON, &p.CorrectionType, &p.AffectedField,
		&p.Confidence, &p.Evidence, &p.Resolved, &resolvedAt, &p.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("resolve pattern: %w", err)
	}
	if err := json.Unmarshal(membersJSON, &p.AffectedMembers); err != nil {
		p.AffectedMembers = []string{}
	}
	p.ResolvedAt = resolvedAt
	return &p, nil
}
