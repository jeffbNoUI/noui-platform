import { useRef, useState, useMemo } from 'react';
import type { ContactTimeline, TimelineEntry } from '@/types/CRM';
import { CHANNEL_ICONS, CHANNEL_LABELS, OUTCOME_STYLES } from '@/lib/channelMeta';

export interface InteractionRowClickData {
  interactionId: string;
  entry: TimelineEntry;
  sourceRect: DOMRect;
  entries: TimelineEntry[];
  index: number;
}

interface InteractionHistoryCardProps {
  timeline?: ContactTimeline;
  isLoading: boolean;
  onSelectInteraction?: (data: InteractionRowClickData) => void;
}

export default function InteractionHistoryCard({
  timeline,
  isLoading,
  onSelectInteraction,
}: InteractionHistoryCardProps) {
  const entries = useMemo(() => timeline?.timelineEntries ?? [], [timeline]);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return entries;
    const q = searchTerm.toLowerCase();
    return entries.filter((e) => {
      const channelLabel = CHANNEL_LABELS[e.channel.toLowerCase()] || e.channel;
      const outcomeLabel = e.outcome?.toLowerCase().replace(/_/g, ' ') || '';
      return (
        channelLabel.toLowerCase().includes(q) ||
        outcomeLabel.includes(q) ||
        (e.summary?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, searchTerm]);

  // When search is active, show all matches; otherwise cap at 10
  const displayEntries = searchTerm.trim() ? filteredEntries : filteredEntries.slice(0, 10);

  const handleRowClick = (entry: TimelineEntry) => {
    const el = rowRefs.current.get(entry.interactionId);
    if (!el || !onSelectInteraction) return;
    const idx = displayEntries.indexOf(entry);
    onSelectInteraction({
      interactionId: entry.interactionId,
      entry,
      sourceRect: el.getBoundingClientRect(),
      entries: displayEntries,
      index: idx >= 0 ? idx : 0,
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 shrink-0">Recent Interactions</h3>
        <div className="flex items-center gap-3">
          {entries.length > 0 && (
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-48 rounded-md border border-gray-200 bg-gray-50 pl-7 pr-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300"
              />
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}
          {entries.length > 0 && (
            <span className="text-xs text-gray-400 shrink-0">
              {searchTerm.trim()
                ? `${filteredEntries.length} of ${entries.length} matching`
                : `${entries.length} total`}
            </span>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">Loading interactions...</div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No interactions recorded</div>
      )}

      {!isLoading && entries.length > 0 && displayEntries.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          No interactions match &ldquo;{searchTerm}&rdquo;
        </div>
      )}

      {displayEntries.length > 0 && (
        <div className="divide-y divide-gray-100">
          {displayEntries.map((entry) => (
            <div
              key={entry.interactionId}
              ref={(el) => {
                if (el) rowRefs.current.set(entry.interactionId, el);
                else rowRefs.current.delete(entry.interactionId);
              }}
              onClick={() => handleRowClick(entry)}
              className={`px-5 py-3 ${onSelectInteraction ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm"
                    title={CHANNEL_LABELS[entry.channel.toLowerCase()] || entry.channel}
                  >
                    {CHANNEL_ICONS[entry.channel.toLowerCase()] || '\ud83d\udccc'}
                  </span>
                  <div>
                    <div className="text-sm text-gray-800">
                      {CHANNEL_LABELS[entry.channel.toLowerCase()] || entry.channel}
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
                      className={`text-[10px] font-medium ${OUTCOME_STYLES[entry.outcome.toLowerCase()] || 'text-gray-500'}`}
                    >
                      {entry.outcome.toLowerCase().replace(/_/g, ' ')}
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
            </div>
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
