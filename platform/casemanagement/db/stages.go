package db

import (
	"context"

	"github.com/noui/platform/casemanagement/models"
	"github.com/noui/platform/dbcontext"
)

// ListStages returns all stage definitions ordered by sort_order.
func (s *Store) ListStages(ctx context.Context) ([]models.StageDefinition, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT stage_idx, stage_name, COALESCE(description, ''), sort_order
		FROM case_stage_definition
		ORDER BY sort_order
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stages []models.StageDefinition
	for rows.Next() {
		var st models.StageDefinition
		if err := rows.Scan(&st.StageIdx, &st.StageName, &st.Description, &st.SortOrder); err != nil {
			return nil, err
		}
		stages = append(stages, st)
	}
	return stages, rows.Err()
}

// GetStage returns a single stage definition by index.
func (s *Store) GetStage(ctx context.Context, stageIdx int) (*models.StageDefinition, error) {
	var st models.StageDefinition
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT stage_idx, stage_name, COALESCE(description, ''), sort_order
		FROM case_stage_definition
		WHERE stage_idx = $1
	`, stageIdx).Scan(&st.StageIdx, &st.StageName, &st.Description, &st.SortOrder)
	if err != nil {
		return nil, err
	}
	return &st, nil
}
