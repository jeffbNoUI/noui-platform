# Phase 11 Session 12 Starter — Polish & E2E Testing

> **Read this before writing any code.**

## What Was Completed (Session 11 — Phase 10: Notifications & Preferences)

Session 11 completed the entire Phase 10 (Tasks 69–75), delivering the Preferences section, Go notification provider, expanded guided tour, and final portal wiring.

### Backend (Go)

**Notification Provider (Task 73)** — `platform/dataaccess/notify/`
- `NotificationProvider` interface: `Send`, `GetStatus`
- `ConsoleProvider` — dev adapter with in-memory store, structured logging, thread-safe
- Same interface+adapter pattern as ECM (`platform/dataaccess/ecm/`)
- 8 tests

### Frontend (React)

**PreferencesSection (Tasks 69–72)** — `frontend/src/components/portal/preferences/`
- 3-tab container: Communication, Accessibility, Security
- Communication: notification type × channel matrix driven by plan-profile.yaml, legally required items enforced, SMS opt-in
- Accessibility: text size (Standard/Larger/Largest), high contrast toggle, reduce motion toggle, live CSS custom properties
- Security: Clerk-delegated password, 2FA, active sessions, account activity
- `useMemberPreferences` hook for member preferences CRUD
- 23 component tests

**Guided Tour (Task 74)** — `frontend/src/components/portal/tour/tourSteps.ts`
- Expanded to 4 common steps + persona-specific steps (8 active, 7 retiree, 6 inactive, 6 beneficiary)
- CURRENT_TOUR_VERSION bumped to 2
- 7 tour step tests

**Portal Wiring (Task 75)**
- Preferences added to sidebar (all personas) and MemberPortal section router

### Test Results
- Go dataaccess: 85 tests passing (api 69 + ecm 8 + notify 8)
- Frontend: 197 test files, 1,560 tests passing, zero failures

## What's Next — Phase 11: Polish & E2E Testing (Final Phase)

This is the **last phase** of the portal redesign. Focus areas:

### 1. Cross-Section Navigation Testing
- Verify every sidebar nav item routes to a working section
- Verify persona filtering: active members don't see retiree-only items and vice versa
- Verify multi-persona members (e.g., inactive + beneficiary) see correct nav items
- Test collapsed sidebar navigation

### 2. Accessibility Audit
- Verify all interactive elements have proper ARIA labels
- Test keyboard navigation through sidebar, tabs, and forms
- Verify focus management on tab switches
- Test with high contrast and reduced motion preferences applied
- Screen reader compatibility check (role, aria-current, aria-label attributes)

### 3. Error State Polish
- Verify graceful degradation when API is unavailable (demo data fallback)
- Loading states for all async operations
- Empty states for sections with no data
- Error boundaries for component failures

### 4. Tour Completion Flow
- Verify tour triggers for new users (tourCompleted=false)
- Verify tour re-triggers on version bump (tourVersion < CURRENT_TOUR_VERSION)
- Verify tour skip and completion callbacks persist state
- Test tour with each persona to verify correct step counts

### 5. Visual Consistency
- Verify design system usage: C, BODY, DISPLAY from designSystem
- Consistent spacing, border treatments, card patterns across all sections
- Responsive behavior at different viewport widths

### 6. E2E Test Suite
- Write integration tests covering multi-section navigation flows
- Test full preference save/load cycle
- Test document upload → checklist update flow
- Test notification matrix toggle → save → reload persistence

### Key Patterns to Follow

- **Frontend test pattern:** Mock hooks at component level, mock API at fetch layer
- **Existing test helpers:** `renderWithProviders` in `frontend/src/test/helpers.tsx`
- **Design system:** `C`, `BODY`, `DISPLAY` from `@/lib/designSystem`

### Important Context

- All 10 phases of feature development are complete — Phase 11 is pure quality assurance
- The portal has 197 test files with 1,560 tests — add to this, don't rewrite
- All sidebar sections now have working implementations — no more "coming soon" placeholders
- The `useMemberPreferences` hook handles optimistic updates via `setQueryData` on mutation success
- Tour version 2 means all returning members will see the updated tour on next visit
