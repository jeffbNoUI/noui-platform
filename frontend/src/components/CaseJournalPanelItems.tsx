import { useState } from 'react';
import type { CrmSummary } from '@/lib/crmSummary';
import type { Conversation, Commitment } from '@/types/CRM';
import type { Correspondence } from '@/types/Correspondence';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isOverdue(dateStr: string): boolean {
  return new Date(dateStr + 'T23:59:59') < new Date();
}

// ── AI Summary ───────────────────────────────────────────────────────────────

const sentimentConfig: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'text-green-700 bg-green-50' },
  neutral: { label: 'Neutral', color: 'text-gray-600 bg-gray-50' },
  mixed: { label: 'Mixed', color: 'text-amber-700 bg-amber-50' },
  concern: { label: 'Concern', color: 'text-red-700 bg-red-50' },
};

export function AiSummaryContent({ summary }: { summary: CrmSummary }) {
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

// ── Conversation Row ─────────────────────────────────────────────────────────

export function ConversationRow({
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

// ── Correspondence Row ───────────────────────────────────────────────────────

export function CorrespondenceRow({ item }: { item: Correspondence }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    final: 'bg-blue-100 text-blue-800',
    sent: 'bg-green-100 text-green-800',
    void: 'bg-red-100 text-red-800',
  };

  const displayDate = item.sentAt || item.createdAt;

  return (
    <div className="px-4 py-3">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800 truncate">
            {item.subject || 'Untitled'}
          </span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${statusColors[item.status] || statusColors.draft}`}
          >
            {item.status}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          <span>{formatDate(displayDate)}</span>
          {item.sentVia && (
            <>
              <span>&middot;</span>
              <span>via {item.sentVia}</span>
            </>
          )}
        </div>
      </button>
      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 rounded p-3 border border-gray-200 max-h-60 overflow-y-auto">
          {item.bodyRendered}
        </pre>
      )}
    </div>
  );
}

// ── Commitment Row ───────────────────────────────────────────────────────────

export function CommitmentRow({ commitment }: { commitment: Commitment }) {
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
