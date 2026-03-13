# Universal Drill-Down Overlays — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add drill-down detail overlays to all 5 cards with repeating records, unify existing overlays under a shared shell, and add search/filter to 4 cards.

**Architecture:** Extract a shared `<DetailOverlay>` component from the duplicated backdrop/animation/navigation code in InteractionDetailPanel and ConversationDetailOverlay. Each card type provides a content render component. Existing overlays are refactored to use the shell. New overlays follow the same pattern.

**Tech Stack:** React + TypeScript, useSpawnAnimation hook (existing), Tailwind CSS, Vitest + @testing-library/react

---

### Task 1: Create shared DetailOverlay shell + sub-components

**Files:**
- Create: `frontend/src/components/DetailOverlay.tsx`
- Create: `frontend/src/components/__tests__/DetailOverlay.test.tsx`

**Step 1: Write the test file**

Create `frontend/src/components/__tests__/DetailOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DetailOverlay, { MetadataGrid, Section, StatusBadge } from '../DetailOverlay';

// Mock useSpawnAnimation to skip real animations
vi.mock('@/hooks/useSpawnAnimation', () => ({
  useSpawnAnimation: () => ({
    panelRef: { current: null },
    isVisible: true,
    phase: 'open',
    open: vi.fn(),
    close: vi.fn(),
    style: { transform: 'none', opacity: 1, transition: 'none' },
    DURATION_MS: 0,
  }),
}));

const baseProps = {
  sourceRect: new DOMRect(100, 200, 600, 40),
  onClose: vi.fn(),
  title: 'Test Panel',
};

describe('DetailOverlay', () => {
  it('renders title and children', () => {
    renderWithProviders(
      <DetailOverlay {...baseProps}>
        <p>Body content</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    renderWithProviders(
      <DetailOverlay {...baseProps} icon={<span data-testid="icon">📧</span>}>
        <p>Content</p>
      </DetailOverlay>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    renderWithProviders(
      <DetailOverlay {...baseProps} subtitle="Some subtitle">
        <p>Content</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('Some subtitle')).toBeInTheDocument();
  });

  it('renders status badge slot', () => {
    renderWithProviders(
      <DetailOverlay {...baseProps} statusBadge={<span>Active</span>}>
        <p>Content</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    renderWithProviders(
      <DetailOverlay {...baseProps} footer={<button>Action</button>}>
        <p>Content</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('shows navigation arrows when items/currentIndex/onNavigate provided', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <DetailOverlay
        {...baseProps}
        totalItems={5}
        currentIndex={2}
        onNavigate={onNavigate}
      >
        <p>Content</p>
      </DetailOverlay>,
    );
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
    expect(screen.getByTitle('Previous (←)')).not.toBeDisabled();
    expect(screen.getByTitle('Next (→)')).not.toBeDisabled();
  });

  it('disables prev button at first item', () => {
    renderWithProviders(
      <DetailOverlay {...baseProps} totalItems={3} currentIndex={0} onNavigate={vi.fn()}>
        <p>Content</p>
      </DetailOverlay>,
    );
    expect(screen.getByTitle('Previous (←)')).toBeDisabled();
  });

  it('disables next button at last item', () => {
    renderWithProviders(
      <DetailOverlay {...baseProps} totalItems={3} currentIndex={2} onNavigate={vi.fn()}>
        <p>Content</p>
      </DetailOverlay>,
    );
    expect(screen.getByTitle('Next (→)')).toBeDisabled();
  });

  it('calls onNavigate on arrow button clicks', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <DetailOverlay {...baseProps} totalItems={5} currentIndex={2} onNavigate={onNavigate}>
        <p>Content</p>
      </DetailOverlay>,
    );
    fireEvent.click(screen.getByTitle('Next (→)'));
    expect(onNavigate).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByTitle('Previous (←)'));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('navigates on ArrowLeft/ArrowRight keys', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <DetailOverlay {...baseProps} totalItems={5} currentIndex={2} onNavigate={onNavigate}>
        <p>Content</p>
      </DetailOverlay>,
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith(3);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('calls close on Escape key', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <DetailOverlay {...baseProps} onClose={onClose}>
        <p>Content</p>
      </DetailOverlay>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    // onClose is called after animation timeout — verify handler was registered
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
  });

  it('calls close on backdrop click', () => {
    const { container } = renderWithProviders(
      <DetailOverlay {...baseProps}>
        <p>Content</p>
      </DetailOverlay>,
    );
    const backdrop = container.querySelector('.bg-black\\/30');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
  });
});

describe('MetadataGrid', () => {
  it('renders label-value pairs', () => {
    renderWithProviders(
      <MetadataGrid fields={[
        { label: 'Status', value: 'Active' },
        { label: 'Type', value: 'Primary' },
      ]} />,
    );
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('skips fields with null/undefined values', () => {
    renderWithProviders(
      <MetadataGrid fields={[
        { label: 'Present', value: 'yes' },
        { label: 'Missing', value: undefined },
      ]} />,
    );
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  });
});

describe('Section', () => {
  it('renders title and children', () => {
    renderWithProviders(
      <Section title="My Section"><p>Section body</p></Section>,
    );
    expect(screen.getByText('My Section')).toBeInTheDocument();
    expect(screen.getByText('Section body')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('renders label with correct styling', () => {
    const colorMap = { active: 'bg-green-100 text-green-800' };
    renderWithProviders(<StatusBadge status="active" colorMap={colorMap} />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('falls back to gray for unknown status', () => {
    renderWithProviders(<StatusBadge status="unknown" colorMap={{}} />);
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/__tests__/DetailOverlay.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the DetailOverlay component**

Create `frontend/src/components/DetailOverlay.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react';
import { useSpawnAnimation } from '@/hooks/useSpawnAnimation';

