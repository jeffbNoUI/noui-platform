package profiler

import (
	"database/sql"
	"fmt"
)

// QualityDimension represents a single quality dimension score.
type QualityDimension struct {
	Name    string  `json:"name"`
	Score   float64 `json:"score"` // 0.0 to 1.0
	Details string  `json:"details"`
}

// TableProfile is the complete quality profile for a single source table.
type TableProfile struct {
	TableName        string             `json:"table_name"`
	RowCount         int                `json:"row_count"`
	Dimensions       []QualityDimension `json:"dimensions"`
	OverallScore     float64            `json:"overall_score"`
	DetectedPatterns []DetectedPattern  `json:"detected_patterns,omitempty"`
}

// ProfileConfig holds all the checks to run for a given table.
type ProfileConfig struct {
	TableName       string         `json:"table_name"`
	RequiredColumns []string       `json:"required_columns"`
	PatternChecks   []PatternCheck `json:"pattern_checks"`
	FKReferences    []FKReference  `json:"fk_references"`
	DateColumns     []string       `json:"date_columns"`
	BusinessRules   []BusinessRule `json:"business_rules"`
	KeyColumns      []string       `json:"key_columns"`
}

// ProfileTable runs all six ISO 8000 quality dimensions against a source table
// and returns the aggregate profile. The overall score is the arithmetic mean
// of all six dimension scores.
func ProfileTable(db *sql.DB, cfg ProfileConfig) (*TableProfile, error) {
	// Get row count — validate table name first
	quotedTable, err := QuoteIdent(cfg.TableName)
	if err != nil {
		return nil, fmt.Errorf("invalid table name %q: %w", cfg.TableName, err)
	}
	var rowCount int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", quotedTable)
	if err := db.QueryRow(query).Scan(&rowCount); err != nil {
		return nil, fmt.Errorf("count rows for %s: %w", cfg.TableName, err)
	}

	// Run all six dimensions
	completeness, err := ProfileCompleteness(db, cfg.TableName, cfg.RequiredColumns)
	if err != nil {
		return nil, fmt.Errorf("completeness: %w", err)
	}

	accuracy, err := ProfileAccuracy(db, cfg.TableName, cfg.PatternChecks)
	if err != nil {
		return nil, fmt.Errorf("accuracy: %w", err)
	}

	consistency, err := ProfileConsistency(db, cfg.TableName, cfg.FKReferences)
	if err != nil {
		return nil, fmt.Errorf("consistency: %w", err)
	}

	timeliness, err := ProfileTimeliness(db, cfg.TableName, cfg.DateColumns)
	if err != nil {
		return nil, fmt.Errorf("timeliness: %w", err)
	}

	validity, err := ProfileValidity(db, cfg.TableName, cfg.BusinessRules)
	if err != nil {
		return nil, fmt.Errorf("validity: %w", err)
	}

	uniqueness, err := ProfileUniqueness(db, cfg.TableName, cfg.KeyColumns)
	if err != nil {
		return nil, fmt.Errorf("uniqueness: %w", err)
	}

	dimensions := []QualityDimension{
		completeness,
		accuracy,
		consistency,
		timeliness,
		validity,
		uniqueness,
	}

	// Overall score is the arithmetic mean of all six dimensions
	var sum float64
	for _, d := range dimensions {
		sum += d.Score
	}
	overallScore := sum / float64(len(dimensions))

	// Run pattern detection on VARCHAR/TEXT columns.
	detectedPatterns, err := DetectPatterns(db, cfg.TableName, DefaultSampleSize)
	if err != nil {
		// Pattern detection is non-critical — log but don't fail the profile.
		detectedPatterns = nil
	}

	return &TableProfile{
		TableName:        cfg.TableName,
		RowCount:         rowCount,
		Dimensions:       dimensions,
		OverallScore:     overallScore,
		DetectedPatterns: detectedPatterns,
	}, nil
}

// SaveProfile persists a TableProfile to the migration.quality_profile table.
func SaveProfile(db *sql.DB, engagementID string, profile *TableProfile) error {
	// Extract scores by dimension name
	scores := make(map[string]float64)
	for _, d := range profile.Dimensions {
		scores[d.Name] = d.Score
	}

	_, err := db.Exec(
		`INSERT INTO migration.quality_profile
		 (engagement_id, source_table, accuracy_score, completeness_score,
		  consistency_score, timeliness_score, validity_score, uniqueness_score, row_count)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		engagementID,
		profile.TableName,
		scores["accuracy"],
		scores["completeness"],
		scores["consistency"],
		scores["timeliness"],
		scores["validity"],
		scores["uniqueness"],
		profile.RowCount,
	)
	if err != nil {
		return fmt.Errorf("save profile for %s: %w", profile.TableName, err)
	}
	return nil
}
