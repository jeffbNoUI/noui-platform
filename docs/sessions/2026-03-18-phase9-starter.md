# Phase 9 Session Starter — Documents

> **Read this before writing any code.**

## What Was Completed (Phase 8 — Messages & Activity)

Phase 8 delivered the full Messages & Activity section with 7 commits, 14 new files, 52 new tests (1490 total passing).

### Frontend (6 tasks, 14 new files, 2 modified)

- **ActivityTracker** (`frontend/src/components/portal/activity/`)
  - `useActivityTracker` hook: normalizes CRM conversations + issues into unified `ActivityItem[]`
  - Urgency classification: Action Needed / In Progress / Completed
  - `ActivityItem` + `ActivityTracker` components with grouped buckets
  - 10 tests

- **Secure Messaging** (`frontend/src/components/portal/messages/`)
  - `MessageList`: conversation list with unread indicators, sorted by last activity
  - `MessageThread`: chronological chat bubbles with reply input
  - `ComposeMessage`: new conversation form with subject + body (no attachments — deferred to Phase 9 FileUpload)
  - 19 tests

- **Interaction History** (`frontend/src/components/portal/messages/InteractionHistory.tsx`)
  - Read-only timeline filtered to public-visibility entries
  - Channel filter dropdown (phone, email, mail, portal message, walk-in)
  - 8 tests

- **MessagesSection** — 3-tab router (Activity / Messages / History) wired into MemberPortal
  - 6 tests

- **NotificationBell** (`frontend/src/components/portal/shared/NotificationBell.tsx`)
  - `useNotifications` hook: badge count from active conversations
  - Bell icon with red badge (9+ cap), dropdown with recent items, click-outside close
  - Wired into MemberPortal header
  - 9 tests

### Key Decisions
1. Task 62 backend deferred — existing CRM APIs sufficient
2. No file attachments in ComposeMessage — deferred to Phase 9 FileUpload (Task 66)
3. Activity aggregation uses unified feed with urgency buckets, normalized across all sources

### Known Issues (non-blocking)
- None from Phase 8. Code review passed clean.

## What's Next — Phase 9: Documents (Tasks 63–68)

Phase 9 builds the Documents portal section. This is the first phase with both frontend AND backend work (ECM integration).

### Tasks

| Task | Component | Layer | Description |
|------|-----------|-------|-------------|
| 63 | DocumentSection shell | Frontend | 2-tab view: My Checklist + All Documents |
| 64 | DocumentChecklist | Frontend | Dynamic checklist from member context, upload per item |
| 65 | DocumentArchive | Frontend | Chronological archive filterable by type/date |
| 66 | FileUpload (shared) | Frontend | Reusable drag-and-drop with validation, progress, HEIC support |
| 67 | ECM Integration | Backend (Go) | `Ingest/Retrieve/Delete` interface + local filesystem adapter |
| 68 | Document endpoints | Backend (Go) | Upload (multipart), download (signed URL), listing |

### Execution Order

```
Task 66 (FileUpload — shared component, needed by others)
  → Task 67 (ECM interface — backend, independent of frontend)
  → Task 68 (Document endpoints — depends on ECM)
  → Task 63 (Document section shell)
  → Task 64 (Document checklist — uses FileUpload + backend)
  → Task 65 (Document archive — uses backend listing)
```

**Recommendation:** Start with Task 66 (FileUpload) since ComposeMessage from Phase 8 is already waiting for it. Then Task 67+68 (backend) can run in parallel with Task 63 (shell).

### Key Patterns to Follow

- **FileUpload reuse points:** document upload, flag-issue evidence, direct deposit voided check (Phase 10+)
- **ECM interface pattern:** Go interface with local adapter for dev. Production adapter added later per client.
- **Go handler pattern:** `serveWithPathValue` in tests, `validation.Errors` for input validation, multipart form parsing
- **Test pattern:** Frontend uses `vi.mock` + `renderWithProviders`. Go uses `httptest.NewRecorder` + `sqlmock`.

### Design Doc Reference

`docs/plans/2026-03-17-member-portal-redesign-design.md` — Section 13: Document Management
`docs/plans/2026-03-17-member-portal-redesign-plan.md` — Tasks 63–68
