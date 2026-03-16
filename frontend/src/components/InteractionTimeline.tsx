import { useContactTimeline } from '@/hooks/useCRM';
import type { TimelineEntry, InteractionChannel } from '@/types/CRM';
import { channelConfig } from '@/components/InteractionTimelineIcons';
import InteractionTimelineEntryRow from '@/components/InteractionTimelineEntryRow';

export interface TimelineSelectData {
  interactionId: string;
  entry: TimelineEntry;
  sourceRect: DOMRect;
  entries: TimelineEntry[];
  index: number;
}

interface InteractionTimelineProps {
  contactId: string;
  onSelectInteraction?: (data: TimelineSelectData) => void;
  limit?: number;
}

export default function InteractionTimeline({
  contactId,
  onSelectInteraction,
  limit,
}: InteractionTimelineProps) {
  const { data: timeline, isLoading, error } = useContactTimeline(contactId, limit);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
        Loading interaction timeline...
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

  if (!timeline || timeline.timelineEntries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Interaction Timeline</h2>
        </div>
        <div className="px-6 py-8 text-center text-sm text-gray-500">
          No interactions recorded for this contact.
        </div>
      </div>
    );
  }

  const entries = timeline.timelineEntries;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Interaction Timeline</h2>
            <p className="text-sm text-gray-500">
              {timeline.totalEntries} interaction{timeline.totalEntries !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-1">
            {timeline.channels.map((ch) => {
              const cfg = channelConfig[ch as InteractionChannel];
              return cfg ? (
                <span
                  key={ch}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bgColor} text-gray-700`}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          <ul className="space-y-4">
            {entries.map((entry, idx) => (
              <InteractionTimelineEntryRow
                key={entry.interactionId}
                entry={entry}
                index={idx}
                allEntries={entries}
                onSelect={onSelectInteraction}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
