import { useRef } from 'react';
import type { TimelineEntry } from '@/types/CRM';
import type { TimelineSelectData } from '@/components/InteractionTimeline';
import {
  channelConfig,
  directionArrow,
  formatTimestamp,
  formatDuration,
  interactionTypeLabel,
  SystemIcon,
} from '@/components/InteractionTimelineIcons';

interface TimelineEntryRowProps {
  entry: TimelineEntry;
  index: number;
  allEntries: TimelineEntry[];
  onSelect?: (data: TimelineSelectData) => void;
}

export default function InteractionTimelineEntryRow({
  entry,
  index,
  allEntries,
  onSelect,
}: TimelineEntryRowProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const cfg = channelConfig[entry.channel] ?? {
    label: entry.channel,
    icon: <SystemIcon />,
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-50',
  };
  const dir = directionArrow[entry.direction] ?? { arrow: '\u00b7', label: entry.direction };

  const handleSelect = () => {
    if (!onSelect || !rowRef.current) return;
    onSelect({
      interactionId: entry.interactionId,
      entry,
      sourceRect: rowRef.current.getBoundingClientRect(),
      entries: allEntries,
      index,
    });
  };

  return (
    <li ref={rowRef} className="relative pl-10">
      {/* Timeline dot */}
      <div
        className={`absolute left-2.5 top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white ${cfg.dotColor}`}
      />

      <div
        onClick={handleSelect}
        className={`rounded-md border border-gray-100 p-3 transition-colors hover:border-gray-200 ${cfg.bgColor}${onSelect ? ' cursor-pointer' : ''}`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">{cfg.icon}</span>
            <span className="text-sm font-medium text-gray-900">{cfg.label}</span>
            <span className="text-xs text-gray-400" title={dir.label}>
              {dir.arrow}
            </span>
            <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-medium text-gray-700">
              {interactionTypeLabel(entry.interactionType)}
            </span>
            {entry.visibility === 'internal' && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">
                Internal
              </span>
            )}
            {entry.hasNotes && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                [notes]
              </span>
            )}
            {entry.hasCommitments && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                [commitments]
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {entry.durationSeconds != null && entry.durationSeconds > 0 && (
              <span className="font-mono">{formatDuration(entry.durationSeconds)}</span>
            )}
            <span>{formatTimestamp(entry.startedAt)}</span>
          </div>
        </div>

        {/* Agent and summary */}
        <div className="mt-1.5">
          {entry.agentId && <span className="text-xs text-gray-500">Agent: {entry.agentId}</span>}
          {entry.summary && <p className="mt-0.5 text-sm text-gray-700">{entry.summary}</p>}
        </div>
      </div>
    </li>
  );
}
