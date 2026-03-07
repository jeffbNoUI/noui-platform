import type { TimelineEntry, InteractionChannel, Direction } from '@/types/CRM';
import type { PortalTheme } from './ConversationThread';
import { BODY, MONO } from '@/lib/designSystem';

// ── Channel icons (text-based for portability) ──────────────────────────────

const channelIcon: Record<string, string> = {
  phone_inbound: '\u260E',
  phone_outbound: '\u260E',
  email_inbound: '\u2709',
  email_outbound: '\u2709',
  secure_message: '\u{1F4AC}',
  walk_in: '\u{1F464}',
  portal_activity: '\u{1F4BB}',
  mail_inbound: '\u{1F4E8}',
  mail_outbound: '\u{1F4E8}',
  internal_handoff: '\u{1F501}',
  system_event: '\u2699',
  fax: '\u{1F4E0}',
};

const directionLabel: Record<Direction, string> = {
  inbound: '\u2192 In',
  outbound: '\u2190 Out',
  internal: '\u2194 Internal',
};

function formatRelativeTime(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function channelLabel(ch: InteractionChannel): string {
  const labels: Record<string, string> = {
    phone_inbound: 'Phone',
    phone_outbound: 'Phone',
    email_inbound: 'Email',
    email_outbound: 'Email',
    secure_message: 'Message',
    walk_in: 'Walk-In',
    portal_activity: 'Portal',
    mail_inbound: 'Mail',
    mail_outbound: 'Mail',
    internal_handoff: 'Handoff',
    system_event: 'System',
    fax: 'Fax',
  };
  return labels[ch] || ch;
}

// ── Component ───────────────────────────────────────────────────────────────

interface PortalTimelineProps {
  entries: TimelineEntry[];
  /** 'public' hides internal entries; 'all' shows with badges */
  visibility: 'public' | 'all';
  theme: PortalTheme;
  /** Compact mode for sidebar/panel use */
  compact?: boolean;
  onSelectEntry?: (interactionId: string) => void;
}

export default function PortalTimeline({
  entries,
  visibility,
  theme,
  compact = false,
  onSelectEntry,
}: PortalTimelineProps) {
  const filtered = visibility === 'public'
    ? entries.filter((e) => e.visibility === 'public')
    : entries;

  if (filtered.length === 0) {
    return (
      <div style={{
        padding: compact ? '16px 12px' : '24px 16px',
        textAlign: 'center',
        color: theme.muted,
        fontSize: 12,
        fontFamily: BODY,
      }}>
        No interactions recorded.
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      paddingLeft: compact ? 20 : 28,
      fontFamily: BODY,
    }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute',
        left: compact ? 5 : 9,
        top: 8,
        bottom: 8,
        width: 2,
        background: `${theme.accent}22`,
        borderRadius: 1,
      }} />

      {filtered.map((entry) => {
        const isInternal = entry.visibility === 'internal';

        return (
          <div
            key={entry.interactionId}
            onClick={() => onSelectEntry?.(entry.interactionId)}
            style={{
              position: 'relative',
              padding: compact ? '6px 0' : '8px 0',
              cursor: onSelectEntry ? 'pointer' : 'default',
            }}
          >
            {/* Timeline dot */}
            <div style={{
              position: 'absolute',
              left: compact ? -18 : -24,
              top: compact ? 10 : 12,
              width: compact ? 8 : 10,
              height: compact ? 8 : 10,
              borderRadius: '50%',
              background: isInternal ? theme.internalBadgeBg : `${theme.accent}33`,
              border: `2px solid ${isInternal ? theme.internalBadgeText : theme.accent}`,
            }} />

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Channel + direction + badges */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap' as const,
                }}>
                  <span style={{ fontSize: compact ? 12 : 14 }}>
                    {channelIcon[entry.channel] || '\u25CF'}
                  </span>
                  <span style={{
                    fontSize: compact ? 11 : 12,
                    fontWeight: 600,
                    color: theme.inboundText,
                  }}>
                    {channelLabel(entry.channel)}
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: theme.muted,
                    fontFamily: MONO,
                  }}>
                    {directionLabel[entry.direction]}
                  </span>
                  {visibility === 'all' && (
                    <span style={{
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.3px',
                      background: isInternal ? theme.internalBadgeBg : '#DCFCE7',
                      color: isInternal ? theme.internalBadgeText : '#166534',
                    }}>
                      {isInternal ? 'Internal' : 'Public'}
                    </span>
                  )}
                </div>

                {/* Summary (one-line in compact mode) */}
                {entry.summary && (
                  <div style={{
                    fontSize: compact ? 11 : 12,
                    color: theme.muted,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: compact ? 'nowrap' as const : 'normal' as const,
                    maxWidth: compact ? '100%' : undefined,
                    lineHeight: 1.4,
                    ...(compact ? {} : {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                    }),
                  }}>
                    {entry.summary}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span style={{
                fontSize: 10,
                color: theme.muted,
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
                marginTop: 1,
              }}>
                {formatRelativeTime(entry.startedAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
