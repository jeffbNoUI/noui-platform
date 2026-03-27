-- Performance indexes for migration tables missing FK indexes.
-- quality_profile and code_mapping are queried by engagement_id
-- but had no index on that column.

CREATE INDEX IF NOT EXISTS idx_quality_profile_engagement
    ON migration.quality_profile(engagement_id);

CREATE INDEX IF NOT EXISTS idx_code_mapping_engagement
    ON migration.code_mapping(engagement_id);
