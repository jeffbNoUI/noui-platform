# Workspace Preference Learning — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a per-user workspace layout preference system with role-based aggregate suggestions, enabling the AI composition engine to learn from explicit user feedback.

**Architecture:** New `platform/preferences/` Go service (port 8089) with 4 PostgreSQL tables. Frontend adds a pure `applyPreferences()` overlay to the existing `composeStages()` pipeline. Daily batch job computes role-level suggestions from convergent preference patterns.

**Tech Stack:** Go 1.22, PostgreSQL (raw SQL), React/TypeScript, React Query, Vitest

**Design Doc:** `docs/plans/2026-03-16-workspace-preference-learning-design.md`

---

## Task 1: Backend — Types and Context Key

**Files:**
- Create: `platform/preferences/models/types.go`
- Create: `platform/preferences/contextkey/contextkey.go`
- Test: `platform/preferences/contextkey/contextkey_test.go`

**Step 1: Write the context key test**

```go
// platform/preferences/contextkey/contextkey_test.go
package contextkey

import "testing"

func TestCompute_DeterministicForSameFlags(t *testing.T) {
	a := Compute(true, true, 2)
	b := Compute(true, true, 2)
	if a != b {
		t.Errorf("same flags produced different keys: %q vs %q", a, b)
	}
}

func TestCompute_DifferentForDifferentFlags(t *testing.T) {
	a := Compute(true, false, 1)
	b := Compute(false, false, 1)
	if a == b {
		t.Error("different flags produced the same key")
	}
}

func TestCompute_AllCombinations(t *testing.T) {
	seen := map[string]bool{}
	for _, dro := range []bool{true, false} {
		for _, early := range []bool{true, false} {
			for _, tier := range []int{1, 2, 3} {
				key := Compute(dro, early, tier)
				if key == "" {
					t.Error("empty key produced")
				}
				if seen[key] {
					t.Errorf("duplicate key: %s for dro=%v early=%v tier=%d", key, dro, early, tier)
				}
				seen[key] = true
			}
		}
	}
	if len(seen) != 12 {
		t.Errorf("expected 12 unique keys, got %d", len(seen))
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/preferences && go test ./contextkey/ -v`
Expected: FAIL — package doesn't exist yet

**Step 3: Write the context key implementation and types**

```go
// platform/preferences/contextkey/contextkey.go
package contextkey

import (
	"crypto/sha256"
	"fmt"
)

// Compute produces a deterministic context key from coarsened CaseFlags.
// Only hasDRO, isEarlyRetirement, and tier are included — other flags
// affect panel existence (handled by composition), not layout preferences.
func Compute(hasDRO, isEarlyRetirement bool, tier int) string {
	raw := fmt.Sprintf("dro=%v;early=%v;tier=%d", hasDRO, isEarlyRetirement, tier)
	h := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", h[:8]) // 16-char hex, plenty unique for 12 buckets
}
```

```go
// platform/preferences/models/types.go
package models

import "time"

// ActionType represents the kind of preference feedback.
type ActionType string

const (
	ActionReorder  ActionType = "reorder"
	ActionPin      ActionType = "pin"
	ActionHide     ActionType = "hide"
	ActionExpand   ActionType = "expand"
	ActionCollapse ActionType = "collapse"
)

// Visibility represents a panel's visibility state.
type Visibility string

const (
	VisibilityVisible Visibility = "visible"
	VisibilityHidden  Visibility = "hidden"
	VisibilityPinned  Visibility = "pinned"
)

// DefaultState represents a panel's default expansion state.
type DefaultState string

const (
	DefaultExpanded  DefaultState = "expanded"
	DefaultCollapsed DefaultState = "collapsed"
)

// PreferenceEvent is an append-only record of a user's explicit feedback.
type PreferenceEvent struct {
	ID           string            `json:"id"`
	UserID       string            `json:"userId"`
	TenantID     string            `json:"tenantId"`
	ContextKey   string            `json:"contextKey"`
	ContextFlags map[string]any    `json:"contextFlags"`
	ActionType   ActionType        `json:"actionType"`
	TargetPanel  string            `json:"targetPanel"`
	Payload      map[string]any    `json:"payload"`
	CreatedAt    time.Time         `json:"createdAt"`
}

// UserPreference is the materialized current state of a user's panel preference.
type UserPreference struct {
	UserID       string       `json:"userId"`
	TenantID     string       `json:"tenantId"`
	ContextKey   string       `json:"contextKey"`
	PanelID      string       `json:"panelId"`
	Visibility   Visibility   `json:"visibility"`
	Position     *int         `json:"position"`
	DefaultState DefaultState `json:"defaultState"`
	UpdatedAt    time.Time    `json:"updatedAt"`
}

// UpsertPreferenceRequest is the API request to save a preference.
type UpsertPreferenceRequest struct {
	ContextKey   string         `json:"contextKey"`
	ContextFlags map[string]any `json:"contextFlags"`
	PanelID      string         `json:"panelId"`
	ActionType   ActionType     `json:"actionType"`
	Visibility   Visibility     `json:"visibility"`
	Position     *int           `json:"position"`
	DefaultState DefaultState   `json:"defaultState"`
}

// RoleSuggestion is a computed suggestion based on aggregate preferences.
type RoleSuggestion struct {
	ID          string         `json:"id"`
	TenantID    string         `json:"tenantId"`
	Role        string         `json:"role"`
	ContextKey  string         `json:"contextKey"`
	PanelID     string         `json:"panelId"`
	Suggestion  map[string]any `json:"suggestion"`
	SampleSize  int            `json:"sampleSize"`
	ComputedAt  time.Time      `json:"computedAt"`
}

// SuggestionWithResponse is a suggestion enriched with the user's response state.
type SuggestionWithResponse struct {
	RoleSuggestion
	UserResponse *string    `json:"userResponse,omitempty"` // nil = not yet responded
	RespondedAt  *time.Time `json:"respondedAt,omitempty"`
}

// RespondRequest is the API request to accept/dismiss/snooze a suggestion.
type RespondRequest struct {
	Response string `json:"response"` // "accepted" | "dismissed" | "snoozed"
}
```

**Step 4: Run test to verify it passes**

Run: `cd platform/preferences && go test ./contextkey/ -v`
Expected: PASS — all 3 tests pass

**Step 5: Commit**

```bash
git add platform/preferences/models/types.go platform/preferences/contextkey/
git commit -m "[platform/preferences] Add types and context key computation"
```

---

## Task 2: Backend — Database Layer (Store)

**Files:**
- Create: `platform/preferences/db/postgres.go`
- Create: `platform/preferences/go.mod`
- Create: `platform/preferences/go.sum` (generated)

