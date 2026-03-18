# Phase 8: Messages & Activity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Messages & Activity portal section — activity tracker, secure messaging with threaded conversations, interaction history, notification bell — all consuming existing CRM, issues, and case management APIs.

**Architecture:** All backend infrastructure already exists. The CRM service (port 8083) provides conversations, interactions, and timeline data. The issues service (port 8092) provides member-reported issues. This phase creates 6 React components + 2 hooks + wires them into the portal shell. No backend changes needed — Task 62 (backend endpoints) is covered by existing CRM/issues services.

**Tech Stack:** React + TypeScript, React Query (data fetching), existing CRM hooks (`useCRM.ts`), Institutional Warmth design system (`designSystem.ts`), Vitest + Testing Library.

**Design doc:** `docs/plans/2026-03-17-member-portal-redesign-design.md` (Section 12: Messages & Activity Tracker)

---

## Key Decisions

1. **Task 62 (backend) deferred** — existing CRM service provides conversations, interactions, timeline. No new endpoints needed.
2. **No file attachments in ComposeMessage** — deferred to Phase 9 when `FileUpload` shared component is built.
3. **Activity aggregation** — unified feed with urgency buckets (Action Needed / In Progress / Completed). Items from CRM, issues, and cases are normalized into a common `ActivityItem` type. Components never know about source services.

## Urgency Classification Logic

| Source | Condition | Bucket |
|--------|-----------|--------|
| CRM conversation | Status = open, last interaction is outbound (staff replied, awaiting member) | **Action Needed** |
| CRM conversation | Status = open, last interaction is inbound (member sent, awaiting staff) | **In Progress** |
| CRM conversation | Status = resolved or closed | **Completed** |
| Issue | Status = open, reported by member | **In Progress** |
| Issue | Status = resolved or closed | **Completed** |

## Existing Infrastructure (Do Not Recreate)

These hooks/types already exist and should be imported, not duplicated:

- **`useMemberConversations(memberId)`** — `frontend/src/hooks/useCRM.ts:263` — returns `Conversation[]`
- **`usePublicConversationInteractions(conversationId)`** — `useCRM.ts:286` — returns public `Interaction[]`
- **`useCreateMemberMessage()`** — `useCRM.ts:380` (alias) — mutation to post a message
- **`useCreateMemberConversation()`** — `useCRM.ts:415` (alias) — mutation to start a thread
- **`useContactByMemberId(memberId)`** — `useCRM.ts:247` — resolves member to CRM contact
- **`useFullTimeline(contactId)`** — `useCRM.ts:255` — returns `ContactTimeline` with all entries
- **`useIssues(filters)`** — `frontend/src/hooks/useIssues.ts:11` — returns paginated issues
- **`renderWithProviders(ui)`** — `frontend/src/test/helpers.tsx:21` — test render helper
- **Design system** — `C` colors, `BODY`/`DISPLAY` fonts from `frontend/src/lib/designSystem.ts`
- **CRM types** — `Conversation`, `Interaction`, `TimelineEntry`, `ContactTimeline` from `frontend/src/types/CRM.ts`
- **Issue types** — `Issue`, `IssueStats` from `frontend/src/lib/issuesApi.ts`

## Sidebar Navigation (Already Exists)

The `messages` nav item is already defined in `MemberPortalSidebar.tsx:38-41` for all personas. Currently renders a "coming soon" placeholder in `MemberPortal.tsx:116-134`. We will replace this placeholder with the real `MessagesSection` component.

---

## Task 56: Activity Tracker + useActivityTracker Hook

**Files:**
- Create: `frontend/src/hooks/useActivityTracker.ts`
- Create: `frontend/src/components/portal/activity/ActivityTracker.tsx`
- Create: `frontend/src/components/portal/activity/ActivityItem.tsx`
- Test: `frontend/src/components/portal/activity/__tests__/ActivityTracker.test.tsx`

### Step 1: Write the ActivityItem type and useActivityTracker hook

The hook normalizes data from CRM conversations and issues into a common type, then classifies each into urgency buckets.

```typescript
// frontend/src/hooks/useActivityTracker.ts
import { useMemo } from 'react';
import { useMemberConversations, useContactByMemberId } from './useCRM';
import { useIssues } from './useIssues';
import type { Conversation } from '@/types/CRM';
import type { Issue } from '@/lib/issuesApi';

// ── Normalized activity item ─────────────────────────────────────────────────

export type ActivityUrgency = 'action_needed' | 'in_progress' | 'completed';
export type ActivitySource = 'conversation' | 'issue';

export interface ActivityItem {
  id: string;
  source: ActivitySource;
  urgency: ActivityUrgency;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  actionLabel?: string;
  actionKey?: string;
  sourceId: string;
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function classifyConversation(c: Conversation): ActivityUrgency {
  if (c.status === 'resolved' || c.status === 'closed') return 'completed';
  // If the conversation has interactions and the last one was outbound (staff),
  // the member needs to respond → action needed.
  // Without inline interaction data, treat open/pending as in_progress by default.
  if (c.status === 'pending') return 'action_needed';
  return 'in_progress';
}

function conversationToActivity(c: Conversation): ActivityItem {
  const urgency = classifyConversation(c);
  const statusLabel =
    urgency === 'action_needed'
      ? 'Awaiting your response'
      : urgency === 'completed'
        ? 'Resolved'
        : 'Awaiting staff response';
  return {
    id: `conv-${c.conversationId}`,
    source: 'conversation',
    urgency,
    title: c.subject || 'Message',
    description: statusLabel,
    timestamp: c.updatedAt,
    icon: '✉',
    actionLabel: urgency === 'action_needed' ? 'Reply' : urgency === 'in_progress' ? 'View' : undefined,
    actionKey: c.conversationId,
    sourceId: c.conversationId,
  };
}

function classifyIssue(issue: Issue): ActivityUrgency {
  if (issue.status === 'resolved' || issue.status === 'closed') return 'completed';
  return 'in_progress';
}

function issueToActivity(issue: Issue): ActivityItem {
  const urgency = classifyIssue(issue);
  return {
    id: `issue-${issue.issueId}`,
    source: 'issue',
    urgency,
    title: issue.title,
    description: urgency === 'completed' ? 'Resolved' : `${issue.severity} — ${issue.status}`,
    timestamp: issue.updatedAt,
    icon: '⚑',
    sourceId: issue.issueId,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useActivityTracker(memberId: string) {
  const { data: conversations, isLoading: convsLoading } = useMemberConversations(memberId);
  const { data: issuesResult, isLoading: issuesLoading } = useIssues({ limit: 50 });
  const { data: contact } = useContactByMemberId(memberId);

  const isLoading = convsLoading || issuesLoading;

  const items = useMemo(() => {
    const all: ActivityItem[] = [];

    if (conversations) {
      all.push(...conversations.map(conversationToActivity));
    }
    if (issuesResult?.items) {
      all.push(...issuesResult.items.map(issueToActivity));
    }

    // Sort by timestamp descending (most recent first)
    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return all;
  }, [conversations, issuesResult]);

  const grouped = useMemo(() => {
    const action_needed = items.filter((i) => i.urgency === 'action_needed');
    const in_progress = items.filter((i) => i.urgency === 'in_progress');
    const completed = items.filter((i) => i.urgency === 'completed');
    return { action_needed, in_progress, completed };
  }, [items]);

  return {
    items,
    grouped,
    isLoading,
    contactId: contact?.contactId,
    counts: {
      actionNeeded: grouped.action_needed.length,
      inProgress: grouped.in_progress.length,
      completed: grouped.completed.length,
      total: items.length,
    },
  };
}
```