// ─── Exported sub-components ────────────────────────────────────────────────

interface MetadataField {
  label: string;
  value: string | undefined | null;
}

export function MetadataGrid({ fields }: { fields: MetadataField[] }) {
  const visible = fields.filter((f) => f.value != null);
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {visible.map((f) => (
        <div key={f.label}>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
            {f.label}
          </div>
          <div className="text-sm text-gray-800 capitalize mt-0.5">{f.value}</div>
        </div>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

export function StatusBadge({
  status,
  colorMap,
}: {
  status: string;
  colorMap: Record<string, string>;
}) {
  const colors = colorMap[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Main overlay shell ─────────────────────────────────────────────────────

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

export default function DetailOverlay({
  sourceRect,
  onClose,
  totalItems,
  currentIndex,
  onNavigate,
  icon,
  title,
  subtitle,
  statusBadge,
  footer,
  children,
}: DetailOverlayProps) {
  const { panelRef, isVisible, style, open, close } = useSpawnAnimation();

  const canNavigate = totalItems != null && currentIndex != null && onNavigate;
  const hasPrev = canNavigate && currentIndex > 0;
  const hasNext = canNavigate && currentIndex < totalItems - 1;

  const handleClose = () => {
    close();
    setTimeout(onClose, 350);
  };

  useEffect(() => {
    open(sourceRect);
  }, [open, sourceRect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        onNavigate!(currentIndex! - 1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onNavigate!(currentIndex! + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        style={{ opacity: style.opacity, transitionDuration: '350ms' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-[55vw] max-w-3xl max-h-[70vh] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        style={{ ...style, transformOrigin: 'center center' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <span className="text-2xl shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>
              {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {statusBadge}
            {canNavigate && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => hasPrev && onNavigate!(currentIndex! - 1)}
                  disabled={!hasPrev}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
                  title="Previous (←)"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-400 tabular-nums min-w-[4rem] text-center">
                  {currentIndex! + 1} of {totalItems}
                </span>
                <button
                  onClick={() => hasNext && onNavigate!(currentIndex! + 1)}
                  disabled={!hasNext}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
                  title="Next (→)"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none p-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className="border-t border-gray-200 px-6 py-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/__tests__/DetailOverlay.test.tsx`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add frontend/src/components/DetailOverlay.tsx frontend/src/components/__tests__/DetailOverlay.test.tsx
git commit -m "[frontend] Add shared DetailOverlay shell with MetadataGrid, Section, StatusBadge"
```

---

### Task 2: Refactor InteractionDetailPanel to use DetailOverlay

**Files:**
- Modify: `frontend/src/components/dashboard/InteractionDetailPanel.tsx`

**Step 1: Refactor InteractionDetailPanel**

Replace the entire file. Keep the interaction-specific body content (metadata grid, summary, notes, commitments). Delegate backdrop, animation, keyboard nav, header to `<DetailOverlay>`.

The component keeps:
- `usePortalInteraction(interactionId)` hook call
- Channel icon/label resolution via `channelMeta`
- Metadata grid fields (Direction, Type, Duration, Agent, Category, Queue, Wrap-up, Linked Case)
- Summary, Notes, Commitments sections
- NoteCard and CommitmentCard sub-components
- Empty state
- `formatFullDate` and `formatDuration` helpers

The component loses:
- `useSpawnAnimation` hook call (moved to DetailOverlay)
- Backdrop div, panel container div, header with nav arrows, keyboard listener

New structure wraps body content inside `<DetailOverlay>`, passing:
- `icon={<span>{channelIcon}</span>}`
- `title={channelLabel}`
- `subtitle={formatFullDate(entry.startedAt)}`
- `statusBadge` with outcome label
- Navigation props: `totalItems={entries?.length}`, `currentIndex`, `onNavigate`

Use `MetadataGrid` from DetailOverlay for the metadata grid (replaces inline `MetaField` component).
Use `Section` from DetailOverlay for section titles (replaces inline `Section` component).

**Step 2: Run existing InteractionDetailPanel tests to verify no regressions**

Run: `cd frontend && npx vitest run src/components/dashboard/__tests__/InteractionDetailPanel.test.tsx`
Expected: ALL 17 PASS

Note: The test file mocks `@/hooks/useSpawnAnimation` — this still works because DetailOverlay imports from the same path.

**Step 3: Run full test suite**

Run: `cd frontend && npm test -- --run`
Expected: 262+ PASS

**Step 4: Commit**

```bash
git add frontend/src/components/dashboard/InteractionDetailPanel.tsx
git commit -m "[frontend] Refactor InteractionDetailPanel to use shared DetailOverlay shell"
```

---

### Task 3: Refactor ConversationDetailOverlay to use DetailOverlay

**Files:**
- Modify: `frontend/src/components/ConversationDetailOverlay.tsx`

**Step 1: Refactor ConversationDetailOverlay**

Replace the entire file. Keep conversation-specific header content (status badge, interaction count, SLA). Delegate shell to `<DetailOverlay>`.

Pass to DetailOverlay:
- `icon={<span>💬</span>}`
- `title={subject}` (from `currentConv?.subject || 'Untitled Conversation'`)
- `subtitle` with interaction count and SLA breach indicator
- `statusBadge` with conversation status
- Navigation props: `totalItems={conversations?.length}`, `currentIndex`, `onNavigate`

Body: `<ConversationPanel conversationId={conversationId} />`

**Step 2: Run full test suite**

Run: `cd frontend && npm test -- --run`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add frontend/src/components/ConversationDetailOverlay.tsx
git commit -m "[frontend] Refactor ConversationDetailOverlay to use shared DetailOverlay shell"
```

---

### Task 4: Add CorrespondenceDetail overlay + search/filter to CorrespondenceHistoryCard

**Files:**
- Create: `frontend/src/components/detail/CorrespondenceDetail.tsx`
- Create: `frontend/src/components/detail/__tests__/CorrespondenceDetail.test.tsx`
- Modify: `frontend/src/components/dashboard/CorrespondenceHistoryCard.tsx`

**Step 1: Write test**

Create `frontend/src/components/detail/__tests__/CorrespondenceDetail.test.tsx`:

Test cases:
- Renders subject as title
- Renders status badge (sent/draft/final/void)
- Renders metadata fields (Generated By, Template, Sent Via, etc.)
- Renders merge data section with key-value table
- Renders body preview section (plain text, HTML tags stripped)
- Renders navigation counter
- Renders draft item without sent date

Use `mockCorrespondence` from existing `fixtures.ts`.

Mock `useSpawnAnimation` same as other tests.

**Step 2: Create CorrespondenceDetail component**

Create `frontend/src/components/detail/CorrespondenceDetail.tsx`:

Uses `DetailOverlay`, `MetadataGrid`, `Section`, `StatusBadge` from `@/components/DetailOverlay`.

Fields displayed:
- Title: `item.subject`
- Icon: `📧`
- Subtitle: `Sent {date}` or `Created {date}`
- Status badge with color map: sent=emerald, final=blue, draft=gray, void=red
- Metadata: Status, Generated By, Template, Sent Via, Delivery Address, Case ID
- Merge Fields section: key-value table
- Body Preview section: render as plain text (strip HTML tags with `bodyRendered.replace(/<[^>]*>/g, '')`)

No inline actions for now (Resend/Void would need backend endpoints that don't exist yet — flag for later).

**Step 3: Wire CorrespondenceHistoryCard**

Modify `frontend/src/components/dashboard/CorrespondenceHistoryCard.tsx`:

Add imports: `useRef, useMemo` from react, `CorrespondenceDetail` from detail component.

Add state:
- `searchTerm: string` — filter input
- `selectedIdx: number | null` — which item is selected for overlay
- `sourceRect: DOMRect | null` — animation origin

Add `rowRefs` (Map<string, HTMLDivElement>) for capturing DOMRect on click.

Add search/filter logic (same pattern as InteractionHistoryCard):
- Filter `correspondence` by subject text match
- Show "X of Y matching" badge when searching
- Show all matches when searching, cap at `INITIAL_LIMIT` otherwise

Add click handler on each row:
- Capture `getBoundingClientRect()` from rowRef
- Set `selectedIdx` to the index in filtered list

Add `cursor-pointer hover:bg-gray-50 transition-colors` to rows.

Render `<CorrespondenceDetail>` overlay when `selectedIdx != null`.

**Step 4: Run tests**

Run: `cd frontend && npm test -- --run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add frontend/src/components/detail/CorrespondenceDetail.tsx frontend/src/components/detail/__tests__/CorrespondenceDetail.test.tsx frontend/src/components/dashboard/CorrespondenceHistoryCard.tsx
git commit -m "[frontend] Add CorrespondenceDetail overlay + search/filter to CorrespondenceHistoryCard"
```

---

### Task 5: Add BeneficiaryDetail overlay to BeneficiaryCard

**Files:**
- Create: `frontend/src/components/detail/BeneficiaryDetail.tsx`
- Create: `frontend/src/components/detail/__tests__/BeneficiaryDetail.test.tsx`
- Modify: `frontend/src/components/dashboard/BeneficiaryCard.tsx`

**Step 1: Write test**

Create fixture:
```tsx
const mockBeneficiary: Beneficiary = {
  bene_id: 1, member_id: 10001, bene_type: 'PRIMARY',
  first_name: 'Sarah', last_name: 'Martinez', relationship: 'Spouse',
  dob: '1965-08-15', alloc_pct: 100, eff_date: '2020-01-01',
};
```

Test cases:
- Renders full name as title
- Renders type badge (Primary)
- Renders relationship in metadata
- Renders allocation %
- Renders effective date
- Renders DOB with computed age
- Renders end date when present
- Navigation counter works

**Step 2: Create BeneficiaryDetail component**

Uses `DetailOverlay`, `MetadataGrid`, `StatusBadge`.

Fields:
- Title: `{first_name} {last_name}`
- Icon: `👤`
- Subtitle: `{relationship} · {alloc_pct}% allocation`
- Status badge: bene_type with color map (PRIMARY=blue, CONTINGENT=purple, DEATH_BENEFIT=gray)
- Metadata: Relationship, Allocation, Type, DOB (with age), Effective Date, End Date

Age computation: `Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))`

No actions (read-only).

**Step 3: Wire BeneficiaryCard**

Add `selectedIdx` + `sourceRect` state. Add click handler on beneficiary rows. Render `<BeneficiaryDetail>` overlay.

Add `cursor-pointer hover:bg-gray-50 transition-colors` to rows.

No search (typically 1-4 records).

**Step 4: Run tests, commit**

```bash
git add frontend/src/components/detail/BeneficiaryDetail.tsx frontend/src/components/detail/__tests__/BeneficiaryDetail.test.tsx frontend/src/components/dashboard/BeneficiaryCard.tsx
git commit -m "[frontend] Add BeneficiaryDetail overlay to BeneficiaryCard"
```

---

### Task 6: Add DQIssueDetail overlay + severity filter to DataQualityCard

**Files:**
- Create: `frontend/src/components/detail/DQIssueDetail.tsx`
- Create: `frontend/src/components/detail/__tests__/DQIssueDetail.test.tsx`
- Modify: `frontend/src/components/dashboard/DataQualityCard.tsx`
- Modify: `frontend/src/hooks/useDataQuality.ts` (add useUpdateDQIssue mutation if missing)

**Step 1: Check if useUpdateDQIssue exists**

Read: `frontend/src/hooks/useDataQuality.ts`

If no update mutation exists, add:
```tsx
export function useUpdateDQIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ issueId, req }: { issueId: string; req: { status: string; resolutionNote?: string } }) => {
      const resp = await fetch(`/api/v1/dataquality/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!resp.ok) throw new Error('Failed to update DQ issue');
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dq-issues'] });
      queryClient.invalidateQueries({ queryKey: ['dq-score'] });
    },
  });
}
```

**Step 2: Write test**

Use `mockDQIssues` from existing fixtures.ts + add resolved issue fixture.

Test cases:
- Renders description
- Renders severity badge (critical/warning/info)
- Renders field name
- Renders record table and record ID
- Renders current value and expected pattern when present
- Renders status
- Renders resolution info when resolved
- Action buttons: Acknowledge, Resolve (with note input), Mark False Positive
- Actions hidden for resolved/false_positive status

**Step 3: Create DQIssueDetail component**

Uses `DetailOverlay`, `MetadataGrid`, `Section`, `StatusBadge`.

Fields:
- Title: `item.description`
- Icon: severity-based emoji (critical=🔴, warning=🟡, info=🔵)
- Subtitle: `{fieldName} · {recordTable}:{recordId}`
- Status badge: severity with existing `SEVERITY_STYLES` color map
- Metadata: Status, Field Name, Record Table, Record ID, Current Value, Expected Pattern, Created At
- Resolution section (when resolved): resolvedAt, resolvedBy, resolutionNote

Footer actions:
- "Acknowledge" — calls `useUpdateDQIssue({ status: 'acknowledged' })`, visible when status is 'open'
- "Resolve" — text input for note + submit button, visible when status is 'open' or 'acknowledged'
- "False Positive" — calls `useUpdateDQIssue({ status: 'false_positive' })`, visible when status is 'open' or 'acknowledged'

**Step 4: Wire DataQualityCard**

Add severity filter: small dropdown/button group (All / Critical / Warning / Info) in the issues header area.

Add click handler on issue rows. Add overlay state + render.

**Step 5: Run tests, commit**

```bash
git add frontend/src/components/detail/DQIssueDetail.tsx frontend/src/components/detail/__tests__/DQIssueDetail.test.tsx frontend/src/components/dashboard/DataQualityCard.tsx frontend/src/hooks/useDataQuality.ts
git commit -m "[frontend] Add DQIssueDetail overlay + severity filter to DataQualityCard"
```

---

### Task 7: Add CommitmentDetail overlay + search to CommitmentTracker

**Files:**
- Create: `frontend/src/components/detail/CommitmentDetail.tsx`
- Create: `frontend/src/components/detail/__tests__/CommitmentDetail.test.tsx`
- Modify: `frontend/src/components/CommitmentTracker.tsx`

**Step 1: Write test**

Use `mockCommitment` and `mockFulfilledCommitment` from existing `fixtures.ts`.

Test cases:
- Renders description as title
- Renders status badge
- Renders target date with relative label
- Renders owner agent and team
- Renders alert config (days before, alert sent)
- Renders fulfillment info when fulfilled
- Shows Fulfill button + note input for active commitments
- Shows Cancel button for active commitments
- Hides actions for terminal states (fulfilled, cancelled)
- Navigation counter works

**Step 2: Create CommitmentDetail component**

Uses `DetailOverlay`, `MetadataGrid`, `Section`, `StatusBadge`.

Fields:
- Title: `item.description`
- Icon: `📋`
- Subtitle: relative date label (reuse `relativeDateLabel` from CommitmentTracker — extract to shared util or import)
- Status badge: status with existing `statusBadge` color map from CommitmentTracker
- Metadata: Status, Target Date, Owner Agent, Owner Team, Alert Days Before, Alert Sent, Related Interaction, Related Conversation
- Fulfillment section (when fulfilled): fulfilledAt, fulfilledBy, fulfillmentNote

Footer actions (uses `useUpdateCommitment` from `@/hooks/useCRM`):
- "Fulfill" button — expands note input on first click, submits on second (same pattern as CommitmentTracker)
- "Cancel" button

**Step 3: Wire CommitmentTracker**

Add search input in header (filter on `description` text). Follow InteractionHistoryCard search pattern.

Add click handler on CommitmentRow. When clicked, set `selectedIdx` + `sourceRect`. Render `<CommitmentDetail>` overlay.

**Step 4: Run tests, commit**

```bash
git add frontend/src/components/detail/CommitmentDetail.tsx frontend/src/components/detail/__tests__/CommitmentDetail.test.tsx frontend/src/components/CommitmentTracker.tsx
git commit -m "[frontend] Add CommitmentDetail overlay + search to CommitmentTracker"
```

---

### Task 8: Add OutreachDetail overlay + search to OutreachQueue

**Files:**
- Create: `frontend/src/components/detail/OutreachDetail.tsx`
- Create: `frontend/src/components/detail/__tests__/OutreachDetail.test.tsx`
- Modify: `frontend/src/components/OutreachQueue.tsx`

**Step 1: Write test**

Create local fixture:
```tsx
const mockOutreach: Outreach = {
  outreachId: 'OUT-001', tenantId: '00000000-0000-0000-0000-000000000001',
  contactId: 'C-1001', triggerType: 'retirement_filing',
  triggerDetail: 'Case RET-2026-0147 entered eligibility stage',
  outreachType: 'phone_call', subject: 'Follow up on retirement application status',
  talkingPoints: 'Verify employment dates\nConfirm beneficiary designations',
  priority: 'high', assignedAgent: 'agent-mike', assignedTeam: 'Benefits Team',
  status: 'assigned', attemptCount: 1, maxAttempts: 3,
  lastAttemptAt: '2026-03-10T14:00:00Z', scheduledFor: '2026-03-12T10:00:00Z',
  dueBy: '2026-03-15T17:00:00Z', createdAt: '2026-03-09T08:00:00Z',
  createdBy: 'system', updatedAt: '2026-03-10T14:00:00Z', updatedBy: 'agent-mike',
};
```

Test cases:
- Renders subject as title
- Renders priority badge (High)
- Renders status badge (Assigned)
- Renders trigger type and detail
- Renders talking points block
- Renders attempt counter (1 of 3)
- Renders schedule and due dates
- Renders assigned agent and team
- Action buttons: Log Attempt, Complete, Defer
- Max attempts warning when attemptCount >= maxAttempts
- Actions hidden for terminal states

**Step 2: Create OutreachDetail component**

Uses `DetailOverlay`, `MetadataGrid`, `Section`, `StatusBadge`.

Fields:
- Title: `item.subject || 'Untitled Outreach'`
- Icon: `📞`
- Subtitle: `{triggerType} · {attemptCount} of {maxAttempts} attempts`
- Status badge: priority + status (two badges)
- Metadata: Status, Priority, Outreach Type, Trigger Type, Assigned Agent, Assigned Team, Scheduled For, Due By, Last Attempt, Result Outcome
- Talking Points section (preformatted in blue box, same style as OutreachRow)
- Trigger Detail section

Footer actions (uses `useUpdateOutreach` from `@/hooks/useCRM`):
- "Log Attempt" — visible when not terminal AND attemptCount < maxAttempts
- "Complete" — visible when not terminal
- "Defer" — visible when not terminal
- Max attempts warning inline

**Step 3: Wire OutreachQueue**

Add search input in header (filter on `subject` text). Follow InteractionHistoryCard pattern.

Add click handler on OutreachRow. Render `<OutreachDetail>` overlay.

**Step 4: Run tests, commit**

```bash
git add frontend/src/components/detail/OutreachDetail.tsx frontend/src/components/detail/__tests__/OutreachDetail.test.tsx frontend/src/components/OutreachQueue.tsx
git commit -m "[frontend] Add OutreachDetail overlay + search to OutreachQueue"
```

---

### Task 9: Full test suite + TypeScript check + visual verification

**Step 1: Run full test suite**

Run: `cd frontend && npm test -- --run`
Expected: All tests pass (262 existing + ~45 new ≈ 305+)

**Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

**Step 3: Visual verification (use preview tools)**

Verify each overlay:
1. Member Dashboard → click correspondence row → overlay opens with spawn animation, prev/next works, search filters
2. Member Dashboard → click beneficiary row → overlay opens, shows full detail
3. Member Dashboard → click DQ issue → overlay opens, severity filter works, action buttons visible
4. CRM → CommitmentTracker → click row → overlay opens, Fulfill action works
5. CRM → OutreachQueue → click row → overlay opens, search works, action buttons visible
6. Keyboard: Escape closes all overlays, ArrowLeft/Right navigates
7. Existing overlays still work: InteractionHistoryCard → InteractionDetailPanel, Conversation overlay

**Step 4: Fix any issues found during verification**

---

### Task 10: Update BUILD_HISTORY.md + final commit

**Step 1: Add entry to BUILD_HISTORY.md**

Document:
- Shared DetailOverlay shell extracted (reused by 7 overlay types)
- 5 new detail overlays: Correspondence, Beneficiary, DQIssue, Commitment, Outreach
- 2 existing overlays refactored: InteractionDetailPanel, ConversationDetailOverlay
- Search/filter added to: CorrespondenceHistoryCard, CommitmentTracker, OutreachQueue, DataQualityCard (severity)
- File counts: N new files, M modified files
- Test count before/after
- Visual verification results

**Step 2: Commit**

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Add BUILD_HISTORY entry for universal drill-down overlays"
```