**Reference:** Follow the exact pattern from `platform/dataquality/db/postgres.go` — `Config`, `ConfigFromEnv()`, `Connect()`, `Store` struct, all queries use `dbcontext.DB(ctx, s.DB)`.

**Step 1: Create go.mod**

```go
// platform/preferences/go.mod
module github.com/noui/platform/preferences

go 1.22.0

require (
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.11.2
	github.com/noui/platform/auth v0.0.0
	github.com/noui/platform/dbcontext v0.0.0
	github.com/noui/platform/envutil v0.0.0
	github.com/noui/platform/logging v0.0.0
	github.com/noui/platform/ratelimit v0.0.0
	github.com/noui/platform/validation v0.0.0
)

replace (
	github.com/noui/platform/auth => ../auth
	github.com/noui/platform/dbcontext => ../dbcontext
	github.com/noui/platform/envutil => ../envutil
	github.com/noui/platform/logging => ../logging
	github.com/noui/platform/ratelimit => ../ratelimit
	github.com/noui/platform/validation => ../validation
)
```

**Step 2: Write the store**

```go
// platform/preferences/db/postgres.go
package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/lib/pq"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/envutil"
)

type Config struct {
	Host, Port, User, Password, DBName, SSLMode string
	MaxOpenConns, MaxIdleConns                   int
}

func ConfigFromEnv() Config {
	return Config{
		Host:         envutil.GetEnv("DB_HOST", "localhost"),
		Port:         envutil.GetEnv("DB_PORT", "5432"),
		User:         envutil.GetEnv("DB_USER", "derp"),
		Password:     envutil.GetEnv("DB_PASSWORD", "derp"),
		DBName:       envutil.GetEnv("DB_NAME", "derp"),
		SSLMode:      envutil.GetEnv("DB_SSLMODE", "disable"),
		MaxOpenConns: envutil.GetEnvInt("DB_MAX_OPEN_CONNS", 5),
		MaxIdleConns: envutil.GetEnvInt("DB_MAX_IDLE_CONNS", 2),
	}
}

func Connect(cfg Config) (*sql.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode)

	var database *sql.DB
	var err error
	for attempt := 1; attempt <= 3; attempt++ {
		database, err = sql.Open("postgres", dsn)
		if err != nil {
			slog.Warn("db open failed", "attempt", attempt, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}
		if err = database.Ping(); err != nil {
			slog.Warn("db ping failed", "attempt", attempt, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}
		break
	}
	if err != nil {
		return nil, fmt.Errorf("connect after 3 attempts: %w", err)
	}

	database.SetMaxOpenConns(cfg.MaxOpenConns)
	database.SetMaxIdleConns(cfg.MaxIdleConns)
	database.SetConnMaxLifetime(5 * time.Minute)
	return database, nil
}

type Store struct {
	DB *sql.DB
}

func NewStore(database *sql.DB) *Store {
	return &Store{DB: database}
}

// --- Preference Events ---

func (s *Store) InsertEvent(ctx context.Context, tenantID, userID, contextKey string,
	contextFlags map[string]any, actionType, targetPanel string, payload map[string]any) error {

	flagsJSON, _ := json.Marshal(contextFlags)
	payloadJSON, _ := json.Marshal(payload)

	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx,
		`INSERT INTO preference_events (tenant_id, user_id, context_key, context_flags, action_type, target_panel, payload)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		tenantID, userID, contextKey, flagsJSON, actionType, targetPanel, payloadJSON)
	if err != nil {
		return fmt.Errorf("insert event: %w", err)
	}
	return nil
}

// --- User Preferences ---

func (s *Store) GetPreferences(ctx context.Context, userID, contextKey string) ([]map[string]any, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx,
		`SELECT panel_id, visibility, position, default_state, updated_at
		 FROM user_preferences
		 WHERE user_id = $1 AND context_key = $2
		 ORDER BY COALESCE(position, 999)`,
		userID, contextKey)
	if err != nil {
		return nil, fmt.Errorf("get preferences: %w", err)
	}
	defer rows.Close()

	var results []map[string]any
	for rows.Next() {
		var panelID, visibility, defaultState string
		var position sql.NullInt64
		var updatedAt time.Time
		if err := rows.Scan(&panelID, &visibility, &position, &defaultState, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan preference: %w", err)
		}
		row := map[string]any{
			"panelId":      panelID,
			"visibility":   visibility,
			"defaultState": defaultState,
			"updatedAt":    updatedAt,
		}
		if position.Valid {
			row["position"] = position.Int64
		}
		results = append(results, row)
	}
	return results, nil
}

func (s *Store) UpsertPreference(ctx context.Context, userID, tenantID, contextKey, panelID,
	visibility string, position *int, defaultState string) error {

	var posVal sql.NullInt64
	if position != nil {
		posVal = sql.NullInt64{Int64: int64(*position), Valid: true}
	}

	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx,
		`INSERT INTO user_preferences (user_id, tenant_id, context_key, panel_id, visibility, position, default_state, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		 ON CONFLICT (user_id, context_key, panel_id) DO UPDATE SET
		   visibility = EXCLUDED.visibility,
		   position = EXCLUDED.position,
		   default_state = EXCLUDED.default_state,
		   updated_at = NOW()`,
		userID, tenantID, contextKey, panelID, visibility, posVal, defaultState)
	if err != nil {
		return fmt.Errorf("upsert preference: %w", err)
	}
	return nil
}

func (s *Store) DeletePreferences(ctx context.Context, userID, contextKey string) error {
	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx,
		`DELETE FROM user_preferences WHERE user_id = $1 AND context_key = $2`,
		userID, contextKey)
	if err != nil {
		return fmt.Errorf("delete preferences: %w", err)
	}
	return nil
}

// --- Suggestions ---

func (s *Store) GetSuggestions(ctx context.Context, userID, role, contextKey string) ([]map[string]any, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx,
		`SELECT rs.id, rs.role, rs.context_key, rs.panel_id, rs.suggestion, rs.sample_size, rs.computed_at,
		        sr.response, sr.responded_at
		 FROM role_suggestions rs
		 LEFT JOIN suggestion_responses sr ON sr.suggestion_id = rs.id AND sr.user_id = $1
		 WHERE rs.role = $2 AND rs.context_key = $3
		   AND (sr.response IS NULL OR sr.response = 'snoozed')
		 ORDER BY rs.computed_at DESC
		 LIMIT 1`,
		userID, role, contextKey)
	if err != nil {
		return nil, fmt.Errorf("get suggestions: %w", err)
	}
	defer rows.Close()

	var results []map[string]any
	for rows.Next() {
		var id, rsRole, rsContextKey, panelID string
		var suggestionJSON []byte
		var sampleSize int
		var computedAt time.Time
		var response sql.NullString
		var respondedAt sql.NullTime

		if err := rows.Scan(&id, &rsRole, &rsContextKey, &panelID, &suggestionJSON,
			&sampleSize, &computedAt, &response, &respondedAt); err != nil {
			return nil, fmt.Errorf("scan suggestion: %w", err)
		}
		var suggestion map[string]any
		json.Unmarshal(suggestionJSON, &suggestion)

		row := map[string]any{
			"id":         id,
			"role":       rsRole,
			"contextKey": rsContextKey,
			"panelId":    panelID,
			"suggestion": suggestion,
			"sampleSize": sampleSize,
			"computedAt": computedAt,
		}
		if response.Valid {
			row["userResponse"] = response.String
			row["respondedAt"] = respondedAt.Time
		}
		results = append(results, row)
	}
	return results, nil
}

