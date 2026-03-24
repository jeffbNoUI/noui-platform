import { useEffect, useState, useCallback } from 'react';
import { C, BODY } from '@/lib/designSystem';

interface ToastMessage {
  id: number;
  text: string;
  type: 'error' | 'warning' | 'info';
}

let nextId = 0;

/**
 * Global toast notification component. Listens for custom events and
 * displays transient messages in the bottom-right corner.
 *
 * Supported events:
 *   - api:unauthorized  → "Session expired — please refresh the page"
 *   - toast:show        → { text, type? }
 */
export default function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addMessage = useCallback((text: string, type: ToastMessage['type'] = 'error') => {
    // Prevent duplicate messages
    setMessages((prev) => {
      if (prev.some((m) => m.text === text)) return prev;
      const id = ++nextId;
      return [...prev, { id, text, type }];
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      addMessage('Session expired — please refresh the page to continue.', 'error');
    };

    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) {
        addMessage(detail.text, detail.type ?? 'info');
      }
    };

    window.addEventListener('api:unauthorized', onUnauthorized);
    window.addEventListener('toast:show', onToast);
    return () => {
      window.removeEventListener('api:unauthorized', onUnauthorized);
      window.removeEventListener('toast:show', onToast);
    };
  }, [addMessage]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    const timer = setTimeout(() => dismiss(latest.id), 8000);
    return () => clearTimeout(timer);
  }, [messages, dismiss]);

  if (messages.length === 0) return null;

  const BG: Record<ToastMessage['type'], string> = {
    error: C.coral,
    warning: C.gold,
    info: C.sky,
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 380,
      }}
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: BG[msg.type],
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: BODY,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'toastSlideIn 0.2s ease-out',
          }}
        >
          <span style={{ flex: 1 }}>{msg.text}</span>
          <button
            onClick={() => dismiss(msg.id)}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: 16,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              opacity: 0.8,
            }}
          >
            &#10005;
          </button>
        </div>
      ))}
    </div>
  );
}
