// Package db provides PostgreSQL database connectivity and data access for the Knowledge Base service.
package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"

	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/knowledgebase/models"
)

// Store wraps a database connection and exposes Knowledge Base data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(db *sql.DB) *Store {
	return &Store{DB: db}
}

// Config holds database connection parameters.
type Config struct {
	Host         string
	Port         string
	User         string
	Password     string
	DBName       string
	SSLMode      string
	MaxOpenConns int
	MaxIdleConns int
}

// ConfigFromEnv creates a Config from environment variables with sensible defaults.
func ConfigFromEnv() Config {
	return Config{
		Host:         getEnv("DB_HOST", "localhost"),
		Port:         getEnv("DB_PORT", "5432"),
		User:         getEnv("DB_USER", "derp"),
		Password:     getEnv("DB_PASSWORD", "derp"),
		DBName:       getEnv("DB_NAME", "derp"),
		SSLMode:      getEnv("DB_SSLMODE", "disable"),
		MaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 8),
		MaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 3),
	}
}

// Connect establishes a database connection with retry logic.
// It will attempt up to 3 times with a 2 second delay between attempts.
func Connect(cfg Config) (*sql.DB, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	var db *sql.DB
	var err error

	for attempt := 1; attempt <= 3; attempt++ {
		db, err = sql.Open("postgres", connStr)
		if err != nil {
			slog.Warn("database connection failed, retrying", "attempt", attempt, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}

		err = db.Ping()
		if err != nil {
			slog.Warn("database connection failed, retrying", "attempt", attempt, "error", err)
			db.Close()
			time.Sleep(2 * time.Second)
			continue
		}

		db.SetMaxOpenConns(cfg.MaxOpenConns)
		db.SetMaxIdleConns(cfg.MaxIdleConns)
		db.SetConnMaxLifetime(5 * time.Minute)

		slog.Info("database connected", "host", cfg.Host, "dbname", cfg.DBName, "max_open_conns", cfg.MaxOpenConns, "max_idle_conns", cfg.MaxIdleConns)
		return db, nil
	}

	return nil, fmt.Errorf("failed to connect after 3 attempts: %w", err)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

// ============================================================
// ARTICLE QUERIES
// ============================================================

// ListArticles returns articles filtered by optional parameters.
func (s *Store) ListArticles(ctx context.Context, tenantID, stageID, topic, query string, limit, offset int) ([]models.KBArticle, int, error) {
	// Build WHERE clause dynamically
	where := "WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND a.is_active = true"
	args := []interface{}{tenantID}
	argIdx := 2

	if stageID != "" {
		where += fmt.Sprintf(" AND a.stage_id = $%d", argIdx)
		args = append(args, stageID)
		argIdx++
	}
	if topic != "" {
		where += fmt.Sprintf(" AND a.topic = $%d", argIdx)
		args = append(args, topic)
		argIdx++
	}
	if query != "" {
		where += fmt.Sprintf(" AND to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.context_text, '')) @@ plainto_tsquery('english', $%d)", argIdx)
		args = append(args, query)
		argIdx++
	}

	// Count
	countQuery := "SELECT COUNT(*) FROM kb_article a " + where
	var total int
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count articles: %w", err)
	}

	// Fetch
	dataQuery := fmt.Sprintf(`
		SELECT a.article_id, a.tenant_id, a.stage_id, a.topic, a.title,
		       a.context_text, a.checklist, a.next_action, a.sort_order, a.is_active,
		       a.created_at, a.updated_at, a.created_by, a.updated_by
		FROM kb_article a
		%s
		ORDER BY a.sort_order, a.created_at
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list articles: %w", err)
	}
	defer rows.Close()

	var articles []models.KBArticle
	for rows.Next() {
		a, err := scanArticle(rows)
		if err != nil {
			return nil, 0, err
		}
		articles = append(articles, a)
	}

	return articles, total, rows.Err()
}

// GetArticle returns a single article with its rule references.
func (s *Store) GetArticle(ctx context.Context, articleID string) (*models.KBArticle, error) {
	row := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT article_id, tenant_id, stage_id, topic, title,
		       context_text, checklist, next_action, sort_order, is_active,
		       created_at, updated_at, created_by, updated_by
		FROM kb_article
		WHERE article_id = $1 AND deleted_at IS NULL
	`, articleID)

	a, err := scanArticleRow(row)
	if err != nil {
		return nil, err
	}

	refs, err := s.getRuleReferences(ctx, articleID)
	if err != nil {
		return nil, err
	}
	a.RuleReferences = refs

	return &a, nil
}

// GetStageHelp returns the article for a specific stage with rule references.
func (s *Store) GetStageHelp(ctx context.Context, tenantID, stageID string) (*models.KBArticle, error) {
	row := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT article_id, tenant_id, stage_id, topic, title,
		       context_text, checklist, next_action, sort_order, is_active,
		       created_at, updated_at, created_by, updated_by
		FROM kb_article
		WHERE tenant_id = $1 AND stage_id = $2 AND deleted_at IS NULL AND is_active = true
		ORDER BY sort_order
		LIMIT 1
	`, tenantID, stageID)

	a, err := scanArticleRow(row)
	if err != nil {
		return nil, err
	}

	refs, err := s.getRuleReferences(ctx, a.ArticleID)
	if err != nil {
		return nil, err
	}
	a.RuleReferences = refs

	return &a, nil
}

// SearchArticles performs full-text search across articles.
func (s *Store) SearchArticles(ctx context.Context, tenantID, query string, limit, offset int) ([]models.KBArticle, int, error) {
	return s.ListArticles(ctx, tenantID, "", "", query, limit, offset)
}

// ============================================================
// RULE REFERENCE QUERIES
// ============================================================

func (s *Store) getRuleReferences(ctx context.Context, articleID string) ([]models.KBRuleReference, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT reference_id, article_id, rule_id, rule_code, rule_description,
		       rule_domain, sort_order, created_at, created_by
		FROM kb_rule_reference
		WHERE article_id = $1
		ORDER BY sort_order
	`, articleID)
	if err != nil {
		return nil, fmt.Errorf("get rule refs: %w", err)
	}
	defer rows.Close()

	var refs []models.KBRuleReference
	for rows.Next() {
		var r models.KBRuleReference
		if err := rows.Scan(
			&r.ReferenceID, &r.ArticleID, &r.RuleID, &r.RuleCode,
			&r.RuleDescription, &r.RuleDomain, &r.SortOrder,
			&r.CreatedAt, &r.CreatedBy,
		); err != nil {
			return nil, fmt.Errorf("scan rule ref: %w", err)
		}
		refs = append(refs, r)
	}

	return refs, rows.Err()
}