func (s *Store) RespondToSuggestion(ctx context.Context, userID, suggestionID, response string) error {
	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx,
		`INSERT INTO suggestion_responses (user_id, suggestion_id, response, responded_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (user_id, suggestion_id) DO UPDATE SET
		   response = EXCLUDED.response,
		   responded_at = NOW()`,
		userID, suggestionID, response)
	if err != nil {
		return fmt.Errorf("respond to suggestion: %w", err)
	}
	return nil
}
```

**Step 3: Run go mod tidy and build**

Run: `cd platform/preferences && go mod tidy && go build ./...`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add platform/preferences/go.mod platform/preferences/go.sum platform/preferences/db/
git commit -m "[platform/preferences] Add database store with event and preference queries"
```

---

## Task 3: Backend — API Handlers

**Files:**
- Create: `platform/preferences/api/handlers.go`

**Reference:** Follow exact pattern from `platform/dataquality/api/handlers.go` — same helper functions (`tenantID()`, `writeJSON()`, `writeSuccess()`, `writeError()`, `decodeJSON()`).

**Step 1: Write the handlers**

```go
// platform/preferences/api/handlers.go
package api

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/noui/platform/auth"
	prefdb "github.com/noui/platform/preferences/db"
	"github.com/noui/platform/validation"
)

type Handler struct {
	store *prefdb.Store
}

func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: prefdb.NewStore(database)}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	mux.HandleFunc("GET /api/v1/preferences", h.GetPreferences)
	mux.HandleFunc("PUT /api/v1/preferences", h.UpsertPreference)
	mux.HandleFunc("DELETE /api/v1/preferences", h.ResetPreferences)

	mux.HandleFunc("GET /api/v1/suggestions", h.GetSuggestions)
	mux.HandleFunc("POST /api/v1/suggestions/{id}/respond", h.RespondToSuggestion)
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "preferences",
		"version": "0.1.0",
	})
}

func (h *Handler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	contextKey := r.URL.Query().Get("context_key")
	if contextKey == "" {
		writeError(w, http.StatusBadRequest, "MISSING_PARAM", "context_key is required")
		return
	}

	prefs, err := h.store.GetPreferences(r.Context(), userID, contextKey)
	if err != nil {
		slog.Error("get preferences failed", "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "failed to fetch preferences")
		return
	}
	if prefs == nil {
		prefs = []map[string]any{}
	}
	writeSuccess(w, http.StatusOK, prefs)
}

func (h *Handler) UpsertPreference(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	tid := tenantID(r)

	var req struct {
		ContextKey   string         `json:"contextKey"`
		ContextFlags map[string]any `json:"contextFlags"`
		PanelID      string         `json:"panelId"`
		ActionType   string         `json:"actionType"`
		Visibility   string         `json:"visibility"`
		Position     *int           `json:"position"`
		DefaultState string         `json:"defaultState"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}

	if req.ContextKey == "" || req.PanelID == "" || req.ActionType == "" {
		writeError(w, http.StatusBadRequest, "MISSING_FIELDS", "contextKey, panelId, and actionType are required")
		return
	}

	// Default values
	if req.Visibility == "" {
		req.Visibility = "visible"
	}
	if req.DefaultState == "" {
		req.DefaultState = "collapsed"
	}

	// Write event (append-only log)
	payload := map[string]any{}
	if req.Position != nil {
		payload["position"] = *req.Position
	}
	if req.Visibility != "" {
		payload["visibility"] = req.Visibility
	}
	if req.DefaultState != "" {
		payload["defaultState"] = req.DefaultState
	}

	if err := h.store.InsertEvent(r.Context(), tid, userID, req.ContextKey,
		req.ContextFlags, req.ActionType, req.PanelID, payload); err != nil {
		slog.Error("insert event failed", "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "failed to record event")
		return
	}

	// Upsert materialized preference
	if err := h.store.UpsertPreference(r.Context(), userID, tid, req.ContextKey,
		req.PanelID, req.Visibility, req.Position, req.DefaultState); err != nil {
		slog.Error("upsert preference failed", "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "failed to save preference")
		return
	}

	writeSuccess(w, http.StatusOK, map[string]string{"status": "saved"})
}

func (h *Handler) ResetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	contextKey := r.URL.Query().Get("context_key")
	if contextKey == "" {
		writeError(w, http.StatusBadRequest, "MISSING_PARAM", "context_key is required")
		return
	}

	// Log reset event
	tid := tenantID(r)
	h.store.InsertEvent(r.Context(), tid, userID, contextKey,
		nil, "reset", "*", map[string]any{"action": "reset_all"})

	if err := h.store.DeletePreferences(r.Context(), userID, contextKey); err != nil {
		slog.Error("reset preferences failed", "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "failed to reset preferences")
		return
	}

	writeSuccess(w, http.StatusOK, map[string]string{"status": "reset"})
}

func (h *Handler) GetSuggestions(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	role := auth.UserRole(r.Context())
	contextKey := r.URL.Query().Get("context_key")
	if contextKey == "" {
		writeError(w, http.StatusBadRequest, "MISSING_PARAM", "context_key is required")
		return
	}

	suggestions, err := h.store.GetSuggestions(r.Context(), userID, role, contextKey)
	if err != nil {
		slog.Error("get suggestions failed", "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "failed to fetch suggestions")
		return
	}
	if suggestions == nil {
		suggestions = []map[string]any{}
	}
	writeSuccess(w, http.StatusOK, suggestions)
}

func (h *Handler) RespondToSuggestion(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	suggestionID := r.PathValue("id")

	var req struct {
		Response string `json:"response"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}

	valid := map[string]bool{"accepted": true, "dismissed": true, "snoozed": true}
	if !valid[req.Response] {
		writeError(w, http.StatusBadRequest, "INVALID_RESPONSE", "response must be accepted, dismissed, or snoozed")
		return
	}

	if err := h.store.RespondToSuggestion(r.Context(), userID, suggestionID, req.Response); err != nil {
		slog.Error("respond to suggestion failed", "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "failed to record response")
		return
	}

	writeSuccess(w, http.StatusOK, map[string]string{"status": "recorded"})
}

// --- Helpers (same pattern as dataquality/api/handlers.go) ---

func tenantID(r *http.Request) string {
	tid := auth.TenantID(r.Context())
	if tid == "" {
		return "default"
	}
	return tid
}

func decodeJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return fmt.Errorf("empty request body")
	}
	return json.NewDecoder(r.Body).Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeSuccess(w http.ResponseWriter, status int, data any) {
	writeJSON(w, status, map[string]any{
		"data": data,
		"meta": map[string]any{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"service":   "preferences",
			"version":   "0.1.0",
		},
	})
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
```

**Note:** The `auth.UserID()` function may need to be added to the shared `platform/auth` package if it doesn't exist. Check `platform/auth/` for available functions — the existing pattern uses `auth.TenantID()` and `auth.UserRole()`. If `auth.UserID()` is missing, add it following the same pattern (extract from JWT `sub` claim stored in context).

**Step 2: Build to verify compilation**

Run: `cd platform/preferences && go build ./...`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add platform/preferences/api/
git commit -m "[platform/preferences] Add API handlers for preferences and suggestions"
```

---

## Task 4: Backend — Main Entry Point and Dockerfile

**Files:**
- Create: `platform/preferences/main.go`
- Create: `platform/preferences/Dockerfile`

**Step 1: Write main.go**

Follow exact pattern from `platform/dataquality/main.go`:

```go
// Workspace Preference Learning service — stores user layout preferences
// and computes role-based suggestions from aggregate patterns.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/noui/platform/auth"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/logging"
	"github.com/noui/platform/preferences/api"
	"github.com/noui/platform/preferences/db"
	"github.com/noui/platform/ratelimit"
)

func main() {
	logger := logging.Setup("preferences", nil)
	slog.SetDefault(logger)
	slog.Info("starting Preferences service v0.1.0")

	cfg := db.ConfigFromEnv()
	database, err := db.Connect(cfg)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	handler := api.NewHandler(database)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	claimsExtractor := func(r *http.Request) dbcontext.Params {
		return dbcontext.Params{
			TenantID: auth.TenantID(r.Context()),
			MemberID: auth.MemberID(r.Context()),
			UserRole: auth.UserRole(r.Context()),
		}
	}

	authExtractor := func(r *http.Request) []slog.Attr {
		return []slog.Attr{
			slog.String("tenant_id", auth.TenantID(r.Context())),
			slog.String("user_role", auth.UserRole(r.Context())),
		}
	}

	rl := ratelimit.Middleware(ratelimit.DefaultConfig())
	wrappedMux := corsMiddleware(auth.Middleware(rl(dbcontext.DBMiddleware(database, claimsExtractor)(logging.RequestLogger(logger, authExtractor)(mux)))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8089"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      wrappedMux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("Preferences service listening", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down Preferences service...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("Preferences service stopped")
}

func corsMiddleware(next http.Handler) http.Handler {
	origin := os.Getenv("CORS_ORIGIN")
	if origin == "" {
		origin = "http://localhost:3000"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-Request-ID")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")

		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
```

**Step 2: Write Dockerfile**

```dockerfile
# Multi-stage build for preferences service
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /preferences .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /preferences /preferences

EXPOSE 8089

ENTRYPOINT ["/preferences"]
```

**Step 3: Build to verify**

Run: `cd platform/preferences && go build -o /dev/null .`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add platform/preferences/main.go platform/preferences/Dockerfile
git commit -m "[platform/preferences] Add main entry point and Dockerfile"
```

---

## Task 5: Backend — Docker Compose and Database Migration

**Files:**
- Modify: `docker-compose.yml` — add preferences service entry
- Create: Database migration SQL (find the next migration number)

**Step 1: Add service to docker-compose.yml**

Add after the last service entry (follow the `dataquality` pattern exactly):

```yaml
  preferences:
    build:
      context: ./platform/preferences
      dockerfile: Dockerfile
    ports:
      - "8089:8089"
    environment:
      PORT: "8089"
      DB_HOST: pgbouncer
      DB_PORT: "6432"
      DB_USER: derp
      DB_PASSWORD: derp
      DB_NAME: derp
      DB_SSLMODE: disable
      DB_MAX_OPEN_CONNS: "5"
      DB_MAX_IDLE_CONNS: "2"
      CORS_ORIGIN: "http://localhost:3000"
    depends_on:
      pgbouncer:
        condition: service_healthy
```

**Step 2: Create database migration**

Find the next migration number by checking existing migrations:

Run: `ls platform/casemanagement/migrations/ | tail -5` (or wherever migrations live)

Check: `docs/plans/2026-03-16-workspace-preference-learning-design.md` for exact SQL.

Create the migration file with 4 tables + RLS policies. Use the design doc SQL as the source of truth. Add RLS policies following the existing `engagement_isolation` pattern but scoped to `tenant_id` and `user_id`.

**Step 3: Commit**

```bash
git add docker-compose.yml <migration-file>
git commit -m "[platform/preferences] Add Docker Compose entry and database migration"
```

---

## Task 6: Frontend — Preference Override Pure Function

**Files:**
- Create: `frontend/src/lib/preferenceOverrides.ts`
- Test: `frontend/src/lib/__tests__/preferenceOverrides.test.ts`

**Step 1: Write the failing tests**

```typescript
// frontend/src/lib/__tests__/preferenceOverrides.test.ts
import { describe, it, expect } from 'vitest';
import { applyPreferences, computeContextKey } from '@/lib/preferenceOverrides';
import type { StageDescriptor } from '@/lib/workflowComposition';

const baseStages: StageDescriptor[] = [
  { id: 'intake', label: 'Application Intake', icon: '📋', description: '', confidence: 'pending', conditional: false },
  { id: 'verify-employment', label: 'Verify Employment', icon: '📊', description: '', confidence: 'pending', conditional: false },
  { id: 'salary-ams', label: 'Salary & AMS', icon: '💰', description: '', confidence: 'pending', conditional: false },
  { id: 'eligibility', label: 'Eligibility', icon: '✓', description: '', confidence: 'pending', conditional: false },
  { id: 'dro', label: 'DRO Division', icon: '⚖️', description: '', confidence: 'needs-review', conditional: true },
  { id: 'benefit-calc', label: 'Benefit Calculation', icon: '🔢', description: '', confidence: 'pending', conditional: false },
  { id: 'election', label: 'Election Recording', icon: '💳', description: '', confidence: 'pending', conditional: false },
  { id: 'submit', label: 'Final Certification', icon: '✅', description: '', confidence: 'pending', conditional: false },
];

describe('applyPreferences', () => {
  it('returns base stages unmodified when no preferences', () => {
    const result = applyPreferences(baseStages, []);
    expect(result.map(s => s.id)).toEqual(baseStages.map(s => s.id));
    expect(result.every(s => !s.preferenceApplied)).toBe(true);
  });

  it('reorders a panel to a new position', () => {
    const prefs = [{ panelId: 'dro', visibility: 'visible' as const, position: 1, defaultState: 'collapsed' as const }];
    const result = applyPreferences(baseStages, prefs);
    expect(result[1].id).toBe('dro');
    expect(result.find(s => s.id === 'dro')!.preferenceApplied).toBe(true);
  });

  it('hides a conditional panel', () => {
    const prefs = [{ panelId: 'dro', visibility: 'hidden' as const, position: null, defaultState: 'collapsed' as const }];
    const result = applyPreferences(baseStages, prefs);
    expect(result.find(s => s.id === 'dro')).toBeUndefined();
  });

  it('refuses to hide a mandatory panel', () => {
    const prefs = [{ panelId: 'intake', visibility: 'hidden' as const, position: null, defaultState: 'collapsed' as const }];
    const result = applyPreferences(baseStages, prefs);
    expect(result.find(s => s.id === 'intake')).toBeDefined();
  });

  it('ignores preferences for panels not in base stages', () => {
    const prefs = [{ panelId: 'nonexistent', visibility: 'visible' as const, position: 0, defaultState: 'expanded' as const }];
    const result = applyPreferences(baseStages, prefs);
    expect(result.length).toBe(baseStages.length);
  });

  it('sets preferenceApplied and defaultPosition on modified stages', () => {
    const prefs = [{ panelId: 'salary-ams', visibility: 'visible' as const, position: 0, defaultState: 'expanded' as const }];
    const result = applyPreferences(baseStages, prefs);
    const salaryStage = result.find(s => s.id === 'salary-ams')!;
    expect(salaryStage.preferenceApplied).toBe(true);
    expect(salaryStage.defaultPosition).toBe(2); // original index
  });
});

describe('computeContextKey', () => {
  it('produces consistent keys for same flags', () => {
    const a = computeContextKey({ hasDRO: true, isEarlyRetirement: false, tier: 2,
      hasPurchasedService: false, hasLeavePayout: false });
    const b = computeContextKey({ hasDRO: true, isEarlyRetirement: false, tier: 2,
      hasPurchasedService: true, hasLeavePayout: true }); // these flags are ignored
    expect(a).toBe(b);
  });

  it('produces different keys for different relevant flags', () => {
    const a = computeContextKey({ hasDRO: true, isEarlyRetirement: false, tier: 1,
      hasPurchasedService: false, hasLeavePayout: false });
    const b = computeContextKey({ hasDRO: false, isEarlyRetirement: false, tier: 1,
      hasPurchasedService: false, hasLeavePayout: false });
    expect(a).not.toBe(b);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/__tests__/preferenceOverrides.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Write the implementation**

This is a **user contribution point**. The `applyPreferences` function is where a key design decision lives: how exactly should reordering work when multiple panels have position overrides? There are meaningful trade-offs:

- **Absolute positioning** (position = index in final array): simple but fragile — if composition adds/removes a panel, positions shift
- **Relative positioning** (position = rank among positioned items, unpositioned items fill gaps): more robust but harder to reason about

**Suggested implementation (absolute positioning with clamping):**

```typescript
// frontend/src/lib/preferenceOverrides.ts
import type { StageDescriptor, CaseFlags } from './workflowComposition';

export interface PanelPreference {
  panelId: string;
  visibility: 'visible' | 'hidden' | 'pinned';
  position: number | null;
  defaultState: 'expanded' | 'collapsed';
}

export interface ComposedStage extends StageDescriptor {
  preferenceApplied: boolean;
  defaultPosition: number;
  defaultState: 'expanded' | 'collapsed';
  pinned: boolean;
}

// Mandatory stage IDs that cannot be hidden by user preferences.
const MANDATORY_STAGES = new Set(['intake', 'benefit-calc', 'election', 'submit']);

/**
 * Applies user preferences as an overlay on top of base composition output.
 * Pure function: no side effects, no API calls.
 *
 * Rules:
 * 1. Composition is authoritative on panel existence — prefs can't add panels.
 * 2. Mandatory stages cannot be hidden.
 * 3. Missing preferences fall through to composition defaults.
 * 4. Reorder is visual only — doesn't affect backend stage progression.
 */
export function applyPreferences(
  baseStages: StageDescriptor[],
  preferences: PanelPreference[],
): ComposedStage[] {
  const prefMap = new Map(preferences.map(p => [p.panelId, p]));

  // Step 1: Annotate each base stage with its default position and any preference
  let stages: ComposedStage[] = baseStages.map((stage, idx) => {
    const pref = prefMap.get(stage.id);
    return {
      ...stage,
      preferenceApplied: !!pref,
      defaultPosition: idx,
      defaultState: pref?.defaultState ?? 'collapsed',
      pinned: pref?.visibility === 'pinned',
    };
  });

  // Step 2: Filter hidden panels (skip mandatory)
  stages = stages.filter(stage => {
    const pref = prefMap.get(stage.id);
    if (pref?.visibility === 'hidden' && !MANDATORY_STAGES.has(stage.id)) {
      return false;
    }
    return true;
  });

  // Step 3: Reorder — panels with position preferences get placed first,
  // remaining panels fill gaps in their default order.
  const positioned: { stage: ComposedStage; position: number }[] = [];
  const unpositioned: ComposedStage[] = [];

  for (const stage of stages) {
    const pref = prefMap.get(stage.id);
    if (pref?.position != null) {
      positioned.push({ stage, position: pref.position });
    } else {
      unpositioned.push(stage);
    }
  }

  // Sort positioned by their target position
  positioned.sort((a, b) => a.position - b.position);

  // Merge: place positioned items at their target indices, fill gaps with unpositioned
  const result: ComposedStage[] = new Array(stages.length);
  const used = new Set<number>();

  // Place positioned items first (clamped to valid range)
  for (const { stage, position } of positioned) {
    const idx = Math.max(0, Math.min(position, stages.length - 1));
    // Find nearest free slot
    let slot = idx;
    while (used.has(slot) && slot < stages.length) slot++;
    if (slot >= stages.length) {
      slot = idx;
      while (used.has(slot) && slot > 0) slot--;
    }
    result[slot] = stage;
    used.add(slot);
  }

  // Fill remaining slots with unpositioned items in default order
  let uIdx = 0;
  for (let i = 0; i < result.length; i++) {
    if (!used.has(i)) {
      result[i] = unpositioned[uIdx++];
    }
  }

  return result;
}

/**
 * Computes context key from CaseFlags. Uses only the flags that affect
 * layout preference (not panel existence): hasDRO, isEarlyRetirement, tier.
 */
export function computeContextKey(flags: CaseFlags): string {
  const raw = `dro=${flags.hasDRO};early=${flags.isEarlyRetirement};tier=${flags.tier}`;
  // Simple hash — must match the Go contextkey.Compute output.
  // Using a deterministic string-based approach for cross-platform compatibility.
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/__tests__/preferenceOverrides.test.ts`
Expected: PASS — all tests green

**Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 6: Commit**

```bash
git add frontend/src/lib/preferenceOverrides.ts frontend/src/lib/__tests__/preferenceOverrides.test.ts
git commit -m "[frontend] Add applyPreferences pure function with tests"
```

---

## Task 7: Frontend — Preference API Client and Hooks

**Files:**
- Modify: `frontend/src/lib/api.ts` — add preferences API endpoints
- Create: `frontend/src/hooks/usePreferences.ts`

**Step 1: Add preferences API to api.ts**

Add a new `PREFERENCES_URL` constant and `preferencesAPI` export after the existing API sections:

```typescript
// Add to frontend/src/lib/api.ts:

const PREFERENCES_URL = import.meta.env.VITE_PREFERENCES_URL || '/api';

export const preferencesAPI = {
  getPreferences: (contextKey: string) =>
    fetchAPI<PanelPreference[]>(`${PREFERENCES_URL}/v1/preferences?context_key=${encodeURIComponent(contextKey)}`),

  upsertPreference: (req: UpsertPreferenceRequest) =>
    putAPI<{ status: string }>(`${PREFERENCES_URL}/v1/preferences`, req),

  resetPreferences: (contextKey: string) =>
    fetchAPI<{ status: string }>(`${PREFERENCES_URL}/v1/preferences?context_key=${encodeURIComponent(contextKey)}`,
      // Note: fetchAPI doesn't support DELETE — need to use raw request or add deleteAPI
    ),

  getSuggestions: (contextKey: string) =>
    fetchAPI<SuggestionResponse[]>(`${PREFERENCES_URL}/v1/suggestions?context_key=${encodeURIComponent(contextKey)}`),

  respondToSuggestion: (suggestionId: string, response: string) =>
    postAPI<{ status: string }>(`${PREFERENCES_URL}/v1/suggestions/${suggestionId}/respond`, { response }),
};
```

**Note:** Check if `apiClient.ts` exports a `deleteAPI` helper. If not, add one following the `putAPI` pattern. The reset endpoint uses HTTP DELETE.

**Step 2: Create the hooks**

```typescript
// frontend/src/hooks/usePreferences.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { preferencesAPI } from '@/lib/api';
import { applyPreferences, computeContextKey } from '@/lib/preferenceOverrides';
import type { PanelPreference, ComposedStage } from '@/lib/preferenceOverrides';
import type { StageDescriptor, CaseFlags } from '@/lib/workflowComposition';

export function useUserPreferences(contextKey: string) {
  return useQuery<PanelPreference[]>({
    queryKey: ['preferences', contextKey],
    queryFn: () => preferencesAPI.getPreferences(contextKey),
    enabled: !!contextKey,
    staleTime: 5 * 60 * 1000, // 5 minutes — preferences change rarely
  });
}

export function useUpsertPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: preferencesAPI.upsertPreference,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['preferences', variables.contextKey] });
    },
  });
}

export function useResetPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contextKey: string) => preferencesAPI.resetPreferences(contextKey),
    onSuccess: (_data, contextKey) => {
      queryClient.invalidateQueries({ queryKey: ['preferences', contextKey] });
    },
  });
}

