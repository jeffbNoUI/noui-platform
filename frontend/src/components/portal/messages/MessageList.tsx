import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useMemberConversations, useContactByMemberId } from '@/hooks/useCRM';
import type { Conversation } from '@/types/CRM';
import MessageThread from './MessageThread';

interface MessageListProps {
  memberId: string;
  onCompose?: () => void;
}

export default function MessageList({ memberId, onCompose }: MessageListProps) {
  const { data: conversations, isLoading } = useMemberConversations(memberId);
  const { data: contact } = useContactByMemberId(memberId);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const selectedConv = conversations?.find((c) => c.conversationId === selectedConvId);

  if (selectedConv && contact) {
    return (
      <MessageThread
        conversationId={selectedConv.conversationId}
        contactId={contact.contactId}
        subject={selectedConv.subject || 'Message'}
        memberId={memberId}
        onBack={() => setSelectedConvId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div
        data-testid="message-list-loading"
        style={{ padding: 24, textAlign: 'center', color: C.textSecondary, fontFamily: BODY }}
      >
        Loading messages...
      </div>
    );
  }

  const sorted = [...(conversations ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div data-testid="message-list">
      {/* Header with compose button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 17,
            fontWeight: 600,
            color: C.text,
            margin: 0,
          }}
        >
          Conversations
        </h3>
        {onCompose && (
          <button
            data-testid="compose-button"
            onClick={onCompose}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: C.sage,
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              cursor: 'pointer',
            }}
          >
            New Message
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div data-testid="message-list-empty" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✉</div>
          <div style={{ fontFamily: BODY, fontSize: 15, color: C.textSecondary }}>
            No messages yet
          </div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: C.textTertiary, marginTop: 4 }}>
            Send a message to get in touch with your plan administrator
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((conv) => (
            <ConversationRow
              key={conv.conversationId}
              conversation={conv}
              onClick={() => setSelectedConvId(conv.conversationId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
  onClick,
}: {
  conversation: Conversation;
  onClick: () => void;
}) {
  const isOpen =
    conversation.status === 'open' ||
    conversation.status === 'pending' ||
    conversation.status === 'reopened';
  const dateStr = new Date(conversation.updatedAt).toLocaleDateString();

  return (
    <button
      data-testid={`conversation-${conversation.conversationId}`}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: BODY,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isOpen ? C.sage : C.textTertiary,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>
          {conversation.subject || 'Message'}
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
          {conversation.interactionCount} message{conversation.interactionCount !== 1 ? 's' : ''} ·{' '}
          {conversation.status}
        </div>
      </div>
      <span style={{ fontSize: 12, color: C.textTertiary, flexShrink: 0 }}>{dateStr}</span>
    </button>
  );
}
