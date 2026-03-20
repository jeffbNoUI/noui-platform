import { useState, useMemo } from 'react';
import { C, BODY } from '@/lib/designSystem';
import type { EmployerAlert, AlertSeverity } from '@/types/EmployerOps';

interface AlertTableProps {
  alerts: EmployerAlert[];
  isLoading: boolean;
  onSelectEmployer: (orgId: string) => void;
}

type SeverityFilter = 'all' | AlertSeverity;

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  critical: C.coral,
  warning: C.gold,
  info: C.sky,
};

const SEVERITY_BG: Record<AlertSeverity, string> = {
  critical: C.coralLight,
  warning: C.goldLight,
  info: C.skyLight,
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

const FILTER_OPTIONS: { key: SeverityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'warning', label: 'Warning' },
  { key: 'info', label: 'Info' },
];

const COL_WIDTHS = '80px 1fr 1fr 80px 60px';

export default function AlertTable({ alerts, isLoading, onSelectEmployer }: AlertTableProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const severityCounts = useMemo(() => {
    const counts: Record<SeverityFilter, number> = {
      all: alerts.length,
      critical: 0,
      warning: 0,
      info: 0,
    };
    for (const a of alerts) {
      counts[a.severity]++;
    }
    return counts;
  }, [alerts]);

  const filtered = useMemo(
    () => (filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter)),
    [alerts, filter],
  );

  const uniqueEmployers = useMemo(() => new Set(filtered.map((a) => a.orgId)).size, [filtered]);

  if (isLoading) {
    return (
      <div style={{ padding: 24, fontFamily: BODY, fontSize: 14, color: C.textTertiary }}>
        Loading alerts...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: BODY }}>
      {/* ── Severity filter toggles ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 0', flexWrap: 'wrap' }}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = filter === opt.key;
          const count = severityCounts[opt.key];
          return (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                fontFamily: BODY,
                borderRadius: 4,
                border: `1px solid ${isActive ? C.sage : C.border}`,
                background: isActive ? C.sageLight : 'transparent',
                color: isActive ? C.sageDark : C.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: isActive ? C.sage : C.textTertiary,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Table header ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: COL_WIDTHS,
          gap: 0,
          padding: '8px 12px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {['Severity', 'Employer', 'Issue', 'Metric', 'Age'].map((h) => (
          <div
            key={h}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* ── Rows ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '32px 12px',
            textAlign: 'center',
            fontSize: 13,
            color: C.textTertiary,
          }}
        >
          No alerts{filter !== 'all' ? ` with ${filter} severity` : ''}
        </div>
      ) : (
        filtered.map((alert, i) => {
          const metricDisplay = alert.type.includes('score')
            ? `${alert.value}%`
            : String(alert.value);

          return (
            <button
              key={`${alert.orgId}-${alert.type}-${i}`}
              onClick={() => onSelectEmployer(alert.orgId)}
              style={{
                display: 'grid',
                gridTemplateColumns: COL_WIDTHS,
                gap: 0,
                width: '100%',
                padding: '10px 12px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${C.borderLight}`,
                cursor: 'pointer',
                transition: 'background 0.15s',
                fontFamily: BODY,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.cardBgWarm;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Severity: dot + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: SEVERITY_DOT[alert.severity],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: SEVERITY_DOT[alert.severity],
                    background: SEVERITY_BG[alert.severity],
                    padding: '1px 6px',
                    borderRadius: 3,
                  }}
                >
                  {SEVERITY_LABEL[alert.severity]}
                </span>
              </div>

              {/* Employer */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: C.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {alert.orgName}
              </div>

              {/* Issue */}
              <div
                style={{
                  fontSize: 13,
                  color: C.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {alert.message}
              </div>

              {/* Metric */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  color: C.text,
                }}
              >
                {metricDisplay}
              </div>

              {/* Age (placeholder) */}
              <div
                style={{
                  fontSize: 13,
                  color: C.textTertiary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                &mdash;
              </div>
            </button>
          );
        })
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 12px',
          fontSize: 12,
          color: C.textTertiary,
          fontVariantNumeric: 'tabular-nums',
          borderTop: `1px solid ${C.border}`,
        }}
      >
        Showing {filtered.length} alert{filtered.length !== 1 ? 's' : ''} across {uniqueEmployers}{' '}
        employer{uniqueEmployers !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
