# Next Session: Member Portal Phase 3 — Profile & Data Correction

## Context
- **PR #89** contains Phase 2 (Adaptive Dashboard) — merge before starting Phase 3
- **Plan**: `docs/plans/2026-03-17-member-portal-redesign-plan.md`
- **Phase 3 tasks**: 16–24 (Profile shell, Personal Info, Addresses, Beneficiaries, Employment, Contributions, Service Credit, Flag-an-Issue, Staff Work Queue)

## What's Built (Phases 1–2)
- Plan profile config, types, persona resolver, DB migrations, demo accounts (Phase 1)
- Portal shell with sidebar navigation, 4 persona dashboards, dashboard router, guided tour framework (Phase 2)
- 142 test files, 1047 tests passing

## Architecture for Phase 3
- Profile section lives at `frontend/src/components/portal/profile/`
- Navigation: sidebar "My Profile" button sets `activeSection='profile'` → MemberPortal renders `<ProfileSection>`
- ProfileSection has 6 sub-tabs with its own tab navigation component
- EditableField component determines field permissions (immediate-edit vs staff-review)
- ChangeRequestForm handles staff-review fields (proposed value + reason + optional doc)
- Flag-an-Issue (Task 23) creates `ChangeRequest` records
- Staff Work Queue (Task 24) surfaces change requests for staff review

## Start Commands
```bash
# Check out from merged main (or continue in branch if PR not merged)
# Read the plan
cat docs/plans/2026-03-17-member-portal-redesign-plan.md | head -1100 | tail -200

# Verify build
cd frontend && npx tsc --noEmit && npm test -- --run
```

## Key Files to Read First
- `docs/plans/2026-03-17-member-portal-redesign-plan.md` (Tasks 16–24)
- `frontend/src/components/portal/MemberPortal.tsx` (thin wrapper — add profile routing)
- `frontend/src/components/portal/MemberPortalShell.tsx` (shell with sidebar)
- `frontend/src/types/MemberPortal.ts` (MemberPreferences, ChangeRequest types)
