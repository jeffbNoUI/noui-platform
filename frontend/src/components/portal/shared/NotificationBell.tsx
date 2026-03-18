import { useState, useRef, useEffect } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationItem } from '@/hooks/useNotifications';

interface NotificationBellProps {
  memberId: string;
  onNotificationClick?: (item: NotificationItem) => void;
}

export default function NotificationBell({ memberId, onNotificationClick }: NotificationBellProps) {
  const { unreadCount, items } = useNotifications(memberId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }} data-testid="notification-bell">
      <button
        data-testid="bell-button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 20,
          cursor: 'pointer',
          position: 'relative',
          padding: '6px 8px',
          color: C.text,
        }}
      >
        {'\uD83D\uDD14'}
        {unreadCount > 0 && (
          <span
            data-testid="bell-badge"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: C.coral,
              color: '#fff',
              borderRadius: 10,
              padding: '1px 5px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: BODY,
              minWidth: 16,
              textAlign: 'center',
              lineHeight: '14px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="bell-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderLight}` }}>
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, color: C.text }}>
              Notifications
            </span>
          </div>
          {items.length === 0 ? (
            <div
              data-testid="bell-empty"
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                fontFamily: BODY,
                fontSize: 13,
                color: C.textTertiary,
              }}
            >
              No new notifications
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                data-testid={`notification-${item.id}`}
                onClick={() => {
                  onNotificationClick?.(item);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: `1px solid ${C.borderLight}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.title}</div>
                <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                  {item.description}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
