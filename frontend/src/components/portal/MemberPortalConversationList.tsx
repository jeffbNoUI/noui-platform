import { C, DISPLAY, BODY } from '@/lib/designSystem';
import { formatRelativeDate } from './MemberPortalUtils';

interface Conversation {
  conversationId: string;
  subject?: string;
  status: string;
  interactionCount: number;
  updatedAt: string;
}

interface MemberPortalConversationListProps {
  convList: Conversation[];
  effectiveConvId: string;
  composing: boolean;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: C.sageLight, text: C.sage },
  pending: { bg: C.goldLight, text: C.gold },
  resolved: { bg: '#E8EDF4', text: C.navyLight },
  closed: { bg: '#F1F5F9', text: '#64748B' },
  reopened: { bg: C.coralLight, text: C.coral },
};

export default function MemberPortalConversationList({
  convList,
  effectiveConvId,
  composing,
  onSelectConversation,
  onNewConversation,
}: MemberPortalConversationListProps) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '16px 18px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 16,
            fontWeight: 600,
            color: C.navy,
          }}
        >
          Conversations
        </h3>
        <button
          onClick={onNewConversation}
          style={{
            padding: '5px 12px',
            borderRadius: 8,
            border: `1px solid ${C.sage}`,
            background: C.sageLight,
            color: C.sage,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BODY,
          }}
        >
          + New
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' as const }}>
        {convList.map((conv) => {
          const isSelected = conv.conversationId === effectiveConvId && !composing;
          const status = statusColors[conv.status] || statusColors.closed;
          const lastUpdated = formatRelativeDate(conv.updatedAt);

          return (
            <button
              key={conv.conversationId}
              onClick={() => onSelectConversation(conv.conversationId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left' as const,
                padding: '12px 18px',
                borderBottom: `1px solid ${C.borderLight}`,
                background: isSelected ? C.sageLight : 'transparent',
                cursor: 'pointer',
                border: 'none',
                borderLeft: isSelected ? `3px solid ${C.sage}` : '3px solid transparent',
                transition: 'all 0.15s ease',
                fontFamily: BODY,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.navy,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                    flex: 1,
                  }}
                >
                  {conv.subject || 'Untitled'}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: status.bg,
                    color: status.text,
                    fontSize: 10,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {conv.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 4 }}>
                {conv.interactionCount} message{conv.interactionCount !== 1 ? 's' : ''} &middot;{' '}
                {lastUpdated}
              </div>
            </button>
          );
        })}

        {convList.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: C.textTertiary, fontSize: 12 }}>
            No conversations yet. Click "+ New" to start one.
          </div>
        )}
      </div>
    </div>
  );
}
