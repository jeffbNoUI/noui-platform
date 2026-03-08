import type { ContactTimeline } from '@/types/CRM';
import { CHANNEL_ICONS, CHANNEL_LABELS, OUTCOME_STYLES } from '@/lib/channelMeta';

interface InteractionHistoryCardProps {
  timeline?: ContactTimeline;
  isLoading: boolean;
  onSelectInteraction?: (interactionId: string, rect: DOMRect) => void;
}

export default function InteractionHistoryCard({
  timeline,
  isLoading,
  onSelectInteraction,
}: InteractionHistoryCardProps) {
  const entries = timeline?.timelineEntries ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Recent Interactions</h3>
        {entries.length > 0 && (
          <span className="text-xs text-gray-400">{entries.length} total</span>
        )}
      </div>

      {isLoading && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">Loading interactions...</div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No interactions recorded</div>
      )}

      {entries.length > 0 && (
        <div className="divide-y divide-gray-100">
          {entries.slice(0, 10).map((entry) => (
            <button
              key={entry.interactionId}
              className="w-full text-left px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
              onClick={(e) => {
                if (onSelectInteraction) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onSelectInteraction(entry.interactionId, rect);
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm" title={CHANNEL_LABELS[entry.channel] || entry.channel}>
                    {CHANNEL_ICONS[entry.channel] || '\ud83d\udccc'}
                  </span>
                  <div>
                    <div className="text-sm text-gray-800">
                      {CHANNEL_LABELS[entry.channel] || entry.channel}
                    </div>
                    {entry.summary && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{entry.summary}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-xs text-gray-400">{formatTimelineDate(entry.startedAt)}</div>
                  {entry.outcome && (
                    <div
                      className={`text-[10px] font-medium ${OUTCOME_STYLES[entry.outcome] || 'text-gray-500'}`}
                    >
                      {entry.outcome.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </div>
              {/* Commitment & note indicators */}
              <div className="flex gap-2 mt-1.5">
                {entry.hasCommitments && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                    has commitments
                  </span>
                )}
                {entry.hasNotes && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">
                    has notes
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimelineDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
