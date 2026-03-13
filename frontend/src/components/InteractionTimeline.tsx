import { useRef } from 'react';
import { useContactTimeline } from '@/hooks/useCRM';
import type { TimelineEntry, InteractionChannel, Direction } from '@/types/CRM';

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

// ── Channel display config ──────────────────────────────────────────────────

interface ChannelConfig {
  label: string;
  icon: React.ReactNode;
  dotColor: string;
  bgColor: string;
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function WalkInIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5"
      />
    </svg>
  );
}

function FaxIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  );
}

const channelConfig: Record<InteractionChannel, ChannelConfig> = {
  phone_inbound: {
    label: 'Phone',
    icon: <PhoneIcon />,
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50',
  },
  phone_outbound: {
    label: 'Phone',
    icon: <PhoneIcon />,
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50',
  },
  email_inbound: {
    label: 'Email',
    icon: <EmailIcon />,
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
  },
  email_outbound: {
    label: 'Email',
    icon: <EmailIcon />,
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
  },
  secure_message: {
    label: 'Message',
    icon: <MessageIcon />,
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-50',
  },
  walk_in: {
    label: 'Walk-In',
    icon: <WalkInIcon />,
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50',
  },
  portal_activity: {
    label: 'Portal',
    icon: <SystemIcon />,
    dotColor: 'bg-cyan-500',
    bgColor: 'bg-cyan-50',
  },
  mail_inbound: {
    label: 'Mail',
    icon: <MailIcon />,
    dotColor: 'bg-teal-500',
    bgColor: 'bg-teal-50',
  },
  mail_outbound: {
    label: 'Mail',
    icon: <MailIcon />,
    dotColor: 'bg-teal-500',
    bgColor: 'bg-teal-50',
  },
  internal_handoff: {
    label: 'Handoff',
    icon: <SystemIcon />,
    dotColor: 'bg-gray-500',
    bgColor: 'bg-gray-50',
  },
  system_event: {
    label: 'System',
    icon: <SystemIcon />,
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-50',
  },
  fax: { label: 'Fax', icon: <FaxIcon />, dotColor: 'bg-stone-500', bgColor: 'bg-stone-50' },
};

const directionArrow: Record<Direction, { arrow: string; label: string }> = {
  inbound: { arrow: '\u2192', label: 'Inbound' },
  outbound: { arrow: '\u2190', label: 'Outbound' },
  internal: { arrow: '\u2194', label: 'Internal' },
};

function formatTimestamp(isoStr: string): string {
  const date = new Date(isoStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function interactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    inquiry: 'Inquiry',
    request: 'Request',
    complaint: 'Complaint',
    follow_up: 'Follow-Up',
    outreach: 'Outreach',
    escalation: 'Escalation',
    callback: 'Callback',
    notification: 'Notification',
    status_update: 'Status Update',
    document_receipt: 'Document Receipt',
    process_event: 'Process Event',
    system_event: 'System Event',
  };
  return labels[type] || type;
}

// ── Main timeline component ─────────────────────────────────────────────────

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
              <TimelineEntryRow
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

// ── Single timeline entry row ───────────────────────────────────────────────

function TimelineEntryRow({
  entry,
  index,
  allEntries,
  onSelect,
}: {
  entry: TimelineEntry;
  index: number;
  allEntries: TimelineEntry[];
  onSelect?: (data: TimelineSelectData) => void;
}) {
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
