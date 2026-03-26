package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// reconRuleSetColumns is the standard column list for recon_rule_set queries.
const reconRuleSetColumns = `ruleset_id, engagement_id, version, label, status, rules, created_by, created_at, activated_at, superseded_at`

// scanReconRuleSet scans a recon_rule_set row into a ReconRuleSet model.
func scanReconRuleSet(scanner interface{ Scan(...any) error }) (*models.ReconRuleSet, error) {
	var rs models.ReconRuleSet
	var rulesRaw []byte
	err := scanner.Scan(
		&rs.RulesetID, &rs.EngagementID, &rs.Version, &rs.Label,
		&rs.Status, &rulesRaw, &rs.CreatedBy, &rs.CreatedAt,
		&rs.ActivatedAt, &rs.SupersededAt,
	)
	if err != nil {
		return nil, err
	}
	if len(rulesRaw) > 0 {
		if err := json.Unmarshal(rulesRaw, &rs.Rules); err != nil {
			return nil, fmt.Errorf("unmarshal rules: %w", err)
		}
	}
	if rs.Rules == nil {
		rs.Rules = []models.ReconRule{}
	}
	return &rs, nil
}

// CreateReconRuleSet inserts a new reconciliation rule set in DRAFT status.
// Version is auto-assigned as MAX(version) + 1 for the engagement (or 1 if first).
func CreateReconRuleSet(db *sql.DB, engagementID, label, createdBy string, rules []models.ReconRule) (*models.ReconRuleSet, error) {
	rulesJSON, err := json.Marshal(rules)
	if err != nil {
		return nil, fmt.Errorf("marshal rules: %w", err)
	}

	row := db.QueryRow(
		`INSERT INTO migration.recon_rule_set (engagement_id, version, label, rules, created_by)
		 VALUES (
		   $1,
		   COALESCE((SELECT MAX(version) FROM migration.recon_rule_set WHERE engagement_id = $1), 0) + 1,
		   $2,
		   $3::jsonb,
		   $4
		 )
		 RETURNING `+reconRuleSetColumns,
		engagementID, label, string(rulesJSON), createdBy,
	)

	return scanReconRuleSet(row)
}

// ListReconRuleSets returns all rule sets for an engagement, newest version first.
// Optionally filter by status.
func ListReconRuleSets(db *sql.DB, engagementID string, status *string) ([]models.ReconRuleSet, error) {
	var query string
	var args []interface{}

	if status != nil {
		query = `SELECT ` + reconRuleSetColumns + `
		         FROM migration.recon_rule_set
		         WHERE engagement_id = $1 AND status = $2
		         ORDER BY version DESC`
		args = []interface{}{engagementID, *status}
	} else {
		query = `SELECT ` + reconRuleSetColumns + `
		         FROM migration.recon_rule_set
		         WHERE engagement_id = $1
		         ORDER BY version DESC`
		args = []interface{}{engagementID}
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list recon rule sets: %w", err)
	}
	defer rows.Close()

	var results []models.ReconRuleSet
	for rows.Next() {
		rs, err := scanReconRuleSet(rows)
		if err != nil {
			return nil, fmt.Errorf("scan recon rule set: %w", err)
		}
		results = append(results, *rs)
	}
	return results, rows.Err()
}

// GetReconRuleSet retrieves a single rule set by ID.
func GetReconRuleSet(db *sql.DB, rulesetID string) (*models.ReconRuleSet, error) {
	row := db.QueryRow(
		`SELECT `+reconRuleSetColumns+`
		 FROM migration.recon_rule_set
		 WHERE ruleset_id = $1`,
		rulesetID,
	)
	rs, err := scanReconRuleSet(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get recon rule set: %w", err)
	}
	return rs, nil
}

