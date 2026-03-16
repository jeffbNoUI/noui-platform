import type { Interaction } from '@/types/CRM';
import type { PortalTheme } from './ConversationThread';

interface ConversationThreadBubbleProps {
  interaction: Interaction;
  visibility: 'public' | 'all';
  theme: PortalTheme;
  alignRight: boolean;
  isInternal: boolean;
  isFromCurrentUser: boolean;
  formattedTime: string;
}

export default function ConversationThreadBubble({
  interaction,
  visibility,
  theme,
  alignRight,
  isInternal,
  isFromCurrentUser,
  formattedTime,
}: ConversationThreadBubbleProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignRight ? 'flex-end' : 'flex-start',
        padding: '0 4px',
      }}
    >
      {/* Sender label */}
      <div
        style={{
          fontSize: 11,
          color: theme.muted,
          marginBottom: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {interaction.agentId && !isFromCurrentUser && (
          <span style={{ fontWeight: 600 }}>
            {interaction.agentId === 'agent-sarah'
              ? 'Sarah'
              : interaction.agentId === 'agent-mike'
                ? 'Mike'
                : interaction.agentId}
          </span>
        )}
        {isFromCurrentUser && <span style={{ fontWeight: 600 }}>You</span>}
        {!interaction.agentId && !isFromCurrentUser && interaction.contactId && (
          <span style={{ fontWeight: 600 }}>Member</span>
        )}
        <span>{formattedTime}</span>
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
        {interaction.visibility === 'public' && visibility === 'all' && (
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              background: '#DCFCE7',
              color: '#166534',
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            }}
          >
            Public
          </span>
        )}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: 14,
          borderTopLeftRadius: alignRight ? 14 : 4,
          borderTopRightRadius: alignRight ? 4 : 14,
          background: isInternal
            ? 'repeating-linear-gradient(135deg, #FFF7ED, #FFF7ED 8px, #FEF3C7 8px, #FEF3C7 9px)'
            : alignRight
              ? theme.outboundBg
              : theme.inboundBg,
          color: isInternal ? '#92400E' : alignRight ? theme.outboundText : theme.inboundText,
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap' as const,
          wordBreak: 'break-word' as const,
        }}
      >
        {interaction.summary}
      </div>
    </div>
  );
}
