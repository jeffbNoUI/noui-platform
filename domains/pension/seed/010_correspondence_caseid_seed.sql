-- 010: Associate existing correspondence history with string case IDs.
-- Depends on schema 009_correspondence_caseid_text.sql (case_id is now TEXT).

-- Associate Robert Martinez's correspondence with his retirement case
UPDATE correspondence_history
SET case_id = 'RET-2026-0001'
WHERE member_id = 10001
  AND case_id IS NULL;
