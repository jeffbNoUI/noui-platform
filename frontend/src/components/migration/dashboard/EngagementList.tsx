import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { MigrationEngagement, EngagementStatus } from '@/types/Migration';

interface EngagementListProps {
  engagements: MigrationEngagement[] | undefined;
  isLoading: boolean;
  onSelect: (id: string) => void;
}

const STATUS_COLORS: Record<EngagementStatus, { bg: string; fg: string }> = {
  PROFILING: { bg: C.skyLight, fg: C.sky },
  MAPPING: { bg: C.goldLight, fg: C.gold },
  TRANSFORMING: { bg: C.sageLight, fg: C.sage },
  RECONCILING: { bg: C.coralLight, fg: C.coral },
  PARALLEL_RUN: { bg: C.borderLight, fg: C.navyLight },
  COMPLETE: { bg: C.sageLight, fg: C.sage },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function SkeletonRow() {
  return (
    <div
      className="animate-pulse"
      style={{
        padding: '16px 20px',
        borderRadius: 10,
        background: C.cardBg,
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          height: 16,
          width: '60%',
          borderRadius: 4,
          background: C.borderLight,
          marginBottom: 8,
        }}
      />
      <div style={{ height: 12, width: '30%', borderRadius: 4, background: C.borderLight }} />
    </div>
  );
}

export default function EngagementList({ engagements, isLoading, onSelect }: EngagementListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (!engagements || engagements.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12"
        style={{ color: C.textTertiary }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: C.borderLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            marginBottom: 12,
          }}
        >
          &mdash;
        </div>
        <p style={{ fontSize: 14, fontFamily: BODY, margin: 0 }}>No active engagements</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3
        style={{
          fontFamily: DISPLAY,
          fontSize: 16,
          fontWeight: 600,
          color: C.navy,
          margin: 0,
          marginBottom: 4,
        }}
      >
        Engagements ({engagements.length})
      </h3>
      {engagements.map((eng) => {
        const colors = STATUS_COLORS[eng.status] ?? { bg: C.borderLight, fg: C.textSecondary };
        return (
          <button
            key={eng.engagement_id}
            onClick={() => onSelect(eng.engagement_id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '16px 20px',
              borderRadius: 10,
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
              transition: 'box-shadow 0.15s',
              fontFamily: BODY,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = C.cardHoverShadow;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                {eng.source_system_name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: colors.bg,
                  color: colors.fg,
                }}
              >
                {eng.status.replace('_', ' ')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.textTertiary }}>
              Updated {formatRelativeTime(eng.updated_at)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
