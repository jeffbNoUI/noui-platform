-- 032: Add source database connection configuration to engagements
ALTER TABLE migration.engagement ADD COLUMN source_connection JSONB;