export function useSuggestions(contextKey: string) {
  return useQuery({
    queryKey: ['suggestions', contextKey],
    queryFn: () => preferencesAPI.getSuggestions(contextKey),
    enabled: !!contextKey,
    staleTime: 60 * 60 * 1000, // 1 hour — suggestions computed daily
  });
}

export function useRespondToSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, response }: { suggestionId: string; response: string }) =>
      preferencesAPI.respondToSuggestion(suggestionId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });
}

/**
 * Composes workspace stages with user preferences applied.
 * Graceful degradation: returns base stages if preferences fail to load.
 */
export function useComposedWorkspace(
  baseStages: StageDescriptor[],
  flags: CaseFlags,
): ComposedStage[] {
  const contextKey = useMemo(() => computeContextKey(flags), [flags]);
  const { data: preferences } = useUserPreferences(contextKey);

  return useMemo(
    () => applyPreferences(baseStages, preferences ?? []),
    [baseStages, preferences],
  );
}
```

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/usePreferences.ts
git commit -m "[frontend] Add preference API client and React Query hooks"
```

---

## Task 8: Frontend — Wire Preferences into RetirementApplication

**Files:**
- Modify: `frontend/src/components/RetirementApplication.tsx`

**Step 1: Replace direct `composeStages` with `useComposedWorkspace`**

