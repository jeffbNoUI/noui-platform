import { useMemberConversations } from '@/hooks/useCRM';
import { C, DISPLAY, BODY } from '@/lib/designSystem';
import { formatRelativeDate } from './MemberPortalUtils';

interface MemberPortalRecentMessagesProps {
  memberID: number;
  onViewAll: () => void;
}

export default function MemberPortalRecentMessages({
  memberID,
  onViewAll,
}: MemberPortalRecentMessagesProps) {
  const { data: conversations } = useMemberConversations(String(memberID));

  const recent = (conversations ?? []).slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <div className="portal-card" style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 16,
              fontWeight: 600,
              color: C.navy,
              marginBottom: 2,
            }}
          >
            Recent Messages
          </h3>
          <p style={{ fontSize: 12, color: C.textTertiary }}>
            Your latest conversations with plan staff
          </p>
        </div>
        <button
          onClick={onViewAll}
          style={{
            padding: '6px 14px',
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
          View all
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent.map((conv) => (
          <button
            key={conv.conversationId}
            onClick={onViewAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${C.borderLight}`,
              background: C.cardBgWarm,
              cursor: 'pointer',
              textAlign: 'left' as const,
              width: '100%',
              fontFamily: BODY,
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.navy,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {conv.subject || 'Untitled'}
              </div>
              <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
                {conv.interactionCount} message{conv.interactionCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textTertiary, flexShrink: 0, marginLeft: 12 }}>
              {formatRelativeDate(conv.updatedAt)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
