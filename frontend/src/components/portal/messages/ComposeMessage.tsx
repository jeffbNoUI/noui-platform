// frontend/src/components/portal/messages/ComposeMessage.tsx
import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useCreateMemberConversation, useContactByMemberId } from '@/hooks/useCRM';

interface ComposeMessageProps {
  memberId: string;
  onSent: () => void;
  onCancel: () => void;
}

export default function ComposeMessage({ memberId, onSent, onCancel }: ComposeMessageProps) {
  const { data: contact } = useContactByMemberId(memberId);
  const createConversation = useCreateMemberConversation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSend =
    subject.trim().length > 0 && body.trim().length > 0 && !createConversation.isPending;

  const handleSend = () => {
    if (!canSend) return;
    setError(null);

    createConversation.mutate(
      {
        anchorType: 'MEMBER',
        anchorId: memberId,
        subject: subject.trim(),
        initialMessage: body.trim(),
        contactId: contact?.contactId,
        direction: 'inbound',
      },
      {
        onSuccess: () => onSent(),
        onError: (err) => setError(err.message || 'Failed to send message. Please try again.'),
      },
    );
  };

  return (
    <div data-testid="compose-message">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onCancel}
          data-testid="compose-cancel"
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
          New Message
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Subject */}
        <div>
          <label
            htmlFor="compose-subject"
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: C.textSecondary,
              display: 'block',
              marginBottom: 4,
            }}
          >
            Subject
          </label>
          <input
            id="compose-subject"
            data-testid="compose-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What is this about?"
            style={{
              width: '100%',
              fontFamily: BODY,
              fontSize: 14,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '10px 12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="compose-body"
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: C.textSecondary,
              display: 'block',
              marginBottom: 4,
            }}
          >
            Message
          </label>
          <textarea
            id="compose-body"
            data-testid="compose-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message..."
            rows={6}
            style={{
              width: '100%',
              fontFamily: BODY,
              fontSize: 14,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '10px 12px',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            data-testid="compose-error"
            style={{ fontFamily: BODY, fontSize: 13, color: C.coral }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            data-testid="compose-cancel-button"
            onClick={onCancel}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              color: C.textSecondary,
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '8px 20px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            data-testid="compose-send"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: canSend ? C.sage : C.textTertiary,
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            {createConversation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