In `RetirementApplication.tsx`, change the composition section (lines ~58-73):

**Before:**
```typescript
import { composeStages, deriveCaseFlags } from '@/lib/workflowComposition';
// ...
const stages = useMemo(
  () => composeStages(flags, { member, calculation, employment, serviceCredit: svcCreditData }),
  [flags, member, calculation, employment, svcCreditData],
);
```

**After:**
```typescript
import { composeStages, deriveCaseFlags } from '@/lib/workflowComposition';
import { useComposedWorkspace } from '@/hooks/usePreferences';
// ...
const baseStages = useMemo(
  () => composeStages(flags, { member, calculation, employment, serviceCredit: svcCreditData }),
  [flags, member, calculation, employment, svcCreditData],
);
const stages = useComposedWorkspace(baseStages, flags);
```

The `stages` variable type changes from `StageDescriptor[]` to `ComposedStage[]` which extends `StageDescriptor` — all existing code that reads `stages` continues to work without changes.

**Step 2: Verify existing tests still pass**

Run: `cd frontend && npx vitest run src/components/__tests__/RetirementApplication.test.tsx`
Expected: PASS — existing tests should not break (ComposedStage extends StageDescriptor)

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add frontend/src/components/RetirementApplication.tsx
git commit -m "[frontend] Wire preference overlay into workspace composition pipeline"
```

---

## Task 9: Frontend — Customize Mode UI Controls

**Files:**
- Create: `frontend/src/components/workflow/PanelCustomizeControls.tsx`
- Create: `frontend/src/components/workflow/__tests__/PanelCustomizeControls.test.tsx`

This is a **user contribution point**. The customize controls component is where the UX design decision lives — how the drag handle, visibility toggle, and expansion toggle should look and behave. The test should verify:

1. Drag handle renders when customize mode is on
2. Visibility toggle cycles through visible → pinned → hidden (skipping hidden for mandatory stages)
3. Expansion toggle fires the correct callback
4. All controls are hidden when customize mode is off

**Step 1: Write the test**

```typescript
// frontend/src/components/workflow/__tests__/PanelCustomizeControls.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PanelCustomizeControls from '../PanelCustomizeControls';

