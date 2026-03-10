-- Case Management Schema
-- Tracks retirement cases through a 7-stage workflow

-- Stage definitions (reference data)
CREATE TABLE IF NOT EXISTS case_stage_definition (
    stage_idx       INTEGER PRIMARY KEY,
    stage_name      VARCHAR(60) NOT NULL UNIQUE,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- Main retirement case entity
CREATE TABLE IF NOT EXISTS retirement_case (
    case_id         VARCHAR(20) PRIMARY KEY,          -- e.g., RET-2026-0147, DRO-2026-0031
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    member_id       INTEGER NOT NULL,
    case_type       VARCHAR(20) NOT NULL DEFAULT 'RET', -- RET or DRO
    retirement_date DATE NOT NULL,
    priority        VARCHAR(10) NOT NULL DEFAULT 'standard',  -- urgent, high, standard, low
    sla_status      VARCHAR(10) NOT NULL DEFAULT 'on-track',  -- on-track, at-risk, urgent
    current_stage   VARCHAR(60) NOT NULL,
    current_stage_idx INTEGER NOT NULL DEFAULT 0,
    assigned_to     VARCHAR(100),
    days_open       INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',    -- active, completed, cancelled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (current_stage_idx) REFERENCES case_stage_definition(stage_idx)
);

CREATE INDEX IF NOT EXISTS idx_retirement_case_member ON retirement_case(member_id);
CREATE INDEX IF NOT EXISTS idx_retirement_case_status ON retirement_case(status);
CREATE INDEX IF NOT EXISTS idx_retirement_case_assigned ON retirement_case(assigned_to);

-- Case flags (many-to-many)
CREATE TABLE IF NOT EXISTS case_flag (
    id              SERIAL PRIMARY KEY,
    case_id         VARCHAR(20) NOT NULL REFERENCES retirement_case(case_id) ON DELETE CASCADE,
    flag_code       VARCHAR(30) NOT NULL,  -- leave-payout, dro, early-retirement, purchased-service
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(case_id, flag_code)
);

CREATE INDEX IF NOT EXISTS idx_case_flag_case ON case_flag(case_id);

-- Stage transition history (audit trail)
CREATE TABLE IF NOT EXISTS case_stage_history (
    id              SERIAL PRIMARY KEY,
    case_id         VARCHAR(20) NOT NULL REFERENCES retirement_case(case_id) ON DELETE CASCADE,
    from_stage_idx  INTEGER,
    to_stage_idx    INTEGER NOT NULL,
    from_stage      VARCHAR(60),
    to_stage        VARCHAR(60) NOT NULL,
    transitioned_by VARCHAR(100),
    note            TEXT,
    transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_history_case ON case_stage_history(case_id);
