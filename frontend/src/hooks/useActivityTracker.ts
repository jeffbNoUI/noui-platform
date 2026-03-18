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
    icon: '\u2709',
    actionLabel:
      urgency === 'action_needed' ? 'Reply' : urgency === 'in_progress' ? 'View' : undefined,
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
    description: urgency === 'completed' ? 'Resolved' : `${issue.severity} \u2014 ${issue.status}`,
    timestamp: issue.updatedAt,
    icon: '\u2691',
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
