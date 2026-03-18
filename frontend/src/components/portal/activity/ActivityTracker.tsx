import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import type { ActivityItem as ActivityItemType, ActivityUrgency } from '@/hooks/useActivityTracker';
import ActivityItem from './ActivityItem';

interface ActivityTrackerProps {
  memberId: string;
  onAction?: (item: ActivityItemType) => void;
}

const BUCKET_CONFIG: { key: ActivityUrgency; label: string; emptyLabel: string; color: string }[] =
  [
    {
      key: 'action_needed',
      label: 'Action Needed',
      emptyLabel: 'No items require your attention',
      color: C.coral,
    },
    { key: 'in_progress', label: 'In Progress', emptyLabel: 'No items in progress', color: C.gold },
    {
      key: 'completed',
      label: 'Recently Completed',
      emptyLabel: 'No recent completions',
      color: C.sage,
    },
  ];

export default function ActivityTracker({ memberId, onAction }: ActivityTrackerProps) {
  const { grouped, isLoading, counts } = useActivityTracker(memberId);

  if (isLoading) {
    return (
      <div
        data-testid="activity-tracker-loading"
        style={{ padding: 32, textAlign: 'center', color: C.textSecondary, fontFamily: BODY }}
      >
        Loading activity...
      </div>
    );
  }

  if (counts.total === 0) {
    return (
      <div data-testid="activity-tracker-empty" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u2713'}</div>
        <div style={{ fontFamily: BODY, fontSize: 16, color: C.textSecondary }}>
          You're all caught up — no pending activity
        </div>
      </div>
    );
  }

  return (
    <div data-testid="activity-tracker">
      {BUCKET_CONFIG.map(({ key, label, emptyLabel, color }) => {
        const items = grouped[key];
        return (
          <section key={key} data-testid={`activity-bucket-${key}`} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <h3
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 17,
                  fontWeight: 600,
                  color: C.text,
                  margin: 0,
                }}
              >
                {label}
              </h3>
              {items.length > 0 && (
                <span
                  style={{
                    fontFamily: BODY,
                    fontSize: 12,
                    color: C.textTertiary,
                    marginLeft: 4,
                  }}
                >
                  ({items.length})
                </span>
              )}
            </div>
            {items.length === 0 ? (
              <div
                style={{ fontFamily: BODY, fontSize: 14, color: C.textTertiary, paddingLeft: 16 }}
              >
                {emptyLabel}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item) => (
                  <ActivityItem key={item.id} item={item} onAction={onAction} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
