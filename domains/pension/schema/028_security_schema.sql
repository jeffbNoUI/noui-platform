-- Migration 028: Security Service Schema
-- Creates tables for the security events and session tracking service (platform/security).
-- security_events: immutable audit log of authentication/access events.
-- active_sessions: mutable session table with upsert-by-session_id pattern.

BEGIN;

-- ============================================================
-- 1. Security Events (immutable audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_events (
  id          SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL,
  event_type  TEXT NOT NULL,
  actor_id    TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  ip_address  TEXT NOT NULL,
  user_agent  TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_events_tenant     ON security_events (tenant_id);
CREATE INDEX idx_security_events_actor      ON security_events (tenant_id, actor_id);
CREATE INDEX idx_security_events_type       ON security_events (tenant_id, event_type);
CREATE INDEX idx_security_events_created    ON security_events (tenant_id, created_at DESC);

-- ============================================================
-- 2. Active Sessions (mutable, upsert by session_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS active_sessions (
  id          SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL,
  user_id     TEXT NOT NULL,
  session_id  TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL,
  ip_address  TEXT NOT NULL,
  user_agent  TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_active_sessions_tenant      ON active_sessions (tenant_id);
CREATE INDEX idx_active_sessions_user        ON active_sessions (tenant_id, user_id);
CREATE INDEX idx_active_sessions_last_seen   ON active_sessions (tenant_id, last_seen_at DESC);

-- ============================================================
-- 3. Row-Level Security
-- ============================================================

-- security_events: tenant isolation (append-only audit log)
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON security_events
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- active_sessions: tenant isolation
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON active_sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

COMMIT;
