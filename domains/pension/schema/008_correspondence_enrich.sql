-- 008: Add stage_category and on_send_effects to correspondence templates
-- Enables stage-triggered correspondence suggestions and post-send side-effects.

ALTER TABLE correspondence_template
  ADD COLUMN IF NOT EXISTS stage_category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS on_send_effects JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_correspondence_template_stage_category
  ON correspondence_template (stage_category)
  WHERE stage_category IS NOT NULL AND deleted_at IS NULL;
