# Universal Drill-Down Overlays — Design

**Date:** 2026-03-13
**Scope:** 5 new detail overlays + refactor 2 existing overlays into shared shell
**Cards affected:** CorrespondenceHistoryCard, BeneficiaryCard, DataQualityCard, CommitmentTracker, OutreachQueue

---

## Decision Summary

| Decision | Choice |
|----------|--------|
| Which cards get overlays? | All 5 with repeating records (skip ActiveWorkCard — cases already navigate to workflow) |
| Architecture | Shared `DetailOverlay` shell component — each card provides content render |
| Actions in overlays? | Yes — inline mutation actions per record type |
| Refactor existing overlays? | Yes — unify InteractionDetailPanel + ConversationDetailOverlay under shared shell |
| Search/filter on cards? | Yes — Correspondence, CommitmentTracker, OutreachQueue, DataQualityCard (severity filter) |

---

## 1. Shared DetailOverlay Shell

New component: `frontend/src/components/DetailOverlay.tsx`

**Responsibilities:**
- Fixed backdrop (`bg-black/30`, click-to-close)
- `useSpawnAnimation` hook for spawn-from-source animation (350ms cubic-bezier)
- Header: icon slot, title, subtitle, status badge slot, prev/next navigation + "X of Y" counter, close button
- Keyboard: Escape (close), ArrowLeft/Right (navigate)
- Scrollable body (`overflow-y-auto flex-1`)
- Optional footer slot for action buttons

**Props interface:**
```typescript
interface DetailOverlayProps {
  sourceRect: DOMRect;
  onClose: () => void;
  // Navigation
  totalItems?: number;
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
  // Header content
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  // Slots
  footer?: ReactNode;
  children: ReactNode;
}
```

**Shared sub-components (also exported):**
- `MetadataGrid` — responsive 2-4 column grid of `{label, value}` pairs
- `Section` — titled content section (all-caps small header + children)
- `StatusBadge` — configurable color-map badge (`{[status]: colorClasses}`)

---

## 2. Five New Detail Content Components

### CorrespondenceDetail

**Fields:** Subject, status, template ID, sentAt, sentVia, deliveryAddress, generatedBy, mergeData (key/value table), bodyRendered preview (truncated).

**Actions:** Resend, Void

### BeneficiaryDetail

**Fields:** Full name, relationship, beneficiary type (primary/contingent), allocation %, DOB with computed age, effective date, end date.

**Actions:** None (read-only — no mutation API exists)

### DQIssueDetail

**Fields:** Description, severity, field name, current value vs expected pattern, record table + record ID, status, resolved timestamp, resolved by, resolution note.

**Actions:** Acknowledge, Resolve (with note text input), Mark False Positive

### CommitmentDetail

**Fields:** Description, target date, owner agent + team, status, related interaction ID, related conversation ID, alert config (days before, sent?), fulfillment info (fulfilledAt, fulfilledBy, fulfillmentNote).

**Actions:** Fulfill (with note text input), Cancel

### OutreachDetail

**Fields:** Subject, talking points (rendered as markdown or preformatted), trigger type + detail, priority, assigned agent + team, attempt count / max attempts, last attempt timestamp, scheduled date, due date, result outcome.

**Actions:** Log Attempt, Complete, Defer

---

## 3. Refactor Existing Overlays

### InteractionDetailPanel (~316 lines → ~150 lines)

Extract backdrop, animation, keyboard nav, and header into `DetailOverlay`. Keep interaction-specific body content: metadata grid (channel, direction, type, duration, outcome, agent), summary section, notes list (NoteCard sub-component), commitments list (CommitmentCard sub-component).

### ConversationDetailOverlay (~150 lines → ~50 lines)

Extract backdrop, animation, keyboard nav, and header into `DetailOverlay`. The body remains: `<ConversationPanel conversationId={id} />`.

---

## 4. Card Wiring

Each card with repeating records gets:
1. `selectedIndex` state (number | null)
2. Click handler on each row that captures `DOMRect` via `getBoundingClientRect()` and sets selected index
3. Conditional render of `<DetailOverlay>` with the appropriate detail content component

| Card | State | Overlay Content |
|------|-------|----------------|
| CorrespondenceHistoryCard | `selectedCorrespondenceIdx` | `<CorrespondenceDetail>` |
| BeneficiaryCard | `selectedBeneficiaryIdx` | `<BeneficiaryDetail>` |
| DataQualityCard | `selectedIssueIdx` | `<DQIssueDetail>` |
| CommitmentTracker | `selectedCommitmentIdx` | `<CommitmentDetail>` |
| OutreachQueue | `selectedOutreachIdx` | `<OutreachDetail>` |

---

## 5. Search/Filter Additions

Following the InteractionHistoryCard pattern (live search input with "X of Y matching" badge):

| Card | Search | Filter |
|------|--------|--------|
| CorrespondenceHistoryCard | Subject text search | Status dropdown (draft/final/sent/void) |
| CommitmentTracker | Description text search | (already sorted by status) |
| OutreachQueue | Subject text search | Status dropdown |
| DataQualityCard | — | Severity filter (critical/warning/info) |
| BeneficiaryCard | — | Skip (typically 1-4 records) |

---

## 6. File Inventory

| File | Action | Est. Lines |
|------|--------|-----------|
| `components/DetailOverlay.tsx` | **New** | ~120 |
| `components/detail/CorrespondenceDetail.tsx` | **New** | ~80 |
| `components/detail/BeneficiaryDetail.tsx` | **New** | ~60 |
| `components/detail/DQIssueDetail.tsx` | **New** | ~90 |
| `components/detail/CommitmentDetail.tsx` | **New** | ~80 |
| `components/detail/OutreachDetail.tsx` | **New** | ~90 |
| `components/dashboard/InteractionDetailPanel.tsx` | **Refactor** | ~316→~150 |
| `components/ConversationDetailOverlay.tsx` | **Refactor** | ~150→~50 |
| `components/dashboard/CorrespondenceHistoryCard.tsx` | **Modify** | +click, +search/filter, +overlay |
| `components/dashboard/BeneficiaryCard.tsx` | **Modify** | +click, +overlay |
| `components/dashboard/DataQualityCard.tsx` | **Modify** | +click, +severity filter, +overlay |
| `components/CommitmentTracker.tsx` | **Modify** | +click, +search, +overlay |
| `components/OutreachQueue.tsx` | **Modify** | +click, +search, +overlay |

**Total: 6 new files, 7 modified files.**

---

## 7. Testing Strategy

- Existing 262 tests must continue passing (refactored overlays maintain identical behavior)
- New tests per detail component: render with data, render empty state, action button clicks
- Navigation tests: prev/next, keyboard, close
- Search/filter tests on modified cards
