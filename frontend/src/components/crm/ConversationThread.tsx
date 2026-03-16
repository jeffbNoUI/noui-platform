import type { Interaction } from '@/types/CRM';
import { C, BODY } from '@/lib/designSystem';
import ConversationThreadBubble from './ConversationThreadBubble';

// ── Portal theme presets ────────────────────────────────────────────────────

export interface PortalTheme {
  /** Primary action / accent color */
  accent: string;
  accentLight: string;
  /** Background for the container */
  containerBg: string;
  /** Inbound bubble colors */
  inboundBg: string;
  inboundText: string;
  /** Outbound bubble colors */
  outboundBg: string;
  outboundText: string;
  /** System event pill */
  systemBg: string;
  systemText: string;
  /** Muted text */
  muted: string;
  /** Badge colors for visibility */
  internalBadgeBg: string;
  internalBadgeText: string;
}

export const MEMBER_THEME: PortalTheme = {
  accent: C.sage,
  accentLight: C.sageLight,
  containerBg: C.cardBg,
  inboundBg: '#F1F5F9',
  inboundText: C.text,
  outboundBg: C.sageLight,
  outboundText: '#2D5A44',
  systemBg: C.goldLight,
  systemText: C.gold,
  muted: C.textTertiary,
  internalBadgeBg: '#E2E8F0',
  internalBadgeText: '#64748B',
};

export const STAFF_THEME: PortalTheme = {
  accent: C.navy,
  accentLight: '#E8EDF4',
  containerBg: C.cardBg,
  inboundBg: '#F1F5F9',
  inboundText: C.text,
  outboundBg: '#E8EDF4',
  outboundText: C.navy,
  systemBg: '#FEF3C7',
  systemText: '#92400E',
  muted: C.textTertiary,
  internalBadgeBg: '#FEE2E2',
  internalBadgeText: '#991B1B',
};

export const EMPLOYER_THEME: PortalTheme = {
  accent: '#475569',
  accentLight: '#F1F5F9',
  containerBg: C.cardBg,
  inboundBg: '#F8FAFC',
  inboundText: C.text,
  outboundBg: '#E2E8F0',
  outboundText: '#1E293B',
  systemBg: '#ECFDF5',
  systemText: '#065F46',
  muted: '#94A3B8',
  internalBadgeBg: '#FEE2E2',
  internalBadgeText: '#991B1B',
};

// ── Formatting ──────────────────────────────────────────────────────────────

function formatMessageTime(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Component ───────────────────────────────────────────────────────────────

interface ConversationThreadProps {
  interactions: Interaction[];
  /** 'public' hides internal items; 'all' shows everything with visibility badges */
  visibility: 'public' | 'all';
  theme: PortalTheme;
  /** ID of the current user's contact (to determine inbound vs outbound alignment) */
  currentContactId?: string;
}

export default function ConversationThread({
  interactions,
  visibility,
  theme,
  currentContactId,
}: ConversationThreadProps) {
  const filtered =
    visibility === 'public' ? interactions.filter((i) => i.visibility === 'public') : interactions;

  if (filtered.length === 0) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: theme.muted,
          fontSize: 13,
          fontFamily: BODY,
        }}
      >
        No messages in this conversation yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 0',
        fontFamily: BODY,
      }}
    >
      {filtered.map((interaction) => {
        const isSystem =
          interaction.channel === 'system_event' || interaction.interactionType === 'process_event';
        const isInternal = interaction.visibility === 'internal';
        const isOutbound = interaction.direction === 'outbound';
        const isFromCurrentUser =
          currentContactId &&
          interaction.contactId === currentContactId &&
          interaction.direction === 'inbound';

        // System events render as centered pills
        if (isSystem) {
          return (
            <div
              key={interaction.interactionId}
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '4px 0',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: theme.systemBg,
                  color: theme.systemText,
                  fontSize: 11,
                  fontWeight: 500,
                  maxWidth: '80%',
                  textAlign: 'center',
                }}
              >
                {isInternal && visibility === 'all' && (
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: theme.internalBadgeBg,
                      color: theme.internalBadgeText,
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.5px',
                    }}
                  >
                    Internal
                  </span>
                )}
                {interaction.summary}
              </div>
            </div>
          );
        }

        // Chat bubbles: outbound right-aligned, inbound left-aligned
        // For member portal: their own messages are right (inbound from CRM perspective)
        const alignRight = currentContactId ? !!isFromCurrentUser : isOutbound;

        return (
          <ConversationThreadBubble
            key={interaction.interactionId}
            interaction={interaction}
            visibility={visibility}
            theme={theme}
            alignRight={alignRight}
            isInternal={isInternal}
            isFromCurrentUser={!!isFromCurrentUser}
            formattedTime={formatMessageTime(interaction.startedAt)}
          />
        );
      })}
    </div>
  );
}
