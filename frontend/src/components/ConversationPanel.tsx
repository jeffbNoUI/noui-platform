import { useState, useMemo } from 'react';
import { useConversation, useUpdateConversation } from '@/hooks/useCRM';
import type { ConversationStatus, Interaction } from '@/types/CRM';
import { computeSLAState, formatTimestamp } from './ConversationPanelHelpers';
import ConversationPanelThreadView from './ConversationPanelThreadView';
import ConversationPanelComposer from './ConversationPanelComposer';

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

  const sc = statusConfig[conversation.status] ?? {
    label: conversation.status,
    color: 'bg-gray-100 text-gray-600',
  };
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
              <span>
                {conversation.interactionCount} interaction
                {conversation.interactionCount !== 1 ? 's' : ''}
              </span>
              <span>&middot;</span>
              <span>Created {formatTimestamp(conversation.createdAt)}</span>
            </div>
          </div>

          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${sc.color}`}
          >
            {sc.label}
          </span>
        </div>

        {/* SLA indicator */}
        {slaState && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${slaState.color}`}
          >
            {slaState.warningLevel === 'breached' || slaState.warningLevel === 'danger' ? (
              <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
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
        <ConversationPanelThreadView
          interactions={interactions}
          onSelectInteraction={onSelectInteraction}
        />
      </div>

      {/* Status workflow actions */}
      <ConversationPanelComposer
        status={conversation.status}
        resolutionSummary={resolutionSummary}
        onResolutionSummaryChange={setResolutionSummary}
        showResolutionInput={showResolutionInput}
        onStatusChange={handleStatusChange}
        onCancelResolution={() => {
          setShowResolutionInput(false);
          setResolutionSummary('');
        }}
        isPending={updateMutation.isPending}
        errorMessage={updateMutation.isError ? updateMutation.error.message : undefined}
      />
    </div>
  );
}
