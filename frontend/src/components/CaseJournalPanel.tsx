import { useState, useMemo } from 'react';
import {
  useContactByMemberId,
  useContact,
  useFullTimeline,
  useMemberConversations,
  useAllConversationInteractions,
  useContactCommitments,
} from '@/hooks/useCRM';
import { useCorrespondenceHistory, useCaseCorrespondence } from '@/hooks/useCorrespondence';
import { PortalTimeline, ConversationThread, STAFF_THEME } from '@/components/crm';
import { composeCrmSummary } from '@/lib/crmSummary';
import type { CrmSummary } from '@/lib/crmSummary';
import CrmNoteForm from '@/components/CrmNoteForm';
import {
  AiSummaryContent,
  ConversationRow,
  CorrespondenceRow,
  CommitmentRow,
  isOverdue,
} from '@/components/CaseJournalPanelItems';

interface CaseJournalPanelProps {
  /** CRM contact ID, OR a legacy member ID (will be resolved) */
  contactId?: string;
  memberId?: string;
  /** When provided, correspondence tab filters by case instead of member. */
  caseId?: string;
}

type JournalTab = 'timeline' | 'conversations' | 'commitments' | 'correspondence';

export default function CaseJournalPanel({
  contactId: propContactId,
  memberId,
  caseId,
}: CaseJournalPanelProps) {
  const [activeTab, setActiveTab] = useState<JournalTab>('timeline');
  const [selectedConvId, setSelectedConvId] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(true);

  const { data: resolvedByMember } = useContactByMemberId(memberId ?? '');
  const { data: resolvedByProp } = useContact(propContactId ?? '');
  const resolvedContact = resolvedByMember || resolvedByProp;
  const effectiveContactId = resolvedContact?.contactId || propContactId || '';

  const effectiveMemberId = resolvedContact?.legacyMemberId ?? memberId ?? '';
  const { data: timeline } = useFullTimeline(effectiveContactId);
  const { data: conversations } = useMemberConversations(effectiveMemberId);
  const { data: convInteractions } = useAllConversationInteractions(selectedConvId);
  const { data: commitments } = useContactCommitments(effectiveContactId);
  const { data: caseCorrespondence } = useCaseCorrespondence(caseId ?? '');
  const { data: memberCorrespondence } = useCorrespondenceHistory(
    caseId ? 0 : Number(effectiveMemberId) || 0,
  );
  const correspondence = caseId ? caseCorrespondence : memberCorrespondence;
  const contactName = resolvedContact
    ? `${resolvedContact.firstName} ${resolvedContact.lastName}`
    : effectiveContactId;

  const convList = conversations ?? [];
  const commitmentList = commitments ?? [];
  const correspondenceList = correspondence ?? [];
  const overdueCommitments = commitmentList.filter(
    (c) => c.status !== 'fulfilled' && c.status !== 'cancelled' && isOverdue(c.targetDate),
  );
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
    {
      key: 'correspondence',
      label: 'Correspondence',
      count: correspondenceList.length,
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

        {activeTab === 'correspondence' && (
          <div className="divide-y divide-gray-100">
            {correspondenceList.map((item) => (
              <CorrespondenceRow key={item.correspondenceId} item={item} />
            ))}
            {correspondenceList.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                No correspondence found.
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
