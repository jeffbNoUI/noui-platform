-- 035: Add source_platform_type to migration.engagement
-- Supports cross-engagement pattern accumulation by platform (Phase 5: Mapping Library).
-- Optional field, no NOT NULL constraint.
ALTER TABLE migration.engagement
  ADD COLUMN IF NOT EXISTS source_platform_type VARCHAR(50);
