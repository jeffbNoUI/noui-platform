package db

import (
	"context"

	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/issues/models"
)

// ListComments returns all comments for an issue, newest first.
func (s *Store) ListComments(ctx context.Context, issueID int) ([]models.IssueComment, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT id, issue_id, author, content, created_at
		FROM issue_comments
		WHERE issue_id = $1
		ORDER BY created_at DESC
	`, issueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []models.IssueComment
	for rows.Next() {
		var c models.IssueComment
		if err := rows.Scan(&c.ID, &c.IssueID, &c.Author, &c.Content, &c.CreatedAt); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, rows.Err()
}

// CreateComment inserts a comment on an issue and returns it with the generated ID.
func (s *Store) CreateComment(ctx context.Context, issueID int, req models.CreateCommentRequest) (*models.IssueComment, error) {
	var comment models.IssueComment
	err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		INSERT INTO issue_comments (issue_id, author, content)
		VALUES ($1, $2, $3)
		RETURNING id, issue_id, author, content, created_at
	`, issueID, req.Author, req.Content).Scan(
		&comment.ID, &comment.IssueID, &comment.Author, &comment.Content, &comment.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &comment, nil
}
