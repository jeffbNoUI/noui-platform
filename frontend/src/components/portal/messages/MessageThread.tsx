import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { usePublicConversationInteractions, useCreateMemberMessage } from '@/hooks/useCRM';
import type { Interaction } from '@/types/CRM';

interface MessageThreadProps {
  conversationId: string;
  contactId: string;
  subject: string;
  onBack: () => void;
}

export default function MessageThread({
  conversationId,
  contactId,
  subject,
  onBack,
}: MessageThreadProps) {
  const { data: interactions, isLoading } = usePublicConversationInteractions(conversationId);
  const sendMessage = useCreateMemberMessage();
  const [replyText, setReplyText] = useState('');

  const handleSend = () => {
    if (!replyText.trim()) return;
    sendMessage.mutate(
      {
        conversationId,
        contactId,
        content: replyText.trim(),
        direction: 'inbound',
      },
      { onSuccess: () => setReplyText('') },
    );
  };

  return (
    <div data-testid="message-thread">
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          data-testid="thread-back"
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: C.textSecondary,
            padding: '4px 8px',
          }}
        >
          ←
        </button>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.text,
            margin: 0,
          }}
        >
          {subject}
        </h2>
      </div>

      {/* Messages */}
      {isLoading ? (
        <div
          data-testid="thread-loading"
          style={{ padding: 24, textAlign: 'center', color: C.textSecondary, fontFamily: BODY }}
        >
          Loading messages...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {(interactions ?? []).map((msg) => (
            <MessageBubble key={msg.interactionId} interaction={msg} />
          ))}
          {interactions?.length === 0 && (
            <div
              style={{ padding: 24, textAlign: 'center', color: C.textTertiary, fontFamily: BODY }}
            >
              No messages yet
            </div>
          )}
        </div>
      )}

      {/* Reply input */}
      <div
        data-testid="thread-reply"
        style={{
          display: 'flex',
          gap: 8,
          padding: 16,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.border}`,
        }}
      >
        <textarea
          data-testid="reply-input"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Type your message..."
          rows={2}
          style={{
            flex: 1,
            fontFamily: BODY,
            fontSize: 14,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 6,
            padding: '8px 12px',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <button
          data-testid="send-button"
          onClick={handleSend}
          disabled={!replyText.trim() || sendMessage.isPending}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: replyText.trim() ? C.sage : C.textTertiary,
            border: 'none',
            borderRadius: 6,
            padding: '8px 20px',
            cursor: replyText.trim() ? 'pointer' : 'not-allowed',
            alignSelf: 'flex-end',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ interaction }: { interaction: Interaction }) {
  const isInbound = interaction.direction === 'inbound';
  const time = new Date(interaction.startedAt).toLocaleString();

  return (
    <div
      data-testid={`message-${interaction.interactionId}`}
      style={{
        maxWidth: '75%',
        alignSelf: isInbound ? 'flex-end' : 'flex-start',
        background: isInbound ? C.sageLight : C.cardBg,
        border: `1px solid ${isInbound ? 'transparent' : C.borderLight}`,
        borderRadius: 12,
        padding: '10px 14px',
      }}
    >
      <div style={{ fontFamily: BODY, fontSize: 14, color: C.text, lineHeight: 1.5 }}>
        {interaction.summary}
      </div>
      <div
        style={{
          fontFamily: BODY,
          fontSize: 11,
          color: C.textTertiary,
          marginTop: 4,
          textAlign: 'right',
        }}
      >
        {isInbound ? 'You' : 'Staff'} · {time}
      </div>
    </div>
  );
}
