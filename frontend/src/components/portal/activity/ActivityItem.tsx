import { C, BODY } from '@/lib/designSystem';
import type { ActivityItem as ActivityItemType } from '@/hooks/useActivityTracker';

interface ActivityItemProps {
  item: ActivityItemType;
  onAction?: (item: ActivityItemType) => void;
}

export default function ActivityItem({ item, onAction }: ActivityItemProps) {
  const timeAgo = formatRelativeTime(item.timestamp);

  return (
    <div
      data-testid={`activity-item-${item.id}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        background: C.cardBg,
        borderRadius: 8,
        border: `1px solid ${C.borderLight}`,
      }}
    >
      <span
        style={{
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: item.urgency === 'action_needed' ? C.coralMuted : C.sageLight,
        }}
      >
        {item.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: 14,
            color: C.text,
            marginBottom: 2,
          }}
        >
          {item.title}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary }}>
          {item.description}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ fontFamily: BODY, fontSize: 12, color: C.textTertiary }}>{timeAgo}</span>
        {item.actionLabel && onAction && (
          <button
            data-testid={`activity-action-${item.id}`}
            onClick={() => onAction(item)}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: C.sage,
              background: C.sageLight,
              border: 'none',
              borderRadius: 6,
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >
            {item.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
