// Package db provides PostgreSQL database connectivity and data access for the Correspondence service.
package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"

	"github.com/noui/platform/correspondence/models"
)

// Store wraps a database connection and exposes Correspondence data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(db *sql.DB) *Store {
	return &Store{DB: db}
}

// Config holds database connection parameters.
type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// ConfigFromEnv creates a Config from environment variables with sensible defaults.
func ConfigFromEnv() Config {
	return Config{
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnv("DB_PORT", "5432"),
		User:     getEnv("DB_USER", "derp"),
		Password: getEnv("DB_PASSWORD", "derp"),
		DBName:   getEnv("DB_NAME", "derp"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
	}
}

// Connect establishes a database connection with retry logic.
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
			log.Printf("attempt %d: failed to open db: %v", attempt, err)
			time.Sleep(2 * time.Second)
			continue
		}

		err = db.Ping()
		if err != nil {
			log.Printf("attempt %d: failed to ping db: %v", attempt, err)
			db.Close()
			time.Sleep(2 * time.Second)
			continue
		}

		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(5 * time.Minute)

		log.Printf("connected to database %s on %s:%s", cfg.DBName, cfg.Host, cfg.Port)
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

// ============================================================
// TEMPLATE QUERIES
// ============================================================

// ListTemplates returns templates filtered by optional parameters.
func (s *Store) ListTemplates(tenantID, category, stageCategory string, activeOnly bool, limit, offset int) ([]models.Template, int, error) {
	where := "WHERE t.tenant_id = $1 AND t.deleted_at IS NULL"
	args := []interface{}{tenantID}
	argIdx := 2

	if activeOnly {
		where += " AND t.is_active = true"
	}
	if category != "" {
		where += fmt.Sprintf(" AND t.category = $%d", argIdx)
		args = append(args, category)
		argIdx++
	}
	if stageCategory != "" {
		where += fmt.Sprintf(" AND t.stage_category = $%d", argIdx)
		args = append(args, stageCategory)
		argIdx++
	}

	var total int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM correspondence_template t "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count templates: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT t.template_id, t.tenant_id, t.template_code, t.template_name, t.description,
		       t.category, t.body_template, t.merge_fields, t.output_format,
		       t.stage_category, t.on_send_effects,
		       t.is_active, t.version, t.created_at, t.updated_at, t.created_by, t.updated_by
		FROM correspondence_template t
		%s
		ORDER BY t.category, t.template_name
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.DB.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list templates: %w", err)
	}
	defer rows.Close()

	var templates []models.Template
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, 0, err
		}
		templates = append(templates, t)
	}

	return templates, total, rows.Err()
}

// GetTemplate returns a single template by ID.
func (s *Store) GetTemplate(templateID string) (*models.Template, error) {
	row := s.DB.QueryRow(`
		SELECT template_id, tenant_id, template_code, template_name, description,
		       category, body_template, merge_fields, output_format,
		       stage_category, on_send_effects,
		       is_active, version, created_at, updated_at, created_by, updated_by
		FROM correspondence_template
		WHERE template_id = $1 AND deleted_at IS NULL
	`, templateID)

	var t models.Template
	var mergeFieldsJSON []byte
	if err := row.Scan(
		&t.TemplateID, &t.TenantID, &t.TemplateCode, &t.TemplateName, &t.Description,
		&t.Category, &t.BodyTemplate, &mergeFieldsJSON, &t.OutputFormat,
		&t.StageCategory, &t.OnSendEffects,
		&t.IsActive, &t.Version, &t.CreatedAt, &t.UpdatedAt, &t.CreatedBy, &t.UpdatedBy,
	); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(mergeFieldsJSON, &t.MergeFields); err != nil {
		return nil, fmt.Errorf("unmarshal merge fields: %w", err)
	}

	return &t, nil
}

func scanTemplate(rows *sql.Rows) (models.Template, error) {
	var t models.Template
	var mergeFieldsJSON []byte
	if err := rows.Scan(
		&t.TemplateID, &t.TenantID, &t.TemplateCode, &t.TemplateName, &t.Description,
		&t.Category, &t.BodyTemplate, &mergeFieldsJSON, &t.OutputFormat,
		&t.StageCategory, &t.OnSendEffects,
		&t.IsActive, &t.Version, &t.CreatedAt, &t.UpdatedAt, &t.CreatedBy, &t.UpdatedBy,
	); err != nil {
		return t, fmt.Errorf("scan template: %w", err)
	}
	if err := json.Unmarshal(mergeFieldsJSON, &t.MergeFields); err != nil {
		return t, fmt.Errorf("unmarshal merge fields: %w", err)
	}
	return t, nil
}

// ============================================================
// TEMPLATE MERGE ENGINE
// ============================================================

// RenderTemplate performs {{field}} substitution and validates required fields.
func RenderTemplate(tmpl *models.Template, mergeData map[string]string) (string, error) {
	// Validate required fields
	for _, field := range tmpl.MergeFields {
		if field.Required {
			if _, ok := mergeData[field.Name]; !ok {
				return "", fmt.Errorf("missing required merge field: %s", field.Name)
			}
		}
	}

	// Perform substitution
	body := tmpl.BodyTemplate
	for key, value := range mergeData {
		body = strings.ReplaceAll(body, "{{"+key+"}}", value)
	}

	return body, nil
}

