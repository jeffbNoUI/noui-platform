-- Migration 027: Issue Management Service Schema
-- Creates tables for the issue/defect tracking service (platform/issues).
-- Issues are tenant-scoped; comments are scoped to parent issue.

BEGIN;

-- ============================================================
-- 1. Issues
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
  id                SERIAL PRIMARY KEY,
  issue_id          TEXT NOT NULL,
  tenant_id         UUID NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  severity          TEXT NOT NULL,      -- critical, high, medium, low
  category          TEXT NOT NULL,      -- defect, incident, enhancement, question, error-report
  status            TEXT NOT NULL DEFAULT 'open',  -- open, triaged, in-work, resolved, closed
  affected_service  TEXT NOT NULL,
  reported_by       TEXT NOT NULL,
  assigned_to       TEXT,
  reported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolution_note   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (issue_id, tenant_id)
);

CREATE INDEX idx_issues_tenant ON issues (tenant_id);
CREATE INDEX idx_issues_status  ON issues (tenant_id, status);
CREATE INDEX idx_issues_severity ON issues (tenant_id, severity);
CREATE INDEX idx_issues_reported_at ON issues (tenant_id, reported_at DESC);

-- ============================================================
-- 2. Issue Comments
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_comments (
  id         SERIAL PRIMARY KEY,
  issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issue_comments_issue ON issue_comments (issue_id);

-- ============================================================
-- 3. Row-Level Security
-- ============================================================

-- issues: tenant isolation
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON issues
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::UUID);

-- issue_comments: tenant isolation via parent issues table
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON issue_comments
  USING (
    issue_id IN (
      SELECT id FROM issues
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    issue_id IN (
      SELECT id FROM issues
      WHERE tenant_id = current_setting('app.tenant_id', true)::UUID
    )
  );

COMMIT;
