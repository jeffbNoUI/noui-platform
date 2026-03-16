import type { Interaction } from '@/types/CRM';

interface ConversationPanelThreadViewProps {
  interactions: Interaction[];
  onSelectInteraction?: (interactionId: string) => void;
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

export default function ConversationPanelThreadView({
  interactions,
  onSelectInteraction,
}: ConversationPanelThreadViewProps) {
  if (interactions.length === 0) {
    return (
      <p className="text-center text-sm text-gray-500 py-4">
        No interactions in this conversation.
      </p>
    );
  }

  return (
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
                {ix.direction === 'inbound'
                  ? '\u2192'
                  : ix.direction === 'outbound'
                    ? '\u2190'
                    : '\u2194'}
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
  );
}