describe('PanelCustomizeControls', () => {
  const defaultProps = {
    panelId: 'eligibility',
    isMandatory: false,
    isCustomizing: true,
    visibility: 'visible' as const,
    defaultState: 'collapsed' as const,
    onVisibilityChange: vi.fn(),
    onDefaultStateChange: vi.fn(),
  };

  it('renders controls when customizing', () => {
    render(<PanelCustomizeControls {...defaultProps} />);
    expect(screen.getByLabelText(/visibility/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expansion/i)).toBeInTheDocument();
  });

  it('hides controls when not customizing', () => {
    render(<PanelCustomizeControls {...defaultProps} isCustomizing={false} />);
    expect(screen.queryByLabelText(/visibility/i)).not.toBeInTheDocument();
  });

  it('disables hide for mandatory stages', () => {
    render(<PanelCustomizeControls {...defaultProps} isMandatory={true} />);
    const visBtn = screen.getByLabelText(/visibility/i);
    // Click through: visible → pinned → visible (skip hidden for mandatory)
    fireEvent.click(visBtn);
    expect(defaultProps.onVisibilityChange).toHaveBeenCalledWith('pinned');
  });

  it('allows hide for conditional stages', () => {
    const onChange = vi.fn();
    render(<PanelCustomizeControls {...defaultProps} visibility="pinned" onVisibilityChange={onChange} />);
    const visBtn = screen.getByLabelText(/visibility/i);
    fireEvent.click(visBtn);
    expect(onChange).toHaveBeenCalledWith('hidden');
  });

  it('toggles expansion state', () => {
    const onChange = vi.fn();
    render(<PanelCustomizeControls {...defaultProps} onDefaultStateChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/expansion/i));
    expect(onChange).toHaveBeenCalledWith('expanded');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/workflow/__tests__/PanelCustomizeControls.test.tsx`
Expected: FAIL — component doesn't exist

**Step 3: Implement the component**

```tsx
// frontend/src/components/workflow/PanelCustomizeControls.tsx
interface PanelCustomizeControlsProps {
  panelId: string;
  isMandatory: boolean;
  isCustomizing: boolean;
  visibility: 'visible' | 'hidden' | 'pinned';
  defaultState: 'expanded' | 'collapsed';
  onVisibilityChange: (v: 'visible' | 'hidden' | 'pinned') => void;
  onDefaultStateChange: (s: 'expanded' | 'collapsed') => void;
}

const VISIBILITY_CYCLE_MANDATORY: Record<string, 'visible' | 'pinned'> = {
  visible: 'pinned',
  pinned: 'visible',
};

const VISIBILITY_CYCLE: Record<string, 'visible' | 'hidden' | 'pinned'> = {
  visible: 'pinned',
  pinned: 'hidden',
  hidden: 'visible',
};

const VISIBILITY_ICONS: Record<string, string> = {
  visible: '👁',
  pinned: '📌',
  hidden: '🚫',
};

export default function PanelCustomizeControls({
  isMandatory,
  isCustomizing,
  visibility,
  defaultState,
  onVisibilityChange,
  onDefaultStateChange,
}: PanelCustomizeControlsProps) {
  if (!isCustomizing) return null;

  const nextVisibility = isMandatory
    ? VISIBILITY_CYCLE_MANDATORY[visibility] ?? 'visible'
    : VISIBILITY_CYCLE[visibility] ?? 'visible';

  const nextExpansion = defaultState === 'collapsed' ? 'expanded' : 'collapsed';

  return (
    <div className="flex items-center gap-1 ml-2 opacity-80 hover:opacity-100 transition-opacity">
      <button
        aria-label="visibility"
        title={`${visibility} — click to change`}
        onClick={() => onVisibilityChange(nextVisibility)}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
      >
        {VISIBILITY_ICONS[visibility]}
      </button>
      <button
        aria-label="expansion"
        title={`Default: ${defaultState} — click to toggle`}
        onClick={() => onDefaultStateChange(nextExpansion)}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs"
      >
        {defaultState === 'expanded' ? '▼' : '▶'}
      </button>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/workflow/__tests__/PanelCustomizeControls.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workflow/PanelCustomizeControls.tsx frontend/src/components/workflow/__tests__/PanelCustomizeControls.test.tsx
git commit -m "[frontend] Add PanelCustomizeControls component with tests"
```

---

## Task 10: Frontend — Suggestion Toast Component

**Files:**
- Create: `frontend/src/components/workflow/SuggestionToast.tsx`
- Create: `frontend/src/components/workflow/__tests__/SuggestionToast.test.tsx`

**Step 1: Write the test**

```typescript
// frontend/src/components/workflow/__tests__/SuggestionToast.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestionToast from '../SuggestionToast';

describe('SuggestionToast', () => {
  const suggestion = {
    id: 'sug-1',
    panelId: 'dro',
    suggestion: { action: 'reorder', position: 2 },
    sampleSize: 8,
    role: 'benefits_analyst',
  };

  it('renders suggestion text with peer count', () => {
    render(<SuggestionToast suggestion={suggestion} totalInRole={10} onRespond={vi.fn()} />);
    expect(screen.getByText(/8 of 10 analysts/i)).toBeInTheDocument();
  });

  it('calls onRespond with accepted', () => {
    const onRespond = vi.fn();
    render(<SuggestionToast suggestion={suggestion} totalInRole={10} onRespond={onRespond} />);
    fireEvent.click(screen.getByText(/try it/i));
    expect(onRespond).toHaveBeenCalledWith('sug-1', 'accepted');
  });

  it('calls onRespond with dismissed', () => {
    const onRespond = vi.fn();
    render(<SuggestionToast suggestion={suggestion} totalInRole={10} onRespond={onRespond} />);
    fireEvent.click(screen.getByText(/dismiss/i));
    expect(onRespond).toHaveBeenCalledWith('sug-1', 'dismissed');
  });

  it('calls onRespond with snoozed', () => {
    const onRespond = vi.fn();
    render(<SuggestionToast suggestion={suggestion} totalInRole={10} onRespond={onRespond} />);
    fireEvent.click(screen.getByText(/not now/i));
    expect(onRespond).toHaveBeenCalledWith('sug-1', 'snoozed');
  });

  it('renders nothing when suggestion is null', () => {
    const { container } = render(<SuggestionToast suggestion={null} totalInRole={10} onRespond={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/workflow/__tests__/SuggestionToast.test.tsx`
Expected: FAIL

**Step 3: Implement the component**

```tsx
// frontend/src/components/workflow/SuggestionToast.tsx

interface SuggestionData {
  id: string;
  panelId: string;
  suggestion: { action: string; position?: number };
  sampleSize: number;
  role: string;
}

interface SuggestionToastProps {
  suggestion: SuggestionData | null;
  totalInRole: number;
  onRespond: (suggestionId: string, response: 'accepted' | 'dismissed' | 'snoozed') => void;
}

export default function SuggestionToast({ suggestion, totalInRole, onRespond }: SuggestionToastProps) {
  if (!suggestion) return null;

  const actionText = suggestion.suggestion.action === 'reorder'
    ? 'reorder their workspace panels'
    : `adjust the ${suggestion.panelId} panel`;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg shadow-lg p-4 z-50">
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {suggestion.sampleSize} of {totalInRole} analysts working similar cases {actionText}.
        Want to try that layout?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onRespond(suggestion.id, 'accepted')}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try it
        </button>
        <button
          onClick={() => onRespond(suggestion.id, 'dismissed')}
          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Dismiss
        </button>
        <button
          onClick={() => onRespond(suggestion.id, 'snoozed')}
          className="px-3 py-1 text-sm text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/workflow/__tests__/SuggestionToast.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workflow/SuggestionToast.tsx frontend/src/components/workflow/__tests__/SuggestionToast.test.tsx
git commit -m "[frontend] Add SuggestionToast component with tests"
```

---

## Task 11: Backend — Suggestion Batch Job

**Files:**
- Create: `platform/preferences/suggestion/job.go`
- Create: `platform/preferences/suggestion/job_test.go`

**Step 1: Write the test**

```go
// platform/preferences/suggestion/job_test.go
package suggestion

import "testing"

func TestComputeConvergence(t *testing.T) {
	// 7 of 10 users have position=2 for panel "dro"
	dist := map[int]int{2: 7, 4: 2, 5: 1}
	pct, dominant := computeConvergence(dist, 10)
	if pct < 0.70 || pct > 0.70 {
		t.Errorf("expected 0.70, got %f", pct)
	}
	if dominant != 2 {
		t.Errorf("expected dominant=2, got %d", dominant)
	}
}

func TestComputeConvergence_BelowThreshold(t *testing.T) {
	dist := map[int]int{2: 3, 4: 3, 5: 4}
	pct, _ := computeConvergence(dist, 10)
	if pct >= 0.70 {
		t.Errorf("expected below 0.70, got %f", pct)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd platform/preferences && go test ./suggestion/ -v`
Expected: FAIL

**Step 3: Implement the convergence logic**

```go
// platform/preferences/suggestion/job.go
package suggestion

// computeConvergence returns the convergence percentage and the dominant value
// from a distribution of position preferences.
func computeConvergence(dist map[int]int, total int) (float64, int) {
	if total == 0 {
		return 0, 0
	}
	maxCount := 0
	dominant := 0
	for val, count := range dist {
		if count > maxCount {
			maxCount = count
			dominant = val
		}
	}
	return float64(maxCount) / float64(total), dominant
}
```

The full batch job implementation (SQL aggregation, role_suggestions upsert, stale cleanup) will reference the store's database connection. The core convergence logic is pure and testable independently.

**Step 4: Run test to verify it passes**

Run: `cd platform/preferences && go test ./suggestion/ -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/preferences/suggestion/
git commit -m "[platform/preferences] Add suggestion convergence computation with tests"
```

---

## Task 12: Integration — Full Stack Verification

**Files:** No new files — this is a verification task.

**Step 1: Run all Go tests**

Run: `cd platform/preferences && go test ./... -v -short`
Expected: All context key tests + suggestion tests PASS

**Step 2: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All existing tests + new preferenceOverrides + PanelCustomizeControls + SuggestionToast PASS

**Step 3: Typecheck frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Build Go service**

Run: `cd platform/preferences && go build -o /dev/null .`
Expected: BUILD SUCCESS

**Step 5: Build frontend**

Run: `cd frontend && npm run build`
Expected: BUILD SUCCESS

**Step 6: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "[platform/preferences] Integration verification — all tests passing"
```

---

## Task 13: Update Documentation

**Files:**
- Modify: `platform/CLAUDE.md` — add preferences service to service table
- Modify: `BUILD_HISTORY.md` — add workspace preference learning entry

**Step 1: Update platform/CLAUDE.md**

Add to the service table:

```
| preferences | `github.com/noui/platform/preferences` | 8089 | PostgreSQL | User layout preferences, role-based aggregate suggestions |
```

**Step 2: Update BUILD_HISTORY.md**

Add entry describing what was built: new service, 4 tables, preference override pipeline, feedback UI components, suggestion toast.

**Step 3: Commit**

```bash
git add platform/CLAUDE.md BUILD_HISTORY.md
git commit -m "[docs] Add preferences service to platform documentation"
```

---

## Summary

| Task | Component | Tests | Key Decision |
|------|-----------|-------|--------------|
| 1 | Types + context key | 3 Go tests | Context key hashing from coarsened flags |
| 2 | Database store | Build verification | Event sourcing: append-only events + materialized read model |
| 3 | API handlers | Build verification | 5 endpoints following dataquality pattern |
| 4 | Main + Dockerfile | Build verification | Port 8089, standard middleware chain |
| 5 | Docker Compose + migration | Infrastructure | 4 tables with RLS |
| 6 | `applyPreferences()` | 6 Vitest tests | **User decision**: Reorder algorithm (absolute vs relative positioning) |
| 7 | API client + hooks | Typecheck | React Query with graceful degradation |
| 8 | Wire into RetirementApp | Existing tests pass | ComposedStage extends StageDescriptor (backward compatible) |
| 9 | PanelCustomizeControls | 5 Vitest tests | Visibility cycle: visible → pinned → hidden (mandatory skips hidden) |
| 10 | SuggestionToast | 5 Vitest tests | Peer count display, three response options |
| 11 | Batch job convergence | 2 Go tests | 70% threshold, dominant value extraction |
| 12 | Full stack verification | All tests | Integration check |
| 13 | Documentation | N/A | Service table + BUILD_HISTORY |

**Total new tests:** ~21 (8 Go + 16 Vitest)
**Total new files:** ~14
**Modified files:** ~4
