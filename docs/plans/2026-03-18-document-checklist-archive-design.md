# Document Checklist & Archive Design

**Date:** 2026-03-18
**Tasks:** 64 (DocumentChecklist), 65 (DocumentArchive)
**Layer:** Frontend (React)

## Context

The DocumentSection shell (Task 63) provides a two-tab container: "My Checklist" and "All Documents." This design fills in both tabs with functional components that use the FileUpload shared component (Task 66) and the document backend endpoints (Task 68).

## Task 64: DocumentChecklist

### Data Sources

Two inputs merged into a unified checklist:

1. **Rules** — `getDocumentChecklist(context, memberData)` from plan profile YAML. Returns which documents are required for the member's situation.
2. **Existing uploads** — `documentAPI.list(memberId)` from backend. Returns what the member has already uploaded.

### Context Mapping

The member's status determines which checklist context applies:

| Member Status | Context | Typical Documents |
|--------------|---------|-------------------|
| ACTIVE | retirement_application | Proof of age, direct deposit, W-4P, marriage cert (if married) |
| INACTIVE | refund_application | Proof of age, direct deposit |
| BENEFICIARY | survivor_claim | Death certificate, beneficiary proof of age |

Pure function: `statusToContext(memberStatus: string): string`

### Hook: useDocumentChecklist

```typescript
interface ChecklistItem {
  rule: DocumentChecklistRule;
  status: 'outstanding' | 'received';
  upload?: DocumentUpload;  // present when received
}

function useDocumentChecklist(memberId: string, memberStatus: string, memberData: Record<string, unknown>)
  => { items: ChecklistItem[], outstanding: number, received: number, isLoading: boolean, uploadDocument: (rule, file) => Promise<void> }
```

- Calls `documentAPI.list()` via react-query key `['member-documents', memberId]`
- Matches uploads to rules by `document_type`
- Provides `uploadDocument` mutation that calls `documentAPI.upload()` then invalidates cache

### Component: DocumentChecklist

Two sections:
- **Outstanding** — Each item shows: label, "Needed for: {context}", accepted formats, FileUpload (compact mode) per item
- **Received** — Each item shows: green checkmark, label, filename, upload date

Upload flow per item: user selects file → FileUpload validates client-side → calls `uploadDocument(rule, file)` → progress bar → success or error.

## Task 65: DocumentArchive

### Data Source

Same `documentAPI.list(memberId)` query (shared cache with checklist).

### Grouping

Documents grouped into three categories:
- **Documents You Uploaded** — member-uploaded files
- **Documents From Plan** — statements, letters, 1099-Rs (uploaded_by != 'portal')
- **DRO Court Orders** — document_type contains 'dro'

### Per-Row Display

| Column | Content |
|--------|---------|
| Name | filename |
| Type | document_type label |
| Date | uploaded_at formatted |
| Status | received / processing badge |
| Action | Download link (calls GET /documents/{id}/download) |

**Security rule:** DRO documents show "Request Copy" button instead of download link. Member can request copies through Messages.

### Filtering

Type filter dropdown to narrow by document_type. Optional date range filter (YAGNI for now — omit unless needed).

## Files

### Create
- `frontend/src/components/portal/documents/DocumentChecklist.tsx`
- `frontend/src/components/portal/documents/DocumentArchive.tsx`
- `frontend/src/hooks/useDocumentChecklist.ts`
- `frontend/src/components/portal/documents/__tests__/DocumentChecklist.test.tsx`
- `frontend/src/components/portal/documents/__tests__/DocumentArchive.test.tsx`

### Modify
- `frontend/src/components/portal/documents/DocumentSection.tsx` — replace placeholders with real components
- `frontend/src/components/portal/documents/__tests__/DocumentSection.test.tsx` — update tests
- `frontend/src/lib/memberPortalApi.ts` — add `member_id` query param to upload, add download method

## Test Strategy

Mock at fetch/network layer (per project memory). Tests verify:
- Checklist renders outstanding vs received items correctly
- Upload triggers API call and shows progress
- Archive groups documents into categories
- DRO documents show "Request Copy" instead of download
- Empty states display correctly
- Filter narrows displayed documents