// GetActiveReconRuleSet retrieves the currently ACTIVE rule set for an engagement.
// Returns nil if none is active.
func GetActiveReconRuleSet(db *sql.DB, engagementID string) (*models.ReconRuleSet, error) {
	row := db.QueryRow(
		`SELECT `+reconRuleSetColumns+`
		 FROM migration.recon_rule_set
		 WHERE engagement_id = $1 AND status = 'ACTIVE'`,
		engagementID,
	)
	rs, err := scanReconRuleSet(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get active recon rule set: %w", err)
	}
	return rs, nil
}

// UpdateReconRuleSet updates label and/or rules on a DRAFT rule set.
// Returns nil if not found. Returns an error containing "not DRAFT" if the ruleset is not in DRAFT status.
func UpdateReconRuleSet(db *sql.DB, rulesetID string, label *string, rules *[]models.ReconRule) (*models.ReconRuleSet, error) {
	// First check current status.
	current, err := GetReconRuleSet(db, rulesetID)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, nil
	}
	if current.Status != models.ReconRuleSetDraft {
		return nil, fmt.Errorf("ruleset %s is not DRAFT (status: %s)", rulesetID, current.Status)
	}

	newLabel := current.Label
	if label != nil {
		newLabel = *label
	}

	newRules := current.Rules
	if rules != nil {
		newRules = *rules
	}

	rulesJSON, err := json.Marshal(newRules)
	if err != nil {
		return nil, fmt.Errorf("marshal rules: %w", err)
	}

	row := db.QueryRow(
		`UPDATE migration.recon_rule_set
		 SET label = $2, rules = $3::jsonb
		 WHERE ruleset_id = $1
		 RETURNING `+reconRuleSetColumns,
		rulesetID, newLabel, string(rulesJSON),
	)
	return scanReconRuleSet(row)
}

// ActivateReconRuleSet transitions a DRAFT rule set to ACTIVE.
// If another rule set is ACTIVE, it is transitioned to SUPERSEDED in the same transaction.
// Returns the activated rule set, or an error if the target is not DRAFT.
func ActivateReconRuleSet(db *sql.DB, engagementID, rulesetID string) (*models.ReconRuleSet, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Check that the target exists and is DRAFT.
	var currentStatus string
	err = tx.QueryRow(
		`SELECT status FROM migration.recon_rule_set WHERE ruleset_id = $1 AND engagement_id = $2`,
		rulesetID, engagementID,
	).Scan(&currentStatus)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("check ruleset status: %w", err)
	}
	if currentStatus != string(models.ReconRuleSetDraft) {
		return nil, fmt.Errorf("ruleset %s is not DRAFT (status: %s)", rulesetID, currentStatus)
	}

	// Supersede the currently active ruleset (if any).
	_, err = tx.Exec(
		`UPDATE migration.recon_rule_set
		 SET status = 'SUPERSEDED', superseded_at = now()
		 WHERE engagement_id = $1 AND status = 'ACTIVE'`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("supersede current active: %w", err)
	}

	// Activate the target.
	row := tx.QueryRow(
		`UPDATE migration.recon_rule_set
		 SET status = 'ACTIVE', activated_at = now()
		 WHERE ruleset_id = $1
		 RETURNING `+reconRuleSetColumns,
		rulesetID,
	)
	result, err := scanReconRuleSet(row)
	if err != nil {
		return nil, fmt.Errorf("activate ruleset: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return result, nil
}

// ArchiveReconRuleSet transitions a SUPERSEDED rule set to ARCHIVED.
// Returns nil if not found. Returns an error containing "not SUPERSEDED" if the status is wrong.
func ArchiveReconRuleSet(db *sql.DB, rulesetID string) (*models.ReconRuleSet, error) {
	current, err := GetReconRuleSet(db, rulesetID)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, nil
	}
	if current.Status != models.ReconRuleSetSuperseded {
		return nil, fmt.Errorf("ruleset %s is not SUPERSEDED (status: %s)", rulesetID, current.Status)
	}

	row := db.QueryRow(
		`UPDATE migration.recon_rule_set
		 SET status = 'ARCHIVED'
		 WHERE ruleset_id = $1
		 RETURNING `+reconRuleSetColumns,
		rulesetID,
	)
	return scanReconRuleSet(row)
}
