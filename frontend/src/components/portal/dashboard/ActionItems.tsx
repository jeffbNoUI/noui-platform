import { C, BODY } from '@/lib/designSystem';

export interface ActionItem {
  id: string;
  type: 'profile' | 'document' | 'message' | 'application';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ActionItemsProps {
  items: ActionItem[];
  onItemClick?: (item: ActionItem) => void;
}

const PRIORITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: 'rgba(212, 114, 92, 0.12)', color: '#D4725C', label: 'Action needed' },
  medium: { bg: 'rgba(196, 154, 60, 0.12)', color: '#C49A3C', label: 'Pending' },
  low: { bg: 'rgba(91, 138, 114, 0.08)', color: '#5B8A72', label: 'Optional' },
};

const TYPE_ICONS: Record<string, string> = {
  profile: '◉',
  document: '▤',
  message: '✉',
  application: '★',
};

export default function ActionItems({ items, onItemClick }: ActionItemsProps) {
  if (items.length === 0) {
    return (
      <div
        data-testid="action-items"
        data-tour-id="action-items"
        style={{
          background: C.cardBg,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          padding: '24px 28px',
        }}
      >
        <h3
          style={{
            fontFamily: BODY,
            fontSize: 15,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 12px',
          }}
        >
          Action Items
        </h3>
        <div
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            textAlign: 'center',
            padding: '16px 0',
          }}
        >
          No pending action items. You're all set!
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="action-items"
      data-tour-id="action-items"
      style={{
        background: C.cardBg,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: '24px 28px',
      }}
    >
      <h3
        style={{
          fontFamily: BODY,
          fontSize: 15,
          fontWeight: 600,
          color: C.navy,
          margin: '0 0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        Action Items
        <span
          style={{
            background: C.coral,
            color: '#fff',
            borderRadius: 10,
            padding: '1px 8px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {items.length}
        </span>
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => {
          const priority = PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.low;
          const icon = TYPE_ICONS[item.type] ?? '•';

          return (
            <button
              key={item.id}
              onClick={() => onItemClick?.(item)}
              data-testid={`action-item-${item.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: C.cardBgWarm,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 8,
                cursor: onItemClick ? 'pointer' : 'default',
                fontFamily: BODY,
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{ fontSize: 16, color: priority.color, flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{item.title}</div>
                <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                  {item.description}
                </div>
              </div>
              <span
                style={{
                  background: priority.bg,
                  color: priority.color,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                {priority.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
