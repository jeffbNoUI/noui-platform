-- Employer portal seed data for E2E tests.
-- The portal user ID matches the JWT sub claim used by E2E scripts
-- (a0000000-0000-0000-0000-000000000001) so FK constraints on
-- uploaded_by columns are satisfied.

INSERT INTO employer_portal_user (id, org_id, contact_id, portal_role)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-3000-000000000001',
  '00000000-0000-0000-1000-000000000001',
  'SUPER_USER'
) ON CONFLICT DO NOTHING;