// ListRules returns all rule references, optionally filtered by domain.
func (s *Store) ListRules(ctx context.Context, domain string, limit, offset int) ([]models.KBRuleReference, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if domain != "" {
		where += fmt.Sprintf(" AND r.rule_domain = $%d", argIdx)
		args = append(args, domain)
		argIdx++
	}

	// Count
	var total int
	countQuery := "SELECT COUNT(*) FROM kb_rule_reference r " + where
	if err := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count rules: %w", err)
	}

	// Fetch
	dataQuery := fmt.Sprintf(`
		SELECT r.reference_id, r.article_id, r.rule_id, r.rule_code, r.rule_description,
		       r.rule_domain, r.sort_order, r.created_at, r.created_by
		FROM kb_rule_reference r
		%s
		ORDER BY r.rule_domain, r.rule_code
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list rules: %w", err)
	}
	defer rows.Close()

	var refs []models.KBRuleReference
	for rows.Next() {
		var r models.KBRuleReference
		if err := rows.Scan(
			&r.ReferenceID, &r.ArticleID, &r.RuleID, &r.RuleCode,
			&r.RuleDescription, &r.RuleDomain, &r.SortOrder,
			&r.CreatedAt, &r.CreatedBy,
		); err != nil {
			return nil, 0, fmt.Errorf("scan rule: %w", err)
		}
		refs = append(refs, r)
	}

	return refs, total, rows.Err()
}

// GetRule returns a single rule reference by rule_id with linked articles.
func (s *Store) GetRule(ctx context.Context, ruleID string) (*models.KBRuleReference, []models.KBArticle, error) {
	row := dbcontext.DB(ctx, s.DB).QueryRowContext(ctx, `
		SELECT reference_id, article_id, rule_id, rule_code, rule_description,
		       rule_domain, sort_order, created_at, created_by
		FROM kb_rule_reference
		WHERE rule_id = $1
		LIMIT 1
	`, ruleID)

	var r models.KBRuleReference
	if err := row.Scan(
		&r.ReferenceID, &r.ArticleID, &r.RuleID, &r.RuleCode,
		&r.RuleDescription, &r.RuleDomain, &r.SortOrder,
		&r.CreatedAt, &r.CreatedBy,
	); err != nil {
		return nil, nil, err
	}

	// Get all articles linked to this rule_id
	artRows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT a.article_id, a.tenant_id, a.stage_id, a.topic, a.title,
		       a.context_text, a.checklist, a.next_action, a.sort_order, a.is_active,
		       a.created_at, a.updated_at, a.created_by, a.updated_by
		FROM kb_article a
		INNER JOIN kb_rule_reference rr ON rr.article_id = a.article_id
		WHERE rr.rule_id = $1 AND a.deleted_at IS NULL
		ORDER BY a.sort_order
	`, ruleID)
	if err != nil {
		return nil, nil, fmt.Errorf("get articles for rule: %w", err)
	}
	defer artRows.Close()

	var articles []models.KBArticle
	for artRows.Next() {
		a, err := scanArticle(artRows)
		if err != nil {
			return nil, nil, err
		}
		articles = append(articles, a)
	}

	return &r, articles, artRows.Err()
}

// ============================================================
// SCAN HELPERS
// ============================================================

func scanArticle(rows *sql.Rows) (models.KBArticle, error) {
	var a models.KBArticle
	var checklistJSON []byte
	if err := rows.Scan(
		&a.ArticleID, &a.TenantID, &a.StageID, &a.Topic, &a.Title,
		&a.ContextText, &checklistJSON, &a.NextAction, &a.SortOrder, &a.IsActive,
		&a.CreatedAt, &a.UpdatedAt, &a.CreatedBy, &a.UpdatedBy,
	); err != nil {
		return a, fmt.Errorf("scan article: %w", err)
	}
	if err := json.Unmarshal(checklistJSON, &a.Checklist); err != nil {
		return a, fmt.Errorf("unmarshal checklist: %w", err)
	}
	return a, nil
}

func scanArticleRow(row *sql.Row) (models.KBArticle, error) {
	var a models.KBArticle
	var checklistJSON []byte
	if err := row.Scan(
		&a.ArticleID, &a.TenantID, &a.StageID, &a.Topic, &a.Title,
		&a.ContextText, &checklistJSON, &a.NextAction, &a.SortOrder, &a.IsActive,
		&a.CreatedAt, &a.UpdatedAt, &a.CreatedBy, &a.UpdatedBy,
	); err != nil {
		return a, err
	}
	if err := json.Unmarshal(checklistJSON, &a.Checklist); err != nil {
		return a, fmt.Errorf("unmarshal checklist: %w", err)
	}
	return a, nil
}
