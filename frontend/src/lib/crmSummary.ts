import type { TimelineEntry, Conversation, Commitment } from '@/types/CRM';

export interface CrmSummary {
  interactionDigest: string;
  topTopics: string[];
  openItems: string[];
  recentHighlights: string[];
  sentiment: 'positive' | 'neutral' | 'mixed' | 'concern';
  urgentFlags: string[];
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

function relativeTime(iso: string): string {
  const days = daysBetween(new Date(iso), new Date());
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

const channelLabel: Record<string, string> = {
  phone_inbound: 'phone call',
  phone_outbound: 'phone call',
  secure_message: 'secure message',
  email_inbound: 'email',
  email_outbound: 'email',
  walk_in: 'walk-in',
  portal_activity: 'portal activity',
  mail_inbound: 'mail',
  mail_outbound: 'mail',
  internal_handoff: 'internal note',
  system_event: 'system event',
  fax: 'fax',
};

export function composeCrmSummary(
  entries: TimelineEntry[],
  conversations: Conversation[],
  commitments: Commitment[],
): CrmSummary {
  const now = new Date();

  // ── Interaction digest ──────────────────────────────────────────────────
  const sorted = [...entries].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const count = sorted.length;
  let interactionDigest = 'No interactions recorded.';

  if (count > 0) {
    const earliest = new Date(sorted[sorted.length - 1].startedAt);
    const months = Math.max(1, Math.round(daysBetween(earliest, now) / 30));
    const latest = sorted[0];
    const ch = channelLabel[latest.channel] || latest.channel;
    interactionDigest =
      `${count} interaction${count !== 1 ? 's' : ''} over ${months} month${months !== 1 ? 's' : ''}. ` +
      `Last contact: ${ch} ${relativeTime(latest.startedAt)}.`;
  }

  // ── Top topics (from conversation categories) ───────────────────────────
  const catCounts = new Map<string, number>();
  for (const conv of conversations) {
    const cat = conv.topicCategory;
    if (cat) catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  // Also count interaction categories
  for (const e of entries) {
    if (e.category) catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);
  }
  const topTopics = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat]) => cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' '));

  // ── Open items ──────────────────────────────────────────────────────────
  const openItems: string[] = [];

  // Open / pending conversations
  for (const conv of conversations) {
    if (conv.status === 'open' || conv.status === 'pending' || conv.status === 'reopened') {
      openItems.push(conv.subject || `Open conversation (${conv.conversationId})`);
    }
  }

  // Pending / overdue commitments
  for (const c of commitments) {
    if (c.status === 'fulfilled' || c.status === 'cancelled') continue;
    const overdue = new Date(c.targetDate + 'T23:59:59') < now;
    if (overdue) {
      const days = daysBetween(new Date(c.targetDate), now);
      openItems.push(`${c.description} (overdue ${days}d)`);
    } else {
      openItems.push(c.description);
    }
  }

  // ── Recent highlights ───────────────────────────────────────────────────
  const recentHighlights = sorted
    .filter((e) => e.summary)
    .slice(0, 3)
    .map((e) => {
      const text = e.summary!;
      return text.length > 80 ? text.slice(0, 77) + '...' : text;
    });

  // ── Sentiment (majority vote from interaction types / outcomes) ─────────
  let sentimentScore = 0; // positive bias = +, negative = -
  for (const e of entries) {
    if (e.interactionType === 'complaint' || e.interactionType === 'escalation') {
      sentimentScore -= 2;
    } else if (e.outcome === 'resolved') {
      sentimentScore += 1;
    } else if (e.outcome === 'escalated') {
      sentimentScore -= 2;
    }
  }
  // Check conversations for SLA breaches
  for (const conv of conversations) {
    if (conv.slaBreached) sentimentScore -= 3;
  }

  let sentiment: CrmSummary['sentiment'] = 'neutral';
  if (sentimentScore >= 2) sentiment = 'positive';
  else if (sentimentScore <= -3) sentiment = 'concern';
  else if (sentimentScore < 0) sentiment = 'mixed';

  // ── Urgent flags ────────────────────────────────────────────────────────
  const urgentFlags: string[] = [];
  for (const c of commitments) {
    if (c.status === 'fulfilled' || c.status === 'cancelled') continue;
    const overdue = new Date(c.targetDate + 'T23:59:59') < now;
    if (overdue) {
      const days = daysBetween(new Date(c.targetDate), now);
      urgentFlags.push(`${c.description} (${days}d overdue)`);
    }
  }
  // SLA breaches
  for (const conv of conversations) {
    if (conv.slaBreached) {
      urgentFlags.push(`SLA breached: ${conv.subject || conv.conversationId}`);
    }
  }

  return {
    interactionDigest,
    topTopics,
    openItems,
    recentHighlights,
    sentiment,
    urgentFlags,
  };
}
