import { useState } from 'react';
import type { PortalTheme } from './ConversationThread';
import { BODY } from '@/lib/designSystem';

interface MessageComposerProps {
  theme: PortalTheme;
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Show subject field for new conversations */
  showSubject?: boolean;
  onSubjectChange?: (subject: string) => void;
}

export default function MessageComposer({
  theme,
  onSend,
  placeholder = 'Type your message...',
  disabled = false,
  showSubject = false,
  onSubjectChange,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: `1px solid ${theme.accent}22`,
      background: theme.containerBg,
      fontFamily: BODY,
    }}>
      {showSubject && (
        <input
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            onSubjectChange?.(e.target.value);
          }}
          placeholder="Subject"
          disabled={disabled}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${theme.accent}33`,
            background: theme.accentLight,
            fontSize: 13,
            fontFamily: BODY,
            color: theme.inboundText,
            marginBottom: 8,
            outline: 'none',
            boxSizing: 'border-box' as const,
          }}
        />
      )}
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${theme.accent}33`,
            background: theme.accentLight,
            fontSize: 13,
            fontFamily: BODY,
            color: theme.inboundText,
            resize: 'none' as const,
            outline: 'none',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: message.trim() ? theme.accent : `${theme.accent}44`,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: BODY,
            cursor: message.trim() && !disabled ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
            opacity: message.trim() && !disabled ? 1 : 0.5,
            whiteSpace: 'nowrap' as const,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
