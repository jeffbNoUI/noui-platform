# Phase 9 Session 10 Starter — Documents (continued)

> **Read this before writing any code.**

## What Was Completed (Session 9 — Task 66)

Task 66 delivered the **FileUpload shared component**, replacing the old `DocumentUploader` with a more capable reusable component.

### FileUpload (`frontend/src/components/portal/shared/FileUpload.tsx`)

- **Full mode:** Drag-and-drop zone with click-to-browse, dashed border with hover highlight
- **Compact mode:** Inline button (drop-in replacement for old DocumentUploader)
- **Client-side validation:** File extension check + size check, inline error display
- **Progress bar:** Controlled via `progress` prop, shown in both full and compact modes
- **Uploaded state:** Green checkmark confirmation with filename
- **Error state:** Supports both validation errors and external `errorMessage` prop
- **Default formats:** PDF, JPG, JPEG, PNG, TIFF, HEIC, DOC, DOCX, XLS, XLSX; max 25MB
- 11 tests

### Migration
- `UploadDocsStage.tsx` migrated from `DocumentUploader` → `FileUpload` with `compact={true}`
- `DocumentUploader.tsx` deleted (fully replaced)
- Zero test regressions — test IDs are compatible (`upload-btn-{id}` pattern preserved)

### Test Results
- 188 test files, **1,501 tests passing**, zero failures

## What's Next — Remaining Phase 9 Tasks

| Task | Component | Layer | Status |
|------|-----------|-------|--------|
| 66 | FileUpload (shared) | Frontend | **Done** |
| 67 | ECM Integration | Backend (Go) | Next |
| 68 | Document endpoints | Backend (Go) | Blocked on 67 |
| 63 | DocumentSection shell | Frontend | Can parallel with 67 |
| 64 | DocumentChecklist | Frontend | Blocked on 66 (done) + 68 |
| 65 | DocumentArchive | Frontend | Blocked on 68 |

### Recommended Execution Order

```
Task 67 (ECM interface — Go backend, independent)
  ├── Task 68 (Document endpoints — depends on ECM)
  └── Task 63 (Document section shell — can parallel with 67/68)
        → Task 64 (Document checklist — uses FileUpload + backend)
        → Task 65 (Document archive — uses backend listing)
```

**Recommendation:** Start with Task 67 (ECM Integration) since it's the first Go backend work in the portal redesign. Task 63 (DocumentSection shell) can run in parallel if desired.

### Task 67: ECM Integration — Key Details

**What to build:**
- Go interface `ECMProvider` with `Ingest`, `Retrieve`, `Delete` methods
- Local filesystem adapter for dev/testing (production adapters added per-client later)
- Location: `platform/dataaccess/ecm/`

**Interface:**
```go
type ECMProvider interface {
    Ingest(ctx context.Context, file []byte, metadata DocumentMetadata) (string, error)
    Retrieve(ctx context.Context, ref string) (string, error)  // returns signed URL
    Delete(ctx context.Context, ref string) error
}
```

**Test approach:** Go unit tests with `httptest` — test local adapter stores/retrieves/deletes files.

**Design docs:**
- `docs/plans/2026-03-17-member-portal-redesign-design.md` — Section 13
- `docs/plans/2026-03-17-member-portal-redesign-plan.md` — Tasks 67-68

### Task 63: DocumentSection Shell — Key Details

**What to build:**
- Container component with 2-tab view: "My Checklist" + "All Documents"
- Location: `frontend/src/components/portal/documents/DocumentSection.tsx`
- Pattern: Same tab pattern as `MessagesSection.tsx` (3-tab router)
- Wire into `MemberPortal.tsx` sidebar navigation

**Test approach:** Unit tests for tab switching, renders correct child per tab.

### Key Patterns to Follow

- **Go handler pattern:** `serveWithPathValue` in tests, `validation.Errors` for input
- **Go test pattern:** `httptest.NewRecorder` + `sqlmock`
- **Frontend test pattern:** `vi.mock` + `renderWithProviders` or plain `render`
- **Design system:** `C`, `BODY`, `DISPLAY` from `@/lib/designSystem`
