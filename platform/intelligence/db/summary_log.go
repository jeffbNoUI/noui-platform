package db

import (
	"context"
	"encoding/json"

	"github.com/noui/platform/dbcontext"
)

// InsertSummaryLog stores a deterministic summary for future LLM training.
// Uses ON CONFLICT to deduplicate by (member_id, input_hash).
func (s *Store) InsertSummaryLog(ctx context.Context, memberID int, inputHash string, input, output json.RawMessage) error {
	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx,
		`INSERT INTO member_summary_log (member_id, input_hash, input_json, output_json)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (member_id, input_hash) DO NOTHING`,
		memberID, inputHash, input, output,
	)
	return err
}
