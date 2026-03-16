import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { composeCrmSummary } from '../crmSummary';
import type { TimelineEntry, Conversation, Commitment } from '@/types/CRM';

// Fix "now" so relative-time logic is deterministic
const FIXED_NOW = new Date('2025-06-15T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    interactionId: 'int-1',
    channel: 'phone_inbound',
    interactionType: 'inquiry',
    direction: 'inbound',
    startedAt: '2025-06-10T09:00:00Z',
    hasNotes: false,
    hasCommitments: false,
    visibility: 'public',
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: 'conv-1',
    tenantId: 'tenant-1',
    anchorType: 'contact',
    status: 'resolved',
    slaBreached: false,
    interactionCount: 1,
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    createdBy: 'agent-1',
    updatedBy: 'agent-1',
    ...overrides,
  };
}

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    commitmentId: 'cmt-1',
    tenantId: 'tenant-1',
    interactionId: 'int-1',
    description: 'Send follow-up letter',
    targetDate: '2025-06-20',
    ownerAgent: 'agent-1',
    status: 'pending',
    alertDaysBefore: 3,
    alertSent: false,
    createdAt: '2025-06-01T00:00:00Z',
    createdBy: 'agent-1',
    updatedAt: '2025-06-01T00:00:00Z',
    updatedBy: 'agent-1',
    ...overrides,
  };
}

describe('composeCrmSummary', () => {
  it('returns interactionDigest with count and timespan', () => {
    const entries = [
      makeEntry({ interactionId: 'int-1', startedAt: '2025-06-10T09:00:00Z' }),
      makeEntry({ interactionId: 'int-2', startedAt: '2025-04-01T09:00:00Z' }),
      makeEntry({ interactionId: 'int-3', startedAt: '2025-03-01T09:00:00Z' }),
    ];
    const result = composeCrmSummary(entries, [], []);

    expect(result.interactionDigest).toContain('3 interactions');
    expect(result.interactionDigest).toMatch(/over \d+ months?\./);
    expect(result.interactionDigest).toContain('Last contact: phone call');
  });

  it('aggregates topTopics from conversations and interactions', () => {
    const entries = [
      makeEntry({ category: 'benefits' }),
      makeEntry({ interactionId: 'int-2', category: 'benefits' }),
      makeEntry({ interactionId: 'int-3', category: 'address_change' }),
    ];
    const conversations = [
      makeConversation({ topicCategory: 'benefits' }),
      makeConversation({ conversationId: 'conv-2', topicCategory: 'eligibility' }),
    ];
    const result = composeCrmSummary(entries, conversations, []);

    // "benefits" should appear first (3 counts from entries + 1 from conversations = 4)
    expect(result.topTopics[0]).toBe('Benefits');
    expect(result.topTopics).toContain('Address change');
    expect(result.topTopics).toContain('Eligibility');
  });

  it('detects overdue commitments in openItems', () => {
    const overdueCommitment = makeCommitment({
      description: 'Mail documents',
      targetDate: '2025-06-01', // before FIXED_NOW
      status: 'pending',
    });
    const result = composeCrmSummary([], [], [overdueCommitment]);

    const overdueItem = result.openItems.find((item) => item.includes('Mail documents'));
    expect(overdueItem).toBeDefined();
    expect(overdueItem).toMatch(/overdue \d+d/);
  });

  it('computes sentiment as positive when entries are mostly resolved', () => {
    const entries = [
      makeEntry({ interactionId: 'int-1', outcome: 'resolved' }),
      makeEntry({ interactionId: 'int-2', outcome: 'resolved' }),
      makeEntry({ interactionId: 'int-3', outcome: 'resolved' }),
    ];
    const result = composeCrmSummary(entries, [], []);
    expect(result.sentiment).toBe('positive');
  });

  it('computes sentiment as concern when there are complaints and SLA breaches', () => {
    const entries = [makeEntry({ interactionType: 'complaint' })];
    const conversations = [makeConversation({ slaBreached: true })];
    const result = composeCrmSummary(entries, conversations, []);
    expect(result.sentiment).toBe('concern');
  });

  it('flags SLA breaches and overdue commitments as urgentFlags', () => {
    const conversations = [makeConversation({ slaBreached: true, subject: 'Benefit inquiry' })];
    const commitments = [
      makeCommitment({
        description: 'Return call',
        targetDate: '2025-06-01', // overdue
        status: 'in_progress',
      }),
    ];
    const result = composeCrmSummary([], conversations, commitments);

    expect(result.urgentFlags).toEqual(
      expect.arrayContaining([
        expect.stringContaining('SLA breached'),
        expect.stringContaining('Return call'),
      ]),
    );
  });

  it('handles empty arrays gracefully', () => {
    const result = composeCrmSummary([], [], []);

    expect(result.interactionDigest).toBe('No interactions recorded.');
    expect(result.topTopics).toEqual([]);
    expect(result.openItems).toEqual([]);
    expect(result.recentHighlights).toEqual([]);
    expect(result.sentiment).toBe('neutral');
    expect(result.urgentFlags).toEqual([]);
  });
});
