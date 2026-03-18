import { useState, useMemo } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useFullTimeline, useContactByMemberId } from '@/hooks/useCRM';
import type { TimelineEntry, InteractionChannel } from '@/types/CRM';

interface InteractionHistoryProps {
  memberId: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  phone_inbound: 'Phone (Inbound)',
  phone_outbound: 'Phone (Outbound)',
  secure_message: 'Portal Message',
  email_inbound: 'Email (Inbound)',
  email_outbound: 'Email (Outbound)',
  walk_in: 'In-Person Visit',
  portal_activity: 'Portal Activity',
  mail_inbound: 'Mail (Received)',
  mail_outbound: 'Mail (Sent)',
  system_event: 'System',
  fax: 'Fax',
  internal_handoff: 'Internal',
};

const CHANNEL_ICONS: Record<string, string> = {
  phone_inbound: '\u{1F4DE}',
  phone_outbound: '\u{1F4DE}',
  secure_message: '\u2709',
  email_inbound: '\u{1F4E7}',
  email_outbound: '\u{1F4E7}',
  walk_in: '\u{1F3E2}',
  portal_activity: '\u{1F310}',
  mail_inbound: '\u{1F4EC}',
  mail_outbound: '\u{1F4EE}',
  system_event: '\u2699',
  fax: '\u{1F4E0}',
  internal_handoff: '\u{1F504}',
};

// Channels to offer in the filter — only member-visible ones
const FILTERABLE_CHANNELS: InteractionChannel[] = [
  'phone_inbound',
  'phone_outbound',
  'secure_message',
  'email_inbound',
  'email_outbound',
  'walk_in',
  'mail_inbound',
  'mail_outbound',
];

export default function InteractionHistory({ memberId }: InteractionHistoryProps) {
  const { data: contact, isLoading: contactLoading } = useContactByMemberId(memberId);
  const { data: timeline, isLoading: timelineLoading } = useFullTimeline(contact?.contactId ?? '');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const isLoading = contactLoading || timelineLoading;

  // Filter to only public visibility entries and apply channel filter
  const filteredEntries = useMemo(() => {
    if (!timeline?.timelineEntries) return [];
    return timeline.timelineEntries.filter((entry) => {
      if (entry.visibility !== 'public') return false;
      if (channelFilter !== 'all' && entry.channel !== channelFilter) return false;
      return true;
    });
  }, [timeline, channelFilter]);

  if (isLoading) {
    return (
      <div
        data-testid="history-loading"
        style={{ padding: 24, textAlign: 'center', color: C.textSecondary, fontFamily: BODY }}
      >
        Loading interaction history...
      </div>
    );
  }

  return (
    <div data-testid="interaction-history">
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <label
          htmlFor="channel-filter"
          style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.textSecondary }}
        >
          Filter:
        </label>
        <select
          id="channel-filter"
          data-testid="channel-filter"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.cardBg,
            outline: 'none',
          }}
        >
          <option value="all">All channels</option>
          {FILTERABLE_CHANNELS.map((ch) => (
            <option key={ch} value={ch}>
              {CHANNEL_LABELS[ch] || ch}
            </option>
          ))}
        </select>
        <span style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary }}>
          {filteredEntries.length} interaction{filteredEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      {filteredEntries.length === 0 ? (
        <div data-testid="history-empty" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontFamily: BODY, fontSize: 15, color: C.textSecondary }}>
            No interaction history found
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredEntries.map((entry) => (
            <TimelineRow key={entry.interactionId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const date = new Date(entry.startedAt);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const icon = CHANNEL_ICONS[entry.channel] || '\u2022';
  const label = CHANNEL_LABELS[entry.channel] || entry.channel;

  return (
    <div
      data-testid={`history-entry-${entry.interactionId}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: C.cardBg,
        borderRadius: 8,
        border: `1px solid ${C.borderLight}`,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, color: C.text }}>
          {label}
        </div>
        {entry.summary && (
          <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
            {entry.summary}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary }}>{dateStr}</div>
        <div style={{ fontFamily: BODY, fontSize: 11, color: C.textTertiary }}>{timeStr}</div>
      </div>
    </div>
  );
}
