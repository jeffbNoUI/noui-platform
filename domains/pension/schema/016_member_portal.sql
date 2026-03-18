-- 016_member_portal.sql
-- Member Portal: account linking, preferences, scenarios, notifications, documents

-- Clerk user <-> pension member linking
CREATE TABLE IF NOT EXISTS member_account_links (
  clerk_user_id   TEXT PRIMARY KEY,
  member_id       INTEGER NOT NULL,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by       TEXT NOT NULL,  -- 'auto_match' or staff user ID
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked'))
);
CREATE INDEX IF NOT EXISTS idx_member_account_links_member
  ON member_account_links(member_id);

-- Member preferences (communication, accessibility, tour state)
CREATE TABLE IF NOT EXISTS member_preferences (
  member_id       INTEGER PRIMARY KEY,
  preferences     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved what-if scenarios
CREATE TABLE IF NOT EXISTS saved_scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  label           TEXT NOT NULL,
  inputs          JSONB NOT NULL,
  results         JSONB NOT NULL,
  data_version    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_member
  ON saved_scenarios(member_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       TEXT,
  channels        JSONB NOT NULL DEFAULT '["in_portal"]'::jsonb,
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  delivered       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_member_unread
  ON notifications(member_id, read) WHERE read = FALSE;

-- Document metadata (ECM references)
CREATE TABLE IF NOT EXISTS member_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  document_type   TEXT NOT NULL,
  filename        TEXT NOT NULL,
  ecm_ref         TEXT,
  status          TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'received', 'rejected')),
  context         TEXT,
  linked_issue_id UUID,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_documents_member
  ON member_documents(member_id);

-- Payment history (for retirees)
CREATE TABLE IF NOT EXISTS payment_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  payment_date    DATE NOT NULL,
  gross_amount    NUMERIC(12,2) NOT NULL,
  federal_tax     NUMERIC(12,2) NOT NULL DEFAULT 0,
  state_tax       NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(12,2) NOT NULL,
  bank_last_four  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_history_member
  ON payment_history(member_id);

-- Tax documents (1099-R records)
CREATE TABLE IF NOT EXISTS tax_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       INTEGER NOT NULL,
  tax_year        INTEGER NOT NULL,
  document_type   TEXT NOT NULL DEFAULT '1099-R',
  ecm_ref         TEXT,
  available       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, tax_year, document_type)
);
CREATE INDEX IF NOT EXISTS idx_tax_documents_member
  ON tax_documents(member_id);

-- Extend retirement_case for member-initiated applications
ALTER TABLE retirement_case ADD COLUMN IF NOT EXISTS initiated_by TEXT DEFAULT 'staff'
  CHECK (initiated_by IN ('staff', 'member'));
ALTER TABLE retirement_case ADD COLUMN IF NOT EXISTS bounce_message TEXT;
ALTER TABLE retirement_case ADD COLUMN IF NOT EXISTS bounce_stage TEXT;
