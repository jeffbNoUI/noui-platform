# Phase 10 Session 11 Starter — Notifications & Preferences

> **Read this before writing any code.**

## What Was Completed (Session 10 — Phase 9: Documents)

Session 10 completed the entire Documents phase (Tasks 63–68), delivering a full document pipeline from plan profile rules through ECM storage to the archive UI.

### Backend (Go)

**ECM Integration (Task 67)** — `platform/dataaccess/ecm/`
- `ECMProvider` interface: `Ingest`, `Retrieve`, `Delete`
- Local filesystem adapter for dev/testing (production adapters added per-client)
- 8 tests

**Document Endpoints (Task 68)** — `platform/dataaccess/api/document_handlers.go`
- `POST /api/v1/issues/{id}/documents` — multipart upload → ECM ingest → DB metadata
- `GET /api/v1/issues/{id}/documents` — list documents on an issue
- `GET /api/v1/documents/{id}/download` — get URL/path from ECM
- `GET /api/v1/members/{id}/documents` — all documents for a member
- Handler struct extended with ECM provider dependency
- 13 tests (sqlmock + local ECM adapter)

### Frontend (React)

**DocumentSection Shell (Task 63)** — Two-tab container: "My Checklist" + "All Documents"
- 4 tests

**DocumentChecklist (Task 64)**
- `useDocumentChecklist` hook: merges plan profile rules with existing uploads via react-query
- `statusToContext()`: maps ACTIVE→retirement_application, INACTIVE→refund_application, DECEASED→death_notification
- Outstanding items render FileUpload (compact) per item; received items show checkmark + filename
- 9 component tests + 6 hook tests

**DocumentArchive (Task 65)**
- Categorized view: "Documents You Uploaded", "Documents From Plan", "DRO Court Orders"
- Type filter dropdown, download via ECM signed URL
- DRO security rule: "Request Copy" instead of download button
- 9 tests

### Test Results
- Go dataaccess: 77 tests passing (api 69 + ecm 8)
- Frontend: 192 test files, 1,530 tests passing, zero failures

## What's Next — Phase 10: Notifications & Preferences (Tasks 69–75)

| Task | Component | Layer | Dependencies |
|------|-----------|-------|-------------|
| 69 | PreferencesSection shell | Frontend | None |
| 70 | Communication Preferences | Frontend | usePreferences hook (exists) |
| 71 | Accessibility Preferences | Frontend | New: accessibilityTheme.ts |
| 72 | Security Preferences | Frontend | Clerk components |
| 73 | Notification Provider Interface | Backend (Go) | None |
| 74 | Guided Tour Content | Frontend | Existing tour framework |
| 75 | Wire All Remaining Sections | Frontend | 69–74 complete |

### Recommended Execution Order

```
Task 69 (Preferences shell — independent, fast)
  ├── Task 70 (Communication prefs — uses existing usePreferences)
  ├── Task 71 (Accessibility prefs — new CSS custom properties theme)
  └── Task 72 (Security prefs — Clerk wrappers)
Task 73 (Go notification provider — independent of frontend)
Task 74 (Tour content — independent)
Task 75 (Final wiring — depends on 69–74)
```

Tasks 69 and 73 can run in parallel (different layers).

### Task 69: Preferences Section Shell — Key Details

**What to build:**
- Container component with 3 sub-tabs: Communication, Accessibility, Security
- Location: `frontend/src/components/portal/preferences/PreferencesSection.tsx`
- Pattern: Same tab pattern as `DocumentSection.tsx` and `MessagesSection.tsx`
- Wire into `MemberPortal.tsx` sidebar navigation

### Task 70: Communication Preferences — Key Details

**What to build:**
- Notification type × channel matrix (In-portal always on, email/SMS toggleable)
- Legally required items shown as always-on per plan profile config
- SMS number input with opt-in confirmation
- Uses existing `useMemberPreferences` hook pattern (see `usePreferences.ts`)

### Task 73: Notification Provider Interface — Key Details

**What to build:**
- Go interface: `Send(recipient, template, data) -> DeliveryResult`
- Console adapter for dev (logs to stdout, stores in table)
- Location: `platform/dataaccess/notify/`
- Pattern: Same interface+adapter pattern as ECM (`platform/dataaccess/ecm/`)

### Key Patterns to Follow

- **Frontend test pattern:** Mock hooks at component level, mock API at fetch layer
- **Go handler pattern:** `serveWithPathValue` in tests, `validation.Errors` for input, `sqlmock` for DB
- **Design system:** `C`, `BODY`, `DISPLAY` from `@/lib/designSystem`
- **Plan profile:** Preferences config lives in `plan-profile.yaml`, accessed via `getPlanProfile()`

### Important Context

- The `usePreferences` hook already exists and handles GET/PUT for member preferences
- The tour framework exists in `frontend/src/components/portal/tour/` but tour content (stops per persona) hasn't been defined yet
- Task 75 (final wiring) is where ALL remaining sections get connected to the sidebar navigation — verify persona visibility filtering works correctly
- After Phase 10, only Phase 11 (Polish & E2E Testing) remains
