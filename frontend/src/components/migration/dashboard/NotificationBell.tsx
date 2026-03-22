import { useState, useRef, useEffect } from 'react';
import { C, BODY } from '@/lib/designSystem';
import {
  useMigrationNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useMigrationNotifications';
import type { MigrationNotification } from '@/types/Migration';

interface Props {
  onSelect?: (engagementId: string) => void;
}

const TYPE_ICONS: Record<MigrationNotification['type'], string> = {
  P1_RISK: '\u26A0',
  BATCH_COMPLETE: '\u2705',
  BATCH_HALTED: '\u26D4',
  RECON_COMPLETE: '\u2705',
  GATE_READY: '\u2B50',
  STALLED: '\u23F1',
};

const TYPE_COLORS: Record<MigrationNotification['type'], string> = {
  P1_RISK: C.coral,
  BATCH_COMPLETE: C.sage,
  BATCH_HALTED: C.coral,
  RECON_COMPLETE: C.sage,
  GATE_READY: C.gold,
  STALLED: C.textTertiary,
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell({ onSelect }: Props) {
  const { data: notifications } = useMigrationNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = (notifications ?? []) as MigrationNotification[];
  const unreadCount = items.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleNotificationClick = (n: MigrationNotification) => {
    if (!n.read) {
      markRead.mutate(n.id);
    }
    onSelect?.(n.engagementId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z"
            stroke={C.navy}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.73 21a2 2 0 0 1-3.46 0"
            stroke={C.navy}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: C.coral,
              color: C.textOnDark,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: BODY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 6,
            width: 360,
            maxHeight: 400,
            overflowY: 'auto',
            background: C.cardBg,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            zIndex: 50,
            fontFamily: BODY,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.navy,
              }}
            >
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 12,
                  color: C.sky,
                  cursor: 'pointer',
                  fontFamily: BODY,
                  fontWeight: 500,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          {items.length === 0 ? (
            <div
              style={{
                padding: '24px 14px',
                textAlign: 'center',
                color: C.textTertiary,
                fontSize: 13,
              }}
            >
              No notifications
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 14px',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: `1px solid ${C.borderLight}`,
                  background: n.read ? 'transparent' : C.skyLight,
                  cursor: 'pointer',
                  fontFamily: BODY,
                  transition: 'background 0.15s',
                }}
              >
                {/* Type icon */}
                <span
                  style={{
                    fontSize: 14,
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {TYPE_ICONS[n.type]}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: TYPE_COLORS[n.type],
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {n.engagementName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: C.text,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}
                  >
                    {n.summary}
                  </div>
                </div>

                {/* Time */}
                <span
                  style={{
                    fontSize: 11,
                    color: C.textTertiary,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {relativeTime(n.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
