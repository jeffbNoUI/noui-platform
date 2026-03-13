-- 010: Member summary log for AI training corpus
-- Stores deterministic summary outputs alongside their inputs
-- for future LLM few-shot prompting and validation.

CREATE TABLE IF NOT EXISTS member_summary_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       INTEGER NOT NULL,
    input_hash      TEXT NOT NULL,
    input_json      JSONB NOT NULL,
    output_json     JSONB NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (member_id, input_hash)
);

CREATE INDEX idx_summary_log_member ON member_summary_log(member_id);