// ============================================================
// CORRESPONDENCE HISTORY QUERIES
// ============================================================

// CreateCorrespondence inserts a new correspondence record.
func (s *Store) CreateCorrespondence(c *models.Correspondence) error {
	mergeDataJSON, err := json.Marshal(c.MergeData)
	if err != nil {
		return fmt.Errorf("marshal merge data: %w", err)
	}

	_, err = s.DB.Exec(`
		INSERT INTO correspondence_history (
			correspondence_id, tenant_id, template_id, member_id, case_id, contact_id,
			subject, body_rendered, merge_data, status, generated_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		c.CorrespondenceID, c.TenantID, c.TemplateID, c.MemberID, c.CaseID, c.ContactID,
		c.Subject, c.BodyRendered, mergeDataJSON, c.Status, c.GeneratedBy, c.CreatedAt, c.UpdatedAt,
	)
	return err
}

// ListHistory returns correspondence history with optional filtering.
func (s *Store) ListHistory(tenantID string, memberID *int, contactID *string, status string, limit, offset int) ([]models.Correspondence, int, error) {
	where := "WHERE h.tenant_id = $1 AND h.deleted_at IS NULL"
	args := []interface{}{tenantID}
	argIdx := 2

	if memberID != nil {
		where += fmt.Sprintf(" AND h.member_id = $%d", argIdx)
		args = append(args, *memberID)
		argIdx++
	}
	if contactID != nil && *contactID != "" {
		where += fmt.Sprintf(" AND h.contact_id = $%d", argIdx)
		args = append(args, *contactID)
		argIdx++
	}
	if status != "" {
		where += fmt.Sprintf(" AND h.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	var total int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM correspondence_history h "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count history: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT h.correspondence_id, h.tenant_id, h.template_id, h.member_id, h.case_id,
		       h.contact_id, h.subject, h.body_rendered, h.merge_data, h.status,
		       h.generated_by, h.sent_at, h.sent_via, h.delivery_address,
		       h.created_at, h.updated_at
		FROM correspondence_history h
		%s
		ORDER BY h.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.DB.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list history: %w", err)
	}
	defer rows.Close()

	var corrs []models.Correspondence
	for rows.Next() {
		c, err := scanCorrespondence(rows)
		if err != nil {
			return nil, 0, err
		}
		corrs = append(corrs, c)
	}

	return corrs, total, rows.Err()
}

// GetCorrespondence returns a single correspondence record.
func (s *Store) GetCorrespondence(corrID string) (*models.Correspondence, error) {
	row := s.DB.QueryRow(`
		SELECT correspondence_id, tenant_id, template_id, member_id, case_id,
		       contact_id, subject, body_rendered, merge_data, status,
		       generated_by, sent_at, sent_via, delivery_address,
		       created_at, updated_at
		FROM correspondence_history
		WHERE correspondence_id = $1 AND deleted_at IS NULL
	`, corrID)

	var c models.Correspondence
	var mergeDataJSON []byte
	if err := row.Scan(
		&c.CorrespondenceID, &c.TenantID, &c.TemplateID, &c.MemberID, &c.CaseID,
		&c.ContactID, &c.Subject, &c.BodyRendered, &mergeDataJSON, &c.Status,
		&c.GeneratedBy, &c.SentAt, &c.SentVia, &c.DeliveryAddress,
		&c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(mergeDataJSON, &c.MergeData); err != nil {
		return nil, fmt.Errorf("unmarshal merge data: %w", err)
	}

	return &c, nil
}

// UpdateCorrespondence updates mutable fields on a correspondence record.
func (s *Store) UpdateCorrespondence(c *models.Correspondence) error {
	_, err := s.DB.Exec(`
		UPDATE correspondence_history
		SET status = $2, sent_at = $3, sent_via = $4, delivery_address = $5, updated_at = NOW()
		WHERE correspondence_id = $1
	`, c.CorrespondenceID, c.Status, c.SentAt, c.SentVia, c.DeliveryAddress)
	return err
}

func scanCorrespondence(rows *sql.Rows) (models.Correspondence, error) {
	var c models.Correspondence
	var mergeDataJSON []byte
	if err := rows.Scan(
		&c.CorrespondenceID, &c.TenantID, &c.TemplateID, &c.MemberID, &c.CaseID,
		&c.ContactID, &c.Subject, &c.BodyRendered, &mergeDataJSON, &c.Status,
		&c.GeneratedBy, &c.SentAt, &c.SentVia, &c.DeliveryAddress,
		&c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return c, fmt.Errorf("scan correspondence: %w", err)
	}
	if err := json.Unmarshal(mergeDataJSON, &c.MergeData); err != nil {
		return c, fmt.Errorf("unmarshal merge data: %w", err)
	}
	return c, nil
}
