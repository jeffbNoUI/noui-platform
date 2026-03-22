import { useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import type { MigrationEngagement, EngagementStatus, SourceConnection } from '@/types/Migration';

interface EngagementListProps {
  engagements: MigrationEngagement[] | undefined;
  isLoading: boolean;
  onSelect: (id: string) => void;
}

const STATUS_COLORS: Record<EngagementStatus, { bg: string; fg: string }> = {
  DISCOVERY: { bg: C.borderLight, fg: '#94a3b8' },
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

function formatConnection(conn: SourceConnection | null): string | null {
  if (!conn) return null;
  const driver = conn.driver === 'mssql' ? 'SQL Server' : 'PostgreSQL';
  return `${driver} · ${conn.host}${conn.port ? ':' + conn.port : ''} · ${conn.dbname}`;
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

const INITIAL_DISPLAY_COUNT = 20;

export default function EngagementList({ engagements, isLoading, onSelect }: EngagementListProps) {
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

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

  const total = engagements.length;
  const visible = engagements.slice(0, displayCount);
  const hasMore = displayCount < total;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 16,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Engagements ({total})
        </h3>
        {total > INITIAL_DISPLAY_COUNT && (
          <span style={{ fontSize: 12, color: C.textTertiary, fontFamily: BODY }}>
            Showing {Math.min(displayCount, total)} of {total}
          </span>
        )}
      </div>
      {visible.map((eng) => {
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
            {eng.source_connection && (
              <div
                style={{
                  fontSize: 11,
                  fontFamily: MONO,
                  color: C.textSecondary,
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: C.sage,
                    flexShrink: 0,
                  }}
                />
                {formatConnection(eng.source_connection)}
              </div>
            )}
            {!eng.source_connection && eng.status === 'DISCOVERY' && (
              <div
                style={{
                  fontSize: 11,
                  fontFamily: BODY,
                  color: C.textTertiary,
                  fontStyle: 'italic',
                  marginBottom: 4,
                }}
              >
                No source configured
              </div>
            )}
            <div style={{ fontSize: 12, color: C.textTertiary }}>
              Updated {formatRelativeTime(eng.updated_at)}
            </div>
          </button>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setDisplayCount((prev) => prev + INITIAL_DISPLAY_COUNT)}
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: BODY,
            color: C.sky,
            background: C.skyLight,
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            cursor: 'pointer',
            alignSelf: 'center',
          }}
        >
          Load more
        </button>
      )}
    </div>
  );
}
