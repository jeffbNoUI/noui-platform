-- Migration 033: Job queue table for async profiling, mapping, and reconciliation workloads.
-- Workers on conversion servers poll this table using SELECT ... FOR UPDATE SKIP LOCKED.
-- Design doc: docs/plans/MIGRATION_OVERHAUL.md Part 1

CREATE TABLE migration.job (
    job_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id  UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    job_type       TEXT NOT NULL,
    scope          TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','CLAIMED','RUNNING','COMPLETE','FAILED','CANCELLED')),
    priority       INT NOT NULL DEFAULT 0,
    progress       INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    input_json     JSONB NOT NULL DEFAULT '{}',
    result_json    JSONB,
    error_message  TEXT,
    worker_id      TEXT,
    attempt        INT NOT NULL DEFAULT 0,
    max_attempts   INT NOT NULL DEFAULT 3,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at     TIMESTAMPTZ,
    heartbeat_at   TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ
);

-- Fast poll: workers SELECT from PENDING jobs ordered by priority DESC, created_at ASC.
-- Partial index keeps the poll query fast even with millions of completed jobs.
CREATE INDEX idx_job_poll ON migration.job(status, priority DESC, created_at)
    WHERE status = 'PENDING';

-- Engagement lookup: API lists jobs for a specific engagement.
CREATE INDEX idx_job_engagement ON migration.job(engagement_id, job_type, status);

-- Stale detection: background goroutine finds jobs with expired heartbeats.
CREATE INDEX idx_job_stale ON migration.job(heartbeat_at)
    WHERE status IN ('CLAIMED', 'RUNNING');

-- Worker lookup: find all jobs claimed by a specific worker (health check).
CREATE INDEX idx_job_worker ON migration.job(worker_id)
    WHERE worker_id IS NOT NULL AND status IN ('CLAIMED', 'RUNNING');
