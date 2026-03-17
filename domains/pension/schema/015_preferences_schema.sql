-- Migration 015: Preferences Service Schema
-- Creates tables for the user preferences / workspace layout service.
-- 4 tables: preference_events, user_preferences, role_suggestions, suggestion_responses

BEGIN;

-- ============================================================
-- 1. Append-only event log
-- ============================================================
CREATE TABLE IF NOT EXISTS preference_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  tenant_id     UUID NOT NULL,
  context_key   TEXT NOT NULL,
  context_flags JSONB NOT NULL DEFAULT '{}',
  action_type   TEXT NOT NULL,
  target_panel  TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preference_events_user_context ON preference_events (user_id, context_key);
CREATE INDEX idx_preference_events_tenant ON preference_events (tenant_id);

-- ============================================================
-- 2. Materialized current state
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id       UUID NOT NULL,
  tenant_id     UUID NOT NULL,
  context_key   TEXT NOT NULL,
  panel_id      TEXT NOT NULL,
  visibility    TEXT NOT NULL DEFAULT 'visible',
  position      INT,
  default_state TEXT NOT NULL DEFAULT 'collapsed',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, context_key, panel_id)
);

CREATE INDEX idx_user_preferences_tenant ON user_preferences (tenant_id);

-- ============================================================
-- 3. Role-level aggregate suggestions
-- ============================================================
CREATE TABLE IF NOT EXISTS role_suggestions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  role          TEXT NOT NULL,
  context_key   TEXT NOT NULL,
  panel_id      TEXT NOT NULL,
  suggestion    JSONB NOT NULL DEFAULT '{}',
  sample_size   INT NOT NULL DEFAULT 0,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role, context_key, panel_id)
);

-- ============================================================
-- 4. User responses to suggestions
-- ============================================================
CREATE TABLE IF NOT EXISTS suggestion_responses (
  user_id       UUID NOT NULL,
  suggestion_id UUID NOT NULL REFERENCES role_suggestions(id) ON DELETE CASCADE,
  response      TEXT NOT NULL,
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, suggestion_id)
);

-- ============================================================
-- 5. Row-Level Security
-- ============================================================

-- preference_events: tenant + user isolation
ALTER TABLE preference_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE preference_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_user_isolation ON preference_events
  USING (
    tenant_id = current_setting('app.tenant_id', true)::UUID
    AND user_id = current_setting('app.user_id', true)::UUID
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)::UUID
    AND user_id = current_setting('app.user_id', true)::UUID
  );

-- user_preferences: tenant + user isolation
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_user_isolation ON user_preferences
  USING (
    tenant_id = current_setting('app.tenant_id', true)::UUID
    AND user_id = current_setting('app.user_id', true)::UUID
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)::UUID
    AND user_id = current_setting('app.user_id', true)::UUID
  );

-- role_suggestions: tenant isolation (shared across users in a role)
ALTER TABLE role_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_suggestions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_suggestions
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- suggestion_responses: user isolation via parent role_suggestions tenant
ALTER TABLE suggestion_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_responses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_user_isolation ON suggestion_responses
  USING (
    user_id = current_setting('app.user_id', true)::UUID
    AND suggestion_id IN (
      SELECT id FROM role_suggestions
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    user_id = current_setting('app.user_id', true)::UUID
    AND suggestion_id IN (
      SELECT id FROM role_suggestions
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  );

COMMIT;
