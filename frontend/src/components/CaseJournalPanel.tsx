import { useState, useMemo } from 'react';
import {
  useContactByMemberId,
  useResolveDemoContact,
  useFullTimeline,
  useMemberConversations,
  useAllConversationInteractions,
  useContactCommitments,
} from '@/hooks/useCRM';
import { PortalTimeline, ConversationThread, STAFF_THEME } from '@/components/crm';
import { composeCrmSummary } from '@/lib/crmSummary';
import type { CrmSummary } from '@/lib/crmSummary';
import CrmNoteForm from '@/components/CrmNoteForm';
import type { Conversation, Commitment } from '@/types/CRM';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr + 'T23:59:59') < new Date();
}

// ── Props ────────────────────────────────────────────────────────────────────

interface CaseJournalPanelProps {
  /** CRM contact ID, OR a legacy member ID (will be resolved) */
  contactId?: string;
  memberId?: string;
}

type JournalTab = 'timeline' | 'conversations' | 'commitments';

export default function CaseJournalPanel({
  contactId: propContactId,
  memberId,
}: CaseJournalPanelProps) {
  const [activeTab, setActiveTab] = useState<JournalTab>('timeline');
  const [selectedConvId, setSelectedConvId] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(true);

  // Resolve to a demo contact. Try memberId first, then fall back to the
  // propContactId (which may be an API-generated ID, a demo ID, or a name).
  // All data hooks read from the in-memory demo store keyed by demo contact IDs.
  const { data: resolvedByMember } = useContactByMemberId(memberId ?? '');
  const { data: resolvedByProp } = useResolveDemoContact(propContactId ?? '');
  const resolvedContact = resolvedByMember || resolvedByProp;
  const effectiveContactId = resolvedContact?.contactId || propContactId || '';

  // Data hooks — useMemberConversations takes a member ID (the backend anchor)
  const effectiveMemberId = resolvedContact?.legacyMemberId ?? memberId ?? '';
  const { data: timeline } = useFullTimeline(effectiveContactId);
  const { data: conversations } = useMemberConversations(effectiveMemberId);
  const { data: convInteractions } = useAllConversationInteractions(selectedConvId);
  const { data: commitments } = useContactCommitments(effectiveContactId);

  const contactName = resolvedContact
    ? `${resolvedContact.firstName} ${resolvedContact.lastName}`
    : effectiveContactId;

  const convList = conversations ?? [];
  const commitmentList = commitments ?? [];
  const overdueCommitments = commitmentList.filter(
    (c) => c.status !== 'fulfilled' && c.status !== 'cancelled' && isOverdue(c.targetDate),
  );

  // Compute AI summary
  const summary: CrmSummary | null = useMemo(() => {
    if (!timeline) return null;
    return composeCrmSummary(timeline.timelineEntries, convList, commitmentList);
  }, [timeline, convList, commitmentList]);

  const tabs: { key: JournalTab; label: string; count?: number }[] = [
    { key: 'timeline', label: 'Timeline', count: timeline?.totalEntries },
    { key: 'conversations', label: 'Conversations', count: convList.length },
    {
      key: 'commitments',
      label: 'Commitments',
      count: commitmentList.filter((c) => c.status !== 'fulfilled' && c.status !== 'cancelled')
        .length,
    },
  ];

  if (!effectiveContactId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
        <p className="font-medium text-gray-700 mb-1">Case Journal</p>
        <p>Select a contact to view their interaction journal.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Case Journal</h2>
            <p className="text-xs text-gray-500">{contactName}</p>
          </div>
          <div className="flex items-center gap-2">
            {convList.filter(
              (c) => c.status === 'open' || c.status === 'pending' || c.status === 'reopened',
            ).length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {
                  convList.filter(
                    (c) => c.status === 'open' || c.status === 'pending' || c.status === 'reopened',
                  ).length
                }{' '}
                open
              </span>
            )}
            {overdueCommitments.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                {overdueCommitments.length} overdue
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI Summary Section */}
      {summary && (
        <div className="border-b border-gray-200">
          <button
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="w-full flex items-center justify-between px-4 py-2 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <span className="text-xs font-semibold text-blue-800">AI Summary</span>
            <span className="text-xs text-blue-600">{summaryOpen ? '\u25B4' : '\u25BE'}</span>
          </button>
          {summaryOpen && <AiSummaryContent summary={summary} />}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 px-4 py-2">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key !== 'conversations') setSelectedConvId('');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span className="ml-1 text-[10px] opacity-70">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {activeTab === 'timeline' && timeline && (
          <div className="p-4">
            <PortalTimeline
              entries={timeline.timelineEntries}
              visibility="all"
              theme={STAFF_THEME}
              compact
            />
          </div>
        )}

        {activeTab === 'conversations' && (
          <div>
            {selectedConvId ? (
              <div>
                <button
                  onClick={() => setSelectedConvId('')}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 border-b border-gray-100"
                >
                  &larr; Back to conversations
                </button>
                <div className="px-3 py-1">
                  <ConversationThread
                    interactions={convInteractions ?? []}
                    visibility="all"
                    theme={STAFF_THEME}
                  />
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {convList.map((conv) => (
                  <ConversationRow
                    key={conv.conversationId}
                    conversation={conv}
                    onClick={() => setSelectedConvId(conv.conversationId)}
                  />
                ))}
                {convList.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-gray-500">
                    No conversations for this contact.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'commitments' && (
          <div className="divide-y divide-gray-100">
            {commitmentList.map((c) => (
              <CommitmentRow key={c.commitmentId} commitment={c} />
            ))}
            {commitmentList.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                No commitments for this contact.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Structured Note Form */}
      <CrmNoteForm contactId={effectiveContactId} conversationId={selectedConvId || undefined} />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

const sentimentConfig: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'text-green-700 bg-green-50' },
  neutral: { label: 'Neutral', color: 'text-gray-600 bg-gray-50' },
  mixed: { label: 'Mixed', color: 'text-amber-700 bg-amber-50' },
  concern: { label: 'Concern', color: 'text-red-700 bg-red-50' },
};

function AiSummaryContent({ summary }: { summary: CrmSummary }) {
  const sent = sentimentConfig[summary.sentiment] || sentimentConfig.neutral;
  return (
    <div className="px-4 py-3 space-y-2 text-xs">
      {/* Digest + sentiment */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-gray-700">{summary.interactionDigest}</p>
        <span
          className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${sent.color}`}
        >
          {sent.label}
        </span>
      </div>

      {/* Urgent flags */}
      {summary.urgentFlags.length > 0 && (
        <div className="space-y-1">
          {summary.urgentFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-1.5 text-red-700">
              <span className="flex-shrink-0 mt-0.5 text-[10px]">{'\u26A0'}</span>
              <span>{flag}</span>
            </div>
          ))}
        </div>
      )}

      {/* Outstanding items */}
      {summary.openItems.length > 0 && (
        <div>
          <p className="font-medium text-gray-600 mb-1">Outstanding</p>
          <ul className="space-y-0.5">
            {summary.openItems.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-gray-700">
                <span className="flex-shrink-0 mt-0.5 text-gray-400">{'\u25CB'}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent highlights */}
      {summary.recentHighlights.length > 0 && (
        <div>
          <p className="font-medium text-gray-600 mb-1">Recent</p>
          <ul className="space-y-0.5">
            {summary.recentHighlights.map((hl, i) => (
              <li key={i} className="flex items-start gap-1.5 text-gray-700">
                <span className="flex-shrink-0 mt-0.5 text-gray-400">{'\u2022'}</span>
                <span>{hl}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Topics */}
      {summary.topTopics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary.topTopics.map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
  onClick,
}: {
  conversation: Conversation;
  onClick: () => void;
}) {
  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-600',
    reopened: 'bg-orange-100 text-orange-800',
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 truncate">
          {conversation.subject || 'Untitled'}
        </span>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${statusColors[conversation.status] || statusColors.closed}`}
        >
          {conversation.status}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
        <span>
          {conversation.interactionCount} interaction
          {conversation.interactionCount !== 1 ? 's' : ''}
        </span>
        <span>&middot;</span>
        <span>{formatDate(conversation.updatedAt)}</span>
        {conversation.slaBreached && <span className="font-medium text-red-600">SLA Breached</span>}
      </div>
    </button>
  );
}

function CommitmentRow({ commitment }: { commitment: Commitment }) {
  const overdue =
    commitment.status !== 'fulfilled' &&
    commitment.status !== 'cancelled' &&
    isOverdue(commitment.targetDate);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    fulfilled: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
  };

  const effectiveStatus = overdue ? 'overdue' : commitment.status;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-800">{commitment.description}</p>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${statusColors[effectiveStatus] || statusColors.pending}`}
        >
          {effectiveStatus}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
        <span className={overdue ? 'font-medium text-red-600' : ''}>
          Due: {formatDate(commitment.targetDate)}
        </span>
        <span>&middot;</span>
        <span>Owner: {commitment.ownerAgent}</span>
      </div>
      {commitment.fulfillmentNote && (
        <p className="mt-1 text-xs text-green-700">{commitment.fulfillmentNote}</p>
      )}
    </div>
  );
}