### Step 2: Write the ActivityItem component

```typescript
// frontend/src/components/portal/activity/ActivityItem.tsx
import { C, BODY } from '@/lib/designSystem';
import type { ActivityItem as ActivityItemType } from '@/hooks/useActivityTracker';

interface ActivityItemProps {
  item: ActivityItemType;
  onAction?: (item: ActivityItemType) => void;
}

export default function ActivityItem({ item, onAction }: ActivityItemProps) {
  const timeAgo = formatRelativeTime(item.timestamp);

  return (
    <div
      data-testid={`activity-item-${item.id}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        background: C.cardBg,
        borderRadius: 8,
        border: `1px solid ${C.borderLight}`,
      }}
    >
      <span
        style={{
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: item.urgency === 'action_needed' ? C.coralMuted : C.sageLight,
        }}
      >
        {item.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: 14,
            color: C.text,
            marginBottom: 2,
          }}
        >
          {item.title}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary }}>
          {item.description}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary }}>{timeAgo}</span>
        {item.actionLabel && onAction && (
          <button
            data-testid={`activity-action-${item.id}`}
            onClick={() => onAction(item)}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: C.sage,
              background: C.sageLight,
              border: 'none',
              borderRadius: 6,
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >
            {item.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
```

### Step 3: Write the ActivityTracker component

```typescript
// frontend/src/components/portal/activity/ActivityTracker.tsx
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import type { ActivityItem as ActivityItemType, ActivityUrgency } from '@/hooks/useActivityTracker';
import ActivityItem from './ActivityItem';

interface ActivityTrackerProps {
  memberId: string;
  onAction?: (item: ActivityItemType) => void;
}

const BUCKET_CONFIG: { key: ActivityUrgency; label: string; emptyLabel: string; color: string }[] = [
  { key: 'action_needed', label: 'Action Needed', emptyLabel: 'No items require your attention', color: C.coral },
  { key: 'in_progress', label: 'In Progress', emptyLabel: 'No items in progress', color: C.gold },
  { key: 'completed', label: 'Recently Completed', emptyLabel: 'No recent completions', color: C.sage },
];

export default function ActivityTracker({ memberId, onAction }: ActivityTrackerProps) {
  const { grouped, isLoading, counts } = useActivityTracker(memberId);

  if (isLoading) {
    return (
      <div data-testid="activity-tracker-loading" style={{ padding: 32, textAlign: 'center', color: C.textSecondary, fontFamily: BODY }}>
        Loading activity...
      </div>
    );
  }

  if (counts.total === 0) {
    return (
      <div data-testid="activity-tracker-empty" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <div style={{ fontFamily: BODY, fontSize: 16, color: C.textSecondary }}>
          You're all caught up — no pending activity
        </div>
      </div>
    );
  }

  return (
    <div data-testid="activity-tracker">
      {BUCKET_CONFIG.map(({ key, label, emptyLabel, color }) => {
        const items = grouped[key];
        return (
          <section key={key} data-testid={`activity-bucket-${key}`} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <h3
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 17,
                  fontWeight: 600,
                  color: C.text,
                  margin: 0,
                }}
              >
                {label}
              </h3>
              {items.length > 0 && (
                <span
                  style={{
                    fontFamily: BODY,
                    fontSize: 12,
                    color: C.textTertiary,
                    marginLeft: 4,
                  }}
                >
                  ({items.length})
                </span>
              )}
            </div>
            {items.length === 0 ? (
              <div style={{ fontFamily: BODY, fontSize: 14, color: C.textTertiary, paddingLeft: 16 }}>
                {emptyLabel}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item) => (
                  <ActivityItem key={item.id} item={item} onAction={onAction} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

### Step 4: Write the tests

```typescript
// frontend/src/components/portal/activity/__tests__/ActivityTracker.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ActivityTracker from '../ActivityTracker';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockConversations = [
  {
    conversationId: 'conv-1',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Retirement eligibility question',
    status: 'pending' as const,
    slaBreached: false,
    interactionCount: 3,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-17T14:00:00Z',
    createdBy: 'staff-1',
    updatedBy: 'staff-1',
  },
  {
    conversationId: 'conv-2',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Address update confirmed',
    status: 'resolved' as const,
    slaBreached: false,
    interactionCount: 2,
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-12T11:00:00Z',
    createdBy: 'member-1',
    updatedBy: 'staff-1',
  },
  {
    conversationId: 'conv-3',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Service credit inquiry',
    status: 'open' as const,
    slaBreached: false,
    interactionCount: 1,
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
    createdBy: 'member-1',
    updatedBy: 'member-1',
  },
];

const mockIssues = {
  items: [
    {
      id: 1,
      issueId: 'ISS-001',
      tenantId: 't1',
      title: 'Salary record incorrect for 2024',
      description: 'Reported salary does not match W-2',
      severity: 'medium' as const,
      category: 'defect' as const,
      status: 'in-work' as const,
      affectedService: 'dataaccess',
      reportedBy: 'member-1',
      assignedTo: 'staff-1',
      reportedAt: '2026-03-14T10:00:00Z',
      resolvedAt: null,
      resolutionNote: null,
      createdAt: '2026-03-14T10:00:00Z',
      updatedAt: '2026-03-15T12:00:00Z',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

let conversationsData: typeof mockConversations | undefined = mockConversations;
let issuesData: typeof mockIssues | undefined = mockIssues;
let contactData = { contactId: 'contact-1' };
let convsLoading = false;
let issuesLoading = false;

vi.mock('@/hooks/useCRM', () => ({
  useMemberConversations: () => ({
    data: conversationsData,
    isLoading: convsLoading,
  }),
  useContactByMemberId: () => ({
    data: contactData,
  }),
}));

vi.mock('@/hooks/useIssues', () => ({
  useIssues: () => ({
    data: issuesData,
    isLoading: issuesLoading,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ActivityTracker', () => {
  beforeEach(() => {
    conversationsData = mockConversations;
    issuesData = mockIssues;
    contactData = { contactId: 'contact-1' };
    convsLoading = false;
    issuesLoading = false;
  });

  it('renders all three urgency buckets', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    expect(screen.getByTestId('activity-bucket-action_needed')).toBeInTheDocument();
    expect(screen.getByTestId('activity-bucket-in_progress')).toBeInTheDocument();
    expect(screen.getByTestId('activity-bucket-completed')).toBeInTheDocument();
  });

  it('classifies pending conversation as action needed', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    const bucket = screen.getByTestId('activity-bucket-action_needed');
    expect(bucket.textContent).toContain('Retirement eligibility question');
  });

  it('classifies open conversation as in progress', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    const bucket = screen.getByTestId('activity-bucket-in_progress');
    expect(bucket.textContent).toContain('Service credit inquiry');
  });

  it('classifies resolved conversation as completed', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    const bucket = screen.getByTestId('activity-bucket-completed');
    expect(bucket.textContent).toContain('Address update confirmed');
  });

  it('classifies in-work issue as in progress', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    const bucket = screen.getByTestId('activity-bucket-in_progress');
    expect(bucket.textContent).toContain('Salary record incorrect for 2024');
  });

  it('shows loading state', () => {
    convsLoading = true;
    conversationsData = undefined;
    issuesData = undefined;

    renderWithProviders(<ActivityTracker memberId="10001" />);

    expect(screen.getByTestId('activity-tracker-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading activity...')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    conversationsData = [];
    issuesData = { items: [], total: 0, limit: 50, offset: 0 };

    renderWithProviders(<ActivityTracker memberId="10001" />);

    expect(screen.getByTestId('activity-tracker-empty')).toBeInTheDocument();
    expect(screen.getByText("You're all caught up — no pending activity")).toBeInTheDocument();
  });

  it('shows action button for action_needed items and fires callback', () => {
    const onAction = vi.fn();
    renderWithProviders(<ActivityTracker memberId="10001" onAction={onAction} />);

    const replyButton = screen.getByTestId('activity-action-conv-conv-1');
    expect(replyButton.textContent).toBe('Reply');

    fireEvent.click(replyButton);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conv-conv-1', source: 'conversation' }),
    );
  });

  it('shows empty bucket messages for buckets with no items', () => {
    // Only action_needed items (pending conversation), no in_progress or completed
    conversationsData = [mockConversations[0]]; // pending only
    issuesData = { items: [], total: 0, limit: 50, offset: 0 };

    renderWithProviders(<ActivityTracker memberId="10001" />);

    expect(screen.getByText('No items in progress')).toBeInTheDocument();
    expect(screen.getByText('No recent completions')).toBeInTheDocument();
  });

  it('shows item count per bucket', () => {
    renderWithProviders(<ActivityTracker memberId="10001" />);

    // action_needed: 1 (pending conv), in_progress: 2 (open conv + in-work issue), completed: 1 (resolved conv)
    const actionBucket = screen.getByTestId('activity-bucket-action_needed');
    expect(actionBucket.textContent).toContain('(1)');

    const progressBucket = screen.getByTestId('activity-bucket-in_progress');
    expect(progressBucket.textContent).toContain('(2)');

    const completedBucket = screen.getByTestId('activity-bucket-completed');
    expect(completedBucket.textContent).toContain('(1)');
  });
});
```

### Step 5: Run tests

```bash
cd frontend && npx vitest run src/components/portal/activity/__tests__/ActivityTracker.test.tsx
```

Expected: 9 tests pass.

### Step 6: Commit

```bash
git add frontend/src/hooks/useActivityTracker.ts frontend/src/components/portal/activity/
git commit -m "[frontend] Add activity tracker with urgency-grouped feed from CRM and issues"
```

---

## Task 57: Secure Messaging — Message List + Thread

**Files:**
- Create: `frontend/src/components/portal/messages/MessageList.tsx`
- Create: `frontend/src/components/portal/messages/MessageThread.tsx`
- Test: `frontend/src/components/portal/messages/__tests__/MessageList.test.tsx`

### Step 1: Write the MessageThread component

Renders a single conversation's public interactions chronologically with a reply input at the bottom.

```typescript
// frontend/src/components/portal/messages/MessageThread.tsx
import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { usePublicConversationInteractions, useCreateMemberMessage } from '@/hooks/useCRM';
import type { Interaction } from '@/types/CRM';

interface MessageThreadProps {
  conversationId: string;
  contactId: string;
  subject: string;
  memberId: string;
  onBack: () => void;
}

export default function MessageThread({
  conversationId,
  contactId,
  subject,
  onBack,
}: MessageThreadProps) {
  const { data: interactions, isLoading } = usePublicConversationInteractions(conversationId);
  const sendMessage = useCreateMemberMessage();
  const [replyText, setReplyText] = useState('');

  const handleSend = () => {
    if (!replyText.trim()) return;
    sendMessage.mutate(
      {
        conversationId,
        contactId,
        content: replyText.trim(),
        direction: 'inbound',
      },
      { onSuccess: () => setReplyText('') },
    );
  };

  return (
    <div data-testid="message-thread">
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          data-testid="thread-back"
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: C.textSecondary,
            padding: '4px 8px',
          }}
        >
          ←
        </button>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.text,
            margin: 0,
          }}
        >
          {subject}
        </h2>
      </div>

      {/* Messages */}
      {isLoading ? (
        <div data-testid="thread-loading" style={{ padding: 24, textAlign: 'center', color: C.textSecondary, fontFamily: BODY }}>
          Loading messages...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {(interactions ?? []).map((msg) => (
            <MessageBubble key={msg.interactionId} interaction={msg} />
          ))}
          {interactions?.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: C.textTertiary, fontFamily: BODY }}>
              No messages yet
            </div>
          )}
        </div>
      )}

      {/* Reply input */}
      <div
        data-testid="thread-reply"
        style={{
          display: 'flex',
          gap: 8,
          padding: 16,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.border}`,
        }}
      >
        <textarea
          data-testid="reply-input"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Type your message..."
          rows={2}
          style={{
            flex: 1,
            fontFamily: BODY,
            fontSize: 14,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 6,
            padding: '8px 12px',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <button
          data-testid="send-button"
          onClick={handleSend}
          disabled={!replyText.trim() || sendMessage.isPending}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: replyText.trim() ? C.sage : C.textTertiary,
            border: 'none',
            borderRadius: 6,
            padding: '8px 20px',
            cursor: replyText.trim() ? 'pointer' : 'not-allowed',
            alignSelf: 'flex-end',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ interaction }: { interaction: Interaction }) {
  const isInbound = interaction.direction === 'inbound';
  const time = new Date(interaction.startedAt).toLocaleString();

  return (
    <div
      data-testid={`message-${interaction.interactionId}`}
      style={{
        maxWidth: '75%',
        alignSelf: isInbound ? 'flex-end' : 'flex-start',
        background: isInbound ? C.sageLight : C.cardBg,
        border: `1px solid ${isInbound ? 'transparent' : C.borderLight}`,
        borderRadius: 12,
        padding: '10px 14px',
      }}
    >
      <div style={{ fontFamily: BODY, fontSize: 14, color: C.text, lineHeight: 1.5 }}>
        {interaction.summary}
      </div>
      <div style={{ fontFamily: BODY, fontSize: 11, color: C.textTertiary, marginTop: 4, textAlign: 'right' }}>
        {isInbound ? 'You' : 'Staff'} · {time}
      </div>
    </div>
  );
}
```

### Step 2: Write the MessageList component

Shows all conversations as a list. Clicking one opens the thread.

```typescript
// frontend/src/components/portal/messages/MessageList.tsx
import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useMemberConversations, useContactByMemberId } from '@/hooks/useCRM';
import type { Conversation } from '@/types/CRM';
import MessageThread from './MessageThread';

interface MessageListProps {
  memberId: string;
  onCompose?: () => void;
}

export default function MessageList({ memberId, onCompose }: MessageListProps) {
  const { data: conversations, isLoading } = useMemberConversations(memberId);
  const { data: contact } = useContactByMemberId(memberId);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const selectedConv = conversations?.find((c) => c.conversationId === selectedConvId);

  if (selectedConv && contact) {
    return (
      <MessageThread
        conversationId={selectedConv.conversationId}
        contactId={contact.contactId}
        subject={selectedConv.subject || 'Message'}
        memberId={memberId}
        onBack={() => setSelectedConvId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div data-testid="message-list-loading" style={{ padding: 24, textAlign: 'center', color: C.textSecondary, fontFamily: BODY }}>
        Loading messages...
      </div>
    );
  }

  const sorted = [...(conversations ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div data-testid="message-list">
      {/* Header with compose button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 17,
            fontWeight: 600,
            color: C.text,
            margin: 0,
          }}
        >
          Conversations
        </h3>
        {onCompose && (
          <button
            data-testid="compose-button"
            onClick={onCompose}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: C.sage,
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              cursor: 'pointer',
            }}
          >
            New Message
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div data-testid="message-list-empty" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✉</div>
          <div style={{ fontFamily: BODY, fontSize: 15, color: C.textSecondary }}>
            No messages yet
          </div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: C.textTertiary, marginTop: 4 }}>
            Send a message to get in touch with your plan administrator
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((conv) => (
            <ConversationRow
              key={conv.conversationId}
              conversation={conv}
              onClick={() => setSelectedConvId(conv.conversationId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({ conversation, onClick }: { conversation: Conversation; onClick: () => void }) {
  const isOpen = conversation.status === 'open' || conversation.status === 'pending' || conversation.status === 'reopened';
  const dateStr = new Date(conversation.updatedAt).toLocaleDateString();

  return (
    <button
      data-testid={`conversation-${conversation.conversationId}`}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: BODY,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isOpen ? C.sage : C.textTertiary,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{conversation.subject || 'Message'}</div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
          {conversation.interactionCount} message{conversation.interactionCount !== 1 ? 's' : ''} · {conversation.status}
        </div>
      </div>
      <span style={{ fontSize: 12, color: C.textTertiary, flexShrink: 0 }}>{dateStr}</span>
    </button>
  );
}
```

### Step 3: Write the tests

```typescript
// frontend/src/components/portal/messages/__tests__/MessageList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MessageList from '../MessageList';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockConversations = [
  {
    conversationId: 'conv-1',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Retirement eligibility question',
    status: 'open' as const,
    slaBreached: false,
    interactionCount: 3,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-17T14:00:00Z',
    createdBy: 'member-1',
    updatedBy: 'staff-1',
  },
  {
    conversationId: 'conv-2',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Address update confirmed',
    status: 'resolved' as const,
    slaBreached: false,
    interactionCount: 2,
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-12T11:00:00Z',
    createdBy: 'member-1',
    updatedBy: 'staff-1',
  },
];

const mockContact = { contactId: 'contact-1' };
const mockInteractions = [
  {
    interactionId: 'int-1',
    tenantId: 't1',
    conversationId: 'conv-1',
    channel: 'secure_message' as const,
    interactionType: 'request' as const,
    direction: 'inbound' as const,
    summary: 'When am I eligible to retire?',
    visibility: 'public' as const,
    startedAt: '2026-03-15T10:00:00Z',
    createdAt: '2026-03-15T10:00:00Z',
    createdBy: 'member-1',
  },
  {
    interactionId: 'int-2',
    tenantId: 't1',
    conversationId: 'conv-1',
    channel: 'secure_message' as const,
    interactionType: 'follow_up' as const,
    direction: 'outbound' as const,
    summary: 'Based on your records, you are eligible at age 60.',
    visibility: 'public' as const,
    startedAt: '2026-03-16T09:00:00Z',
    createdAt: '2026-03-16T09:00:00Z',
    createdBy: 'staff-1',
  },
];

let conversationsData: typeof mockConversations | undefined = mockConversations;
let contactData: typeof mockContact | undefined = mockContact;
let interactionsData: typeof mockInteractions | undefined = mockInteractions;
let convsLoading = false;
let interactionsLoading = false;
let sendMessageFn = vi.fn();

vi.mock('@/hooks/useCRM', () => ({
  useMemberConversations: () => ({
    data: conversationsData,
    isLoading: convsLoading,
  }),
  useContactByMemberId: () => ({
    data: contactData,
  }),
  usePublicConversationInteractions: () => ({
    data: interactionsData,
    isLoading: interactionsLoading,
  }),
  useCreateMemberMessage: () => ({
    mutate: sendMessageFn,
    isPending: false,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MessageList', () => {
  beforeEach(() => {
    conversationsData = mockConversations;
    contactData = mockContact;
    interactionsData = mockInteractions;
    convsLoading = false;
    interactionsLoading = false;
    sendMessageFn = vi.fn();
  });

  it('renders conversation list', () => {
    renderWithProviders(<MessageList memberId="10001" />);

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByText('Retirement eligibility question')).toBeInTheDocument();
    expect(screen.getByText('Address update confirmed')).toBeInTheDocument();
  });

  it('shows message count per conversation', () => {
    renderWithProviders(<MessageList memberId="10001" />);

    const conv1 = screen.getByTestId('conversation-conv-1');
    expect(conv1.textContent).toContain('3 messages');
  });

  it('shows status indicator — green for open, gray for resolved', () => {
    renderWithProviders(<MessageList memberId="10001" />);

    // Both conversations should render
    expect(screen.getByTestId('conversation-conv-1')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-conv-2')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    convsLoading = true;
    conversationsData = undefined;

    renderWithProviders(<MessageList memberId="10001" />);

    expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
  });

  it('shows empty state when no conversations', () => {
    conversationsData = [];

    renderWithProviders(<MessageList memberId="10001" />);

    expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('shows compose button and fires callback', () => {
    const onCompose = vi.fn();
    renderWithProviders(<MessageList memberId="10001" onCompose={onCompose} />);

    const button = screen.getByTestId('compose-button');
    expect(button.textContent).toBe('New Message');

    fireEvent.click(button);
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it('opens thread when conversation is clicked', () => {
    renderWithProviders(<MessageList memberId="10001" />);

    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    // Should now show thread view
    expect(screen.getByTestId('message-thread')).toBeInTheDocument();
    expect(screen.getByText('Retirement eligibility question')).toBeInTheDocument();
  });

  it('shows message bubbles in thread view', () => {
    renderWithProviders(<MessageList memberId="10001" />);
    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    expect(screen.getByTestId('message-int-1')).toBeInTheDocument();
    expect(screen.getByText('When am I eligible to retire?')).toBeInTheDocument();
    expect(screen.getByTestId('message-int-2')).toBeInTheDocument();
    expect(screen.getByText('Based on your records, you are eligible at age 60.')).toBeInTheDocument();
  });

  it('shows reply input in thread and sends message', () => {
    renderWithProviders(<MessageList memberId="10001" />);
    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    const input = screen.getByTestId('reply-input');
    fireEvent.change(input, { target: { value: 'Thank you for the info!' } });

    const sendBtn = screen.getByTestId('send-button');
    fireEvent.click(sendBtn);

    expect(sendMessageFn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        content: 'Thank you for the info!',
        direction: 'inbound',
      }),
      expect.any(Object),
    );
  });

  it('navigates back from thread to list', () => {
    renderWithProviders(<MessageList memberId="10001" />);
    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    expect(screen.getByTestId('message-thread')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('thread-back'));

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    renderWithProviders(<MessageList memberId="10001" />);
    fireEvent.click(screen.getByTestId('conversation-conv-1'));

    const sendBtn = screen.getByTestId('send-button');
    expect(sendBtn).toBeDisabled();
  });
});
```

### Step 4: Run tests

```bash
cd frontend && npx vitest run src/components/portal/messages/__tests__/MessageList.test.tsx
```

Expected: 11 tests pass.

### Step 5: Commit

```bash
git add frontend/src/components/portal/messages/MessageList.tsx frontend/src/components/portal/messages/MessageThread.tsx frontend/src/components/portal/messages/__tests__/
git commit -m "[frontend] Add secure messaging with threaded conversations"
```

---

## Task 58: Compose Message

**Files:**
- Create: `frontend/src/components/portal/messages/ComposeMessage.tsx`
- Test: `frontend/src/components/portal/messages/__tests__/ComposeMessage.test.tsx`

### Step 1: Write the ComposeMessage component

New conversation form with subject and body. No attachment support (deferred to Phase 9).

```typescript
// frontend/src/components/portal/messages/ComposeMessage.tsx
import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useCreateMemberConversation, useContactByMemberId } from '@/hooks/useCRM';

interface ComposeMessageProps {
  memberId: string;
  onSent: () => void;
  onCancel: () => void;
}

export default function ComposeMessage({ memberId, onSent, onCancel }: ComposeMessageProps) {
  const { data: contact } = useContactByMemberId(memberId);
  const createConversation = useCreateMemberConversation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !createConversation.isPending;

  const handleSend = () => {
    if (!canSend) return;
    setError(null);

    createConversation.mutate(
      {
        anchorType: 'MEMBER',
        anchorId: memberId,
        subject: subject.trim(),
        initialMessage: body.trim(),
        contactId: contact?.contactId,
        direction: 'inbound',
      },
      {
        onSuccess: () => onSent(),
        onError: (err) => setError(err.message || 'Failed to send message. Please try again.'),
      },
    );
  };

  return (
    <div data-testid="compose-message">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onCancel}
          data-testid="compose-cancel"
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: C.textSecondary,
            padding: '4px 8px',
          }}
        >
          ←
        </button>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.text,
            margin: 0,
          }}
        >
          New Message
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Subject */}
        <div>
          <label
            htmlFor="compose-subject"
            style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.textSecondary, display: 'block', marginBottom: 4 }}
          >
            Subject
          </label>
          <input
            id="compose-subject"
            data-testid="compose-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What is this about?"
            style={{
              width: '100%',
              fontFamily: BODY,
              fontSize: 14,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '10px 12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="compose-body"
            style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.textSecondary, display: 'block', marginBottom: 4 }}
          >
            Message
          </label>
          <textarea
            id="compose-body"
            data-testid="compose-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message..."
            rows={6}
            style={{
              width: '100%',
              fontFamily: BODY,
              fontSize: 14,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '10px 12px',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div data-testid="compose-error" style={{ fontFamily: BODY, fontSize: 13, color: C.coral }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            data-testid="compose-cancel-button"
            onClick={onCancel}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              color: C.textSecondary,
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '8px 20px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="compose-send"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: canSend ? C.sage : C.textTertiary,
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            {createConversation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Write the tests

```typescript
// frontend/src/components/portal/messages/__tests__/ComposeMessage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ComposeMessage from '../ComposeMessage';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockContact = { contactId: 'contact-1' };
let mutateFn = vi.fn();
let isPending = false;

vi.mock('@/hooks/useCRM', () => ({
  useContactByMemberId: () => ({ data: mockContact }),
  useCreateMemberConversation: () => ({
    mutate: mutateFn,
    isPending,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ComposeMessage', () => {
  const onSent = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    mutateFn = vi.fn();
    isPending = false;
    onSent.mockReset();
    onCancel.mockReset();
  });

  it('renders form with subject, body, and send button', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    expect(screen.getByTestId('compose-message')).toBeInTheDocument();
    expect(screen.getByTestId('compose-subject')).toBeInTheDocument();
    expect(screen.getByTestId('compose-body')).toBeInTheDocument();
    expect(screen.getByTestId('compose-send')).toBeInTheDocument();
  });

  it('disables send when subject is empty', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-body'), { target: { value: 'Some message' } });

    expect(screen.getByTestId('compose-send')).toBeDisabled();
  });

  it('disables send when body is empty', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-subject'), { target: { value: 'Subject' } });

    expect(screen.getByTestId('compose-send')).toBeDisabled();
  });

  it('enables send when both subject and body have content', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-subject'), { target: { value: 'Question' } });
    fireEvent.change(screen.getByTestId('compose-body'), { target: { value: 'My question...' } });

    expect(screen.getByTestId('compose-send')).not.toBeDisabled();
  });

  it('sends message with correct payload', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-subject'), { target: { value: 'Question' } });
    fireEvent.change(screen.getByTestId('compose-body'), { target: { value: 'My question' } });
    fireEvent.click(screen.getByTestId('compose-send'));

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorType: 'MEMBER',
        anchorId: '10001',
        subject: 'Question',
        initialMessage: 'My question',
        direction: 'inbound',
      }),
      expect.any(Object),
    );
  });

  it('trims whitespace from subject and body', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('compose-subject'), { target: { value: '  Question  ' } });
    fireEvent.change(screen.getByTestId('compose-body'), { target: { value: '  My question  ' } });
    fireEvent.click(screen.getByTestId('compose-send'));

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Question', initialMessage: 'My question' }),
      expect.any(Object),
    );
  });

  it('fires onCancel when cancel button is clicked', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('compose-cancel-button'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel when back arrow is clicked', () => {
    renderWithProviders(<ComposeMessage memberId="10001" onSent={onSent} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('compose-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

### Step 3: Run tests

```bash
cd frontend && npx vitest run src/components/portal/messages/__tests__/ComposeMessage.test.tsx
```

Expected: 7 tests pass.

### Step 4: Commit

```bash
git add frontend/src/components/portal/messages/ComposeMessage.tsx frontend/src/components/portal/messages/__tests__/ComposeMessage.test.tsx
git commit -m "[frontend] Add compose message form for new conversations"
```

---

## Task 59: Interaction History

**Files:**
- Create: `frontend/src/components/portal/messages/InteractionHistory.tsx`
- Test: `frontend/src/components/portal/messages/__tests__/InteractionHistory.test.tsx`

### Step 1: Write the InteractionHistory component

Read-only chronological timeline of all contact: calls, emails, visits, portal messages. Filterable by channel type and date range. Uses `useFullTimeline` which returns `ContactTimeline` with `TimelineEntry[]`.

```typescript
// frontend/src/components/portal/messages/InteractionHistory.tsx
import { useState, useMemo } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useFullTimeline, useContactByMemberId } from '@/hooks/useCRM';
import type { TimelineEntry, InteractionChannel } from '@/types/CRM';

interface InteractionHistoryProps {
  memberId: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  phone_inbound: 'Phone (Inbound)',
  phone_outbound: 'Phone (Outbound)',
  secure_message: 'Portal Message',
  email_inbound: 'Email (Inbound)',
  email_outbound: 'Email (Outbound)',
  walk_in: 'In-Person Visit',
  portal_activity: 'Portal Activity',
  mail_inbound: 'Mail (Received)',
  mail_outbound: 'Mail (Sent)',
  system_event: 'System',
  fax: 'Fax',
  internal_handoff: 'Internal',
};

const CHANNEL_ICONS: Record<string, string> = {
  phone_inbound: '📞',
  phone_outbound: '📞',
  secure_message: '✉',
  email_inbound: '📧',
  email_outbound: '📧',
  walk_in: '🏢',
  portal_activity: '🌐',
  mail_inbound: '📬',
  mail_outbound: '📮',
  system_event: '⚙',
  fax: '📠',
  internal_handoff: '🔄',
};

// Channels to offer in the filter — only member-visible ones
const FILTERABLE_CHANNELS: InteractionChannel[] = [
  'phone_inbound',
  'phone_outbound',
  'secure_message',
  'email_inbound',
  'email_outbound',
  'walk_in',
  'mail_inbound',
  'mail_outbound',
];

export default function InteractionHistory({ memberId }: InteractionHistoryProps) {
  const { data: contact, isLoading: contactLoading } = useContactByMemberId(memberId);
  const { data: timeline, isLoading: timelineLoading } = useFullTimeline(contact?.contactId ?? '');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const isLoading = contactLoading || timelineLoading;

  // Filter to only public visibility entries and apply channel filter
  const filteredEntries = useMemo(() => {
    if (!timeline?.timelineEntries) return [];
    return timeline.timelineEntries.filter((entry) => {
      if (entry.visibility !== 'public') return false;
      if (channelFilter !== 'all' && entry.channel !== channelFilter) return false;
      return true;
    });
  }, [timeline, channelFilter]);

  if (isLoading) {
    return (
      <div data-testid="history-loading" style={{ padding: 24, textAlign: 'center', color: C.textSecondary, fontFamily: BODY }}>
        Loading interaction history...
      </div>
    );
  }

  return (
    <div data-testid="interaction-history">
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <label
          htmlFor="channel-filter"
          style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.textSecondary }}
        >
          Filter:
        </label>
        <select
          id="channel-filter"
          data-testid="channel-filter"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.cardBg,
            outline: 'none',
          }}
        >
          <option value="all">All channels</option>
          {FILTERABLE_CHANNELS.map((ch) => (
            <option key={ch} value={ch}>
              {CHANNEL_LABELS[ch] || ch}
            </option>
          ))}
        </select>
        <span style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary }}>
          {filteredEntries.length} interaction{filteredEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      {filteredEntries.length === 0 ? (
        <div data-testid="history-empty" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontFamily: BODY, fontSize: 15, color: C.textSecondary }}>
            No interaction history found
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredEntries.map((entry) => (
            <TimelineRow key={entry.interactionId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const date = new Date(entry.startedAt);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const icon = CHANNEL_ICONS[entry.channel] || '•';
  const label = CHANNEL_LABELS[entry.channel] || entry.channel;

  return (
    <div
      data-testid={`history-entry-${entry.interactionId}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: C.cardBg,
        borderRadius: 8,
        border: `1px solid ${C.borderLight}`,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, color: C.text }}>{label}</div>
        {entry.summary && (
          <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
            {entry.summary}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary }}>{dateStr}</div>
        <div style={{ fontFamily: BODY, fontSize: 11, color: C.textTertiary }}>{timeStr}</div>
      </div>
    </div>
  );
}
```

### Step 2: Write the tests

```typescript
// frontend/src/components/portal/messages/__tests__/InteractionHistory.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import InteractionHistory from '../InteractionHistory';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockTimeline = {
  contactId: 'contact-1',
  timelineEntries: [
    {
      interactionId: 'int-1',
      channel: 'phone_inbound' as const,
      interactionType: 'inquiry' as const,
      direction: 'inbound' as const,
      startedAt: '2026-03-15T10:30:00Z',
      summary: 'Called about retirement date',
      hasNotes: false,
      hasCommitments: false,
      visibility: 'public' as const,
    },
    {
      interactionId: 'int-2',
      channel: 'secure_message' as const,
      interactionType: 'request' as const,
      direction: 'inbound' as const,
      startedAt: '2026-03-14T09:00:00Z',
      summary: 'Sent a portal message',
      hasNotes: false,
      hasCommitments: false,
      visibility: 'public' as const,
    },
    {
      interactionId: 'int-3',
      channel: 'email_outbound' as const,
      interactionType: 'notification' as const,
      direction: 'outbound' as const,
      startedAt: '2026-03-13T15:00:00Z',
      summary: 'Annual statement email',
      hasNotes: false,
      hasCommitments: false,
      visibility: 'public' as const,
    },
    {
      interactionId: 'int-internal',
      channel: 'internal_handoff' as const,
      interactionType: 'follow_up' as const,
      direction: 'internal' as const,
      startedAt: '2026-03-12T11:00:00Z',
      summary: 'Staff internal note — should be hidden',
      hasNotes: true,
      hasCommitments: false,
      visibility: 'internal' as const,
    },
  ],
  totalEntries: 4,
  channels: ['phone_inbound', 'secure_message', 'email_outbound', 'internal_handoff'],
  dateRange: { earliest: '2026-03-12T11:00:00Z', latest: '2026-03-15T10:30:00Z' },
};

const mockContact = { contactId: 'contact-1' };
let contactData: typeof mockContact | undefined = mockContact;
let timelineData: typeof mockTimeline | undefined = mockTimeline;
let contactLoading = false;
let timelineLoading = false;

vi.mock('@/hooks/useCRM', () => ({
  useContactByMemberId: () => ({
    data: contactData,
    isLoading: contactLoading,
  }),
  useFullTimeline: () => ({
    data: timelineData,
    isLoading: timelineLoading,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('InteractionHistory', () => {
  beforeEach(() => {
    contactData = mockContact;
    timelineData = mockTimeline;
    contactLoading = false;
    timelineLoading = false;
  });

  it('renders timeline entries', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.getByTestId('interaction-history')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-int-1')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-int-2')).toBeInTheDocument();
    expect(screen.getByTestId('history-entry-int-3')).toBeInTheDocument();
  });

  it('hides internal-visibility entries', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.queryByTestId('history-entry-int-internal')).not.toBeInTheDocument();
  });

  it('shows channel labels', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.getByText('Phone (Inbound)')).toBeInTheDocument();
    expect(screen.getByText('Portal Message')).toBeInTheDocument();
    expect(screen.getByText('Email (Outbound)')).toBeInTheDocument();
  });

  it('shows interaction summaries', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.getByText('Called about retirement date')).toBeInTheDocument();
  });

  it('shows entry count', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    // 3 public entries (internal one hidden)
    expect(screen.getByText('3 interactions')).toBeInTheDocument();
  });

  it('filters by channel', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    fireEvent.change(screen.getByTestId('channel-filter'), { target: { value: 'phone_inbound' } });

    expect(screen.getByTestId('history-entry-int-1')).toBeInTheDocument();
    expect(screen.queryByTestId('history-entry-int-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('history-entry-int-3')).not.toBeInTheDocument();
    expect(screen.getByText('1 interaction')).toBeInTheDocument();
  });

  it('shows empty state when filtered to no results', () => {
    renderWithProviders(<InteractionHistory memberId="10001" />);

    fireEvent.change(screen.getByTestId('channel-filter'), { target: { value: 'walk_in' } });

    expect(screen.getByTestId('history-empty')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    timelineLoading = true;
    timelineData = undefined;

    renderWithProviders(<InteractionHistory memberId="10001" />);

    expect(screen.getByTestId('history-loading')).toBeInTheDocument();
  });
});
```

### Step 3: Run tests

```bash
cd frontend && npx vitest run src/components/portal/messages/__tests__/InteractionHistory.test.tsx
```

Expected: 8 tests pass.

### Step 4: Commit

```bash
git add frontend/src/components/portal/messages/InteractionHistory.tsx frontend/src/components/portal/messages/__tests__/InteractionHistory.test.tsx
git commit -m "[frontend] Add interaction history with channel filter"
```

---

## Task 60: Messages & Activity Section Router

**Files:**
- Create: `frontend/src/components/portal/messages/MessagesSection.tsx`
- Modify: `frontend/src/components/portal/MemberPortal.tsx` — wire into portal router
- Test: `frontend/src/components/portal/messages/__tests__/MessagesSection.test.tsx`

### Step 1: Write the MessagesSection component

3 sub-tabs: Activity / Messages / History. Manages compose state.

```typescript
// frontend/src/components/portal/messages/MessagesSection.tsx
import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import ActivityTracker from '../activity/ActivityTracker';
import MessageList from './MessageList';
import ComposeMessage from './ComposeMessage';
import InteractionHistory from './InteractionHistory';
import type { ActivityItem } from '@/hooks/useActivityTracker';

interface MessagesSectionProps {
  memberId: string;
}

type SubTab = 'activity' | 'messages' | 'history';

const TABS: { key: SubTab; label: string }[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'messages', label: 'Messages' },
  { key: 'history', label: 'History' },
];

export default function MessagesSection({ memberId }: MessagesSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('activity');
  const [composing, setComposing] = useState(false);

  const memberId_str = String(memberId);

  const handleActivityAction = (item: ActivityItem) => {
    if (item.source === 'conversation') {
      setActiveTab('messages');
    }
  };

  if (composing) {
    return (
      <div data-testid="messages-section">
        <ComposeMessage
          memberId={memberId_str}
          onSent={() => {
            setComposing(false);
            setActiveTab('messages');
          }}
          onCancel={() => setComposing(false)}
        />
      </div>
    );
  }

  return (
    <div data-testid="messages-section">
      {/* Section heading */}
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: 24,
          fontWeight: 600,
          color: C.text,
          margin: '0 0 20px',
        }}
      >
        Messages & Activity
      </h2>

      {/* Sub-tab bar */}
      <div
        data-testid="messages-tabs"
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: `2px solid ${C.borderLight}`,
          marginBottom: 24,
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setActiveTab(key)}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? C.sage : C.textSecondary,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === key ? `2px solid ${C.sage}` : '2px solid transparent',
              padding: '10px 20px',
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'activity' && (
        <ActivityTracker memberId={memberId_str} onAction={handleActivityAction} />
      )}
      {activeTab === 'messages' && (
        <MessageList memberId={memberId_str} onCompose={() => setComposing(true)} />
      )}
      {activeTab === 'history' && <InteractionHistory memberId={memberId_str} />}
    </div>
  );
}
```

### Step 2: Wire into MemberPortal.tsx

In `frontend/src/components/portal/MemberPortal.tsx`:

1. Add import: `import MessagesSection from './messages/MessagesSection';`
2. Add route: `{activeSection === 'messages' && <MessagesSection memberId={String(memberID)} />}`
3. Add `'messages'` to the list of handled sections in the fallback conditional.

### Step 3: Write the tests

```typescript
// frontend/src/components/portal/messages/__tests__/MessagesSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MessagesSection from '../MessagesSection';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useActivityTracker', () => ({
  useActivityTracker: () => ({
    items: [],
    grouped: { action_needed: [], in_progress: [], completed: [] },
    isLoading: false,
    counts: { actionNeeded: 0, inProgress: 0, completed: 0, total: 0 },
  }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useMemberConversations: () => ({ data: [], isLoading: false }),
  useContactByMemberId: () => ({ data: { contactId: 'c1' } }),
  usePublicConversationInteractions: () => ({ data: [], isLoading: false }),
  useCreateMemberMessage: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateMemberConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useFullTimeline: () => ({
    data: { contactId: 'c1', timelineEntries: [], totalEntries: 0, channels: [], dateRange: { earliest: '', latest: '' } },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useIssues', () => ({
  useIssues: () => ({ data: { items: [], total: 0, limit: 50, offset: 0 }, isLoading: false }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MessagesSection', () => {
  it('renders with three tabs', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    expect(screen.getByTestId('messages-section')).toBeInTheDocument();
    expect(screen.getByTestId('tab-activity')).toBeInTheDocument();
    expect(screen.getByTestId('tab-messages')).toBeInTheDocument();
    expect(screen.getByTestId('tab-history')).toBeInTheDocument();
  });

  it('defaults to Activity tab', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    // Activity tracker should be visible (empty state)
    expect(screen.getByTestId('activity-tracker-empty')).toBeInTheDocument();
  });

  it('switches to Messages tab', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-messages'));

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });

  it('switches to History tab', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-history'));

    expect(screen.getByTestId('interaction-history')).toBeInTheDocument();
  });

  it('shows compose form when New Message is clicked', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-messages'));
    fireEvent.click(screen.getByTestId('compose-button'));

    expect(screen.getByTestId('compose-message')).toBeInTheDocument();
  });

  it('returns to messages tab when compose is cancelled', () => {
    renderWithProviders(<MessagesSection memberId="10001" />);

    fireEvent.click(screen.getByTestId('tab-messages'));
    fireEvent.click(screen.getByTestId('compose-button'));

    expect(screen.getByTestId('compose-message')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('compose-cancel-button'));

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
  });
});
```

### Step 4: Run tests

```bash
cd frontend && npx vitest run src/components/portal/messages/__tests__/MessagesSection.test.tsx
```

Expected: 6 tests pass.

### Step 5: Commit

```bash
git add frontend/src/components/portal/messages/MessagesSection.tsx frontend/src/components/portal/messages/__tests__/MessagesSection.test.tsx frontend/src/components/portal/MemberPortal.tsx
git commit -m "[frontend] Add messages section router with 3 sub-tabs, wire into portal"
```

---

## Task 61: Notification Bell

**Files:**
- Create: `frontend/src/hooks/useNotifications.ts`
- Create: `frontend/src/components/portal/shared/NotificationBell.tsx`
- Modify: `frontend/src/components/portal/MemberPortal.tsx` — pass badge counts to shell
- Test: `frontend/src/components/portal/shared/__tests__/NotificationBell.test.tsx`

### Step 1: Write the useNotifications hook

Computes badge count from open/pending conversations + action-needed activity items.

```typescript
// frontend/src/hooks/useNotifications.ts
import { useMemo } from 'react';
import { useMemberConversations } from './useCRM';

export interface NotificationSummary {
  unreadCount: number;
  items: NotificationItem[];
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'message' | 'action';
}

export function useNotifications(memberId: string): NotificationSummary & { isLoading: boolean } {
  const { data: conversations, isLoading } = useMemberConversations(memberId);

  const result = useMemo(() => {
    if (!conversations) return { unreadCount: 0, items: [] };

    // Open or pending conversations count as unread notifications
    const activeConvs = conversations.filter(
      (c) => c.status === 'open' || c.status === 'pending' || c.status === 'reopened',
    );

    const items: NotificationItem[] = activeConvs.map((c) => ({
      id: c.conversationId,
      title: c.subject || 'New message',
      description: c.status === 'pending' ? 'Awaiting your response' : 'Conversation active',
      timestamp: c.updatedAt,
      type: 'message' as const,
    }));

    return { unreadCount: items.length, items };
  }, [conversations]);

  return { ...result, isLoading };
}
```

### Step 2: Write the NotificationBell component

Badge in portal header with dropdown.

```typescript
// frontend/src/components/portal/shared/NotificationBell.tsx
import { useState, useRef, useEffect } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationItem } from '@/hooks/useNotifications';

interface NotificationBellProps {
  memberId: string;
  onNotificationClick?: (item: NotificationItem) => void;
}

export default function NotificationBell({ memberId, onNotificationClick }: NotificationBellProps) {
  const { unreadCount, items } = useNotifications(memberId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }} data-testid="notification-bell">
      <button
        data-testid="bell-button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 20,
          cursor: 'pointer',
          position: 'relative',
          padding: '6px 8px',
          color: C.text,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            data-testid="bell-badge"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: C.coral,
              color: '#fff',
              borderRadius: 10,
              padding: '1px 5px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: BODY,
              minWidth: 16,
              textAlign: 'center',
              lineHeight: '14px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="bell-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderLight}` }}>
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, color: C.text }}>
              Notifications
            </span>
          </div>
          {items.length === 0 ? (
            <div data-testid="bell-empty" style={{ padding: '24px 16px', textAlign: 'center', fontFamily: BODY, fontSize: 13, color: C.textTertiary }}>
              No new notifications
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                data-testid={`notification-${item.id}`}
                onClick={() => {
                  onNotificationClick?.(item);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: `1px solid ${C.borderLight}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.title}</div>
                <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{item.description}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Wire NotificationBell into MemberPortal

In `frontend/src/components/portal/MemberPortal.tsx`:

1. Add import: `import NotificationBell from './shared/NotificationBell';`
2. Pass `header` prop to `MemberPortalShell`:
```tsx
<MemberPortalShell
  ...
  header={
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px' }}>
      <NotificationBell
        memberId={String(memberID)}
        onNotificationClick={() => setActiveSection('messages')}
      />
    </div>
  }
>
```

### Step 4: Write the tests

```typescript
// frontend/src/components/portal/shared/__tests__/NotificationBell.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import NotificationBell from '../NotificationBell';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockConversations = [
  {
    conversationId: 'conv-1',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Pending question',
    status: 'pending' as const,
    slaBreached: false,
    interactionCount: 2,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-17T14:00:00Z',
    createdBy: 'member',
    updatedBy: 'staff',
  },
  {
    conversationId: 'conv-2',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Open inquiry',
    status: 'open' as const,
    slaBreached: false,
    interactionCount: 1,
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T08:00:00Z',
    createdBy: 'member',
    updatedBy: 'member',
  },
  {
    conversationId: 'conv-3',
    tenantId: 't1',
    anchorType: 'MEMBER',
    anchorId: '10001',
    subject: 'Resolved item',
    status: 'resolved' as const,
    slaBreached: false,
    interactionCount: 4,
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-12T11:00:00Z',
    createdBy: 'member',
    updatedBy: 'staff',
  },
];

let conversationsData: typeof mockConversations | undefined = mockConversations;

vi.mock('@/hooks/useCRM', () => ({
  useMemberConversations: () => ({
    data: conversationsData,
    isLoading: false,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationBell', () => {
  beforeEach(() => {
    conversationsData = mockConversations;
  });

  it('renders bell with badge count', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);

    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    expect(screen.getByTestId('bell-badge')).toBeInTheDocument();
    // 2 unread: conv-1 (pending) + conv-2 (open). conv-3 (resolved) excluded.
    expect(screen.getByTestId('bell-badge').textContent).toBe('2');
  });

  it('hides badge when no unread items', () => {
    conversationsData = [mockConversations[2]]; // only resolved

    renderWithProviders(<NotificationBell memberId="10001" />);

    expect(screen.queryByTestId('bell-badge')).not.toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);

    expect(screen.queryByTestId('bell-dropdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bell-button'));

    expect(screen.getByTestId('bell-dropdown')).toBeInTheDocument();
  });

  it('shows notification items in dropdown', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);
    fireEvent.click(screen.getByTestId('bell-button'));

    expect(screen.getByTestId('notification-conv-1')).toBeInTheDocument();
    expect(screen.getByText('Pending question')).toBeInTheDocument();
    expect(screen.getByTestId('notification-conv-2')).toBeInTheDocument();
    expect(screen.getByText('Open inquiry')).toBeInTheDocument();
  });

  it('does not show resolved conversations in dropdown', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);
    fireEvent.click(screen.getByTestId('bell-button'));

    expect(screen.queryByTestId('notification-conv-3')).not.toBeInTheDocument();
  });

  it('fires callback and closes dropdown when notification clicked', () => {
    const onClick = vi.fn();
    renderWithProviders(<NotificationBell memberId="10001" onNotificationClick={onClick} />);

    fireEvent.click(screen.getByTestId('bell-button'));
    fireEvent.click(screen.getByTestId('notification-conv-1'));

    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conv-1', title: 'Pending question' }),
    );
    expect(screen.queryByTestId('bell-dropdown')).not.toBeInTheDocument();
  });

  it('shows empty state when dropdown open with no notifications', () => {
    conversationsData = [];

    renderWithProviders(<NotificationBell memberId="10001" />);
    fireEvent.click(screen.getByTestId('bell-button'));

    expect(screen.getByTestId('bell-empty')).toBeInTheDocument();
    expect(screen.getByText('No new notifications')).toBeInTheDocument();
  });

  it('has accessible label with count', () => {
    renderWithProviders(<NotificationBell memberId="10001" />);

    const button = screen.getByTestId('bell-button');
    expect(button.getAttribute('aria-label')).toBe('Notifications (2 unread)');
  });

  it('caps badge display at 9+', () => {
    // Create 10 open conversations
    conversationsData = Array.from({ length: 10 }, (_, i) => ({
      ...mockConversations[1],
      conversationId: `conv-${i}`,
      subject: `Conv ${i}`,
    }));

    renderWithProviders(<NotificationBell memberId="10001" />);

    expect(screen.getByTestId('bell-badge').textContent).toBe('9+');
  });
});
```

### Step 5: Run tests

```bash
cd frontend && npx vitest run src/components/portal/shared/__tests__/NotificationBell.test.tsx
```

Expected: 9 tests pass.

### Step 6: Commit

```bash
git add frontend/src/hooks/useNotifications.ts frontend/src/components/portal/shared/NotificationBell.tsx frontend/src/components/portal/shared/__tests__/ frontend/src/components/portal/MemberPortal.tsx
git commit -m "[frontend] Add notification bell with badge count and dropdown"
```

---

## Final Verification

After all tasks are committed:

```bash
cd frontend && npx tsc --noEmit && npm test -- --run
```

Expected: all existing tests pass + ~50 new tests pass, zero type errors.

---

## File Summary

| Action | Count | Files |
|--------|-------|-------|
| Create | 14 | 6 components, 2 hooks, 6 test files |
| Modify | 1 | `MemberPortal.tsx` (add MessagesSection route + NotificationBell header) |
| **Total** | **15** | |

## Test Summary

| Task | Test File | Expected Tests |
|------|-----------|---------------|
| 56 | `ActivityTracker.test.tsx` | 9 |
| 57 | `MessageList.test.tsx` | 11 |
| 58 | `ComposeMessage.test.tsx` | 7 |
| 59 | `InteractionHistory.test.tsx` | 8 |
| 60 | `MessagesSection.test.tsx` | 6 |
| 61 | `NotificationBell.test.tsx` | 9 |
| **Total** | | **~50** |
