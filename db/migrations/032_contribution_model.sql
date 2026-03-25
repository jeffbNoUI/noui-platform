-- 032_contribution_model.sql
-- Adds contribution model to engagement for employer-paid systems (Nevada PERS EPC, Utah RS Tier 1)

ALTER TABLE migration.engagement
    ADD COLUMN contribution_model VARCHAR(20) NOT NULL DEFAULT 'standard'
    CHECK (contribution_model IN ('standard', 'employer_paid'));
