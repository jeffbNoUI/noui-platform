import { useState, useMemo } from 'react';
import { useConversation, useUpdateConversation } from '@/hooks/useCRM';
import type { ConversationStatus, Interaction } from '@/types/CRM';

interface ConversationPanelProps {
  conversationId: string;
  onSelectInteraction?: (interactionId: string) => void;
}

// ── Status display config ───────────────────────────────────────────────────

const statusConfig: Record<ConversationStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
  reopened: { label: 'Reopened', color: 'bg-orange-100 text-orange-800' },
};

// ── Status transitions ──────────────────────────────────────────────────────

const statusTransitions: Record<ConversationStatus, { target: ConversationStatus; label: string; color: string }[]> = {
  open: [
    { target: 'resolved', label: 'Resolve', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { target: 'closed', label: 'Close', color: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  pending: [
    { target: 'resolved', label: 'Resolve', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { target: 'closed', label: 'Close', color: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  resolved: [
    { target: 'closed', label: 'Close', color: 'bg-gray-600 hover:bg-gray-700 text-white' },
    { target: 'reopened', label: 'Reopen', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
  ],
  closed: [
    { target: 'reopened', label: 'Reopen', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
  ],
  reopened: [
    { target: 'resolved', label: 'Resolve', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { target: 'closed', label: 'Close', color: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
};

// ── SLA helpers ─────────────────────────────────────────────────────────────

interface SLAState {
  label: string;
  color: string;
  timeRemaining: string;
  breached: boolean;
  warningLevel: 'safe' | 'warning' | 'danger' | 'breached';
}

function computeSLAState(slaDueAt: string | undefined, slaBreached: boolean): SLAState | null {
  if (!slaDueAt) return null;

  const now = new Date();
  const due = new Date(slaDueAt);
  const diffMs = due.getTime() - now.getTime();

  if (slaBreached || diffMs < 0) {
    const overMs = Math.abs(diffMs);
    return {
      label: 'SLA Breached',
      color: 'bg-red-100 border-red-300 text-red-800',
      timeRemaining: formatTimeDistance(overMs) + ' overdue',
      breached: true,
      warningLevel: 'breached',
    };
  }

  const totalMinutes = diffMs / 60000;
  if (totalMinutes <= 30) {
    return {
      label: 'SLA Critical',
      color: 'bg-red-50 border-red-200 text-red-700',
      timeRemaining: formatTimeDistance(diffMs) + ' remaining',
      breached: false,
      warningLevel: 'danger',
    };
  }

  if (totalMinutes <= 120) {
    return {
      label: 'SLA Warning',
      color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
      timeRemaining: formatTimeDistance(diffMs) + ' remaining',
      breached: false,
      warningLevel: 'warning',
    };
  }

  return {
    label: 'SLA OK',
    color: 'bg-green-50 border-green-200 text-green-700',
    timeRemaining: formatTimeDistance(diffMs) + ' remaining',
    breached: false,
    warningLevel: 'safe',
  };
}

function formatTimeDistance(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h`;
}

function formatTimestamp(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    phone_inbound: 'Phone In',
    phone_outbound: 'Phone Out',
    email_inbound: 'Email In',
    email_outbound: 'Email Out',
    secure_message: 'Message',
    walk_in: 'Walk-In',
    portal_activity: 'Portal',
    mail_inbound: 'Mail In',
    mail_outbound: 'Mail Out',
    internal_handoff: 'Handoff',
    system_event: 'System',
    fax: 'Fax',
  };
  return labels[channel] || channel;
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ConversationPanel({
  conversationId,
  onSelectInteraction,
}: ConversationPanelProps) {
  const { data: conversation, isLoading, error } = useConversation(conversationId);
  const updateMutation = useUpdateConversation();
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [showResolutionInput, setShowResolutionInput] = useState(false);

  const slaState = useMemo(
    () => (conversation ? computeSLAState(conversation.slaDueAt, conversation.slaBreached) : null),
    [conversation],
  );

  const handleStatusChange = (target: ConversationStatus) => {
    if (target === 'resolved' && !resolutionSummary && !showResolutionInput) {
      setShowResolutionInput(true);
      return;
    }

    updateMutation.mutate({
      conversationId,
      req: {
        status: target,
        ...(target === 'resolved' && resolutionSummary ? { resolutionSummary } : {}),
      },
    });
    setShowResolutionInput(false);
    setResolutionSummary('');
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
        Loading conversation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error.message}
      </div>
    );
  }

  if (!conversation) return null;

  const sc = statusConfig[conversation.status];
  const transitions = statusTransitions[conversation.status] ?? [];
  const interactions: Interaction[] = conversation.interactions ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {conversation.subject || 'Untitled Conversation'}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              {conversation.topicCategory && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {conversation.topicCategory}
                  {conversation.topicSubcategory && ` / ${conversation.topicSubcategory}`}
                </span>
              )}
              <span>&middot;</span>
              <span>{conversation.interactionCount} interaction{conversation.interactionCount !== 1 ? 's' : ''}</span>
              <span>&middot;</span>
              <span>Created {formatTimestamp(conversation.createdAt)}</span>
            </div>
          </div>

          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${sc.color}`}>
            {sc.label}
          </span>
        </div>

        {/* SLA indicator */}
        {slaState && (
          <div className={`mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${slaState.color}`}>
            {slaState.warningLevel === 'breached' || slaState.warningLevel === 'danger' ? (
              <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">{slaState.label}:</span>
            <span>{slaState.timeRemaining}</span>
          </div>
        )}

        {/* Assigned to */}
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          {conversation.assignedAgent && (
            <span>
              <span className="text-gray-400">Agent:</span>{' '}
              <span className="font-medium text-gray-700">{conversation.assignedAgent}</span>
            </span>
          )}
          {conversation.assignedTeam && (
            <span>
              <span className="text-gray-400">Team:</span>{' '}
              <span className="font-medium text-gray-700">{conversation.assignedTeam}</span>
            </span>
          )}
        </div>
      </div>

      {/* Resolution summary (if resolved) */}
      {conversation.resolutionSummary && (
        <div className="border-b border-gray-200 bg-green-50 px-6 py-3">
          <p className="text-sm">
            <span className="font-medium text-green-800">Resolution:</span>{' '}
            <span className="text-green-700">{conversation.resolutionSummary}</span>
          </p>
          {conversation.resolvedAt && (
            <p className="mt-0.5 text-xs text-green-600">
              Resolved {formatTimestamp(conversation.resolvedAt)}
              {conversation.resolvedBy && ` by ${conversation.resolvedBy}`}
            </p>
          )}
        </div>
      )}

      {/* Interaction list */}
      <div className="px-6 py-4">
        {interactions.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-4">No interactions in this conversation.</p>
        ) : (
          <ul className="space-y-3">
            {interactions.map((ix) => (
              <li
                key={ix.interactionId}
                className="rounded-md border border-gray-100 bg-gray-50 p-3 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">{channelLabel(ix.channel)}</span>
                    <span className="text-xs text-gray-400">
                      {ix.direction === 'inbound' ? '\u2192' : ix.direction === 'outbound' ? '\u2190' : '\u2194'}
                    </span>
                    {ix.outcome && (
                      <span className="rounded bg-white px-1.5 py-0.5 text-xs text-gray-600">
                        {ix.outcome.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {ix.durationSeconds != null && ix.durationSeconds > 0 && (
                      <span className="font-mono">
                        {Math.floor(ix.durationSeconds / 60)}m {ix.durationSeconds % 60}s
                      </span>
                    )}
                    <span>{formatTimestamp(ix.startedAt)}</span>
                  </div>
                </div>
                {ix.summary && <p className="mt-1 text-sm text-gray-600">{ix.summary}</p>}
                {ix.agentId && <p className="mt-0.5 text-xs text-gray-400">Agent: {ix.agentId}</p>}
                {onSelectInteraction && (
                  <button
                    type="button"
                    onClick={() => onSelectInteraction(ix.interactionId)}
                    className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    View details
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status workflow actions */}
      {transitions.length > 0 && (
        <div className="border-t border-gray-200 px-6 py-4">
          {showResolutionInput && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution Summary
              </label>
              <textarea
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                placeholder="Describe how this conversation was resolved..."
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            {transitions.map((t) => (
              <button
                key={t.target}
                type="button"
                onClick={() => handleStatusChange(t.target)}
                disabled={updateMutation.isPending}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${t.color}`}
              >
                {t.label}
              </button>
            ))}
            {showResolutionInput && (
              <button
                type="button"
                onClick={() => {
                  setShowResolutionInput(false);
                  setResolutionSummary('');
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </div>
          {updateMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{updateMutation.error.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
