-- Migration 012: Add functional index for member search
CREATE INDEX IF NOT EXISTS idx_member_search_name
    ON member_master (LOWER(last_name) text_pattern_ops, LOWER(first_name) text_pattern_ops);
