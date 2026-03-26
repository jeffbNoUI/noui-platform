import { useState, useMemo } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import { useEngagements, useCompare } from '@/hooks/useMigrationApi';
import type { EngagementStatus, CompareEngagement } from '@/types/Migration';

/** Phase ordering for determining minimum common phase */
const PHASE_ORDER: EngagementStatus[] = [
  'DISCOVERY',
  'PROFILING',
  'MAPPING',
  'TRANSFORMING',
  'RECONCILING',
  'PARALLEL_RUN',
  'CUTOVER_IN_PROGRESS',
  'GO_LIVE',
  'COMPLETE',
];

const PHASE_LABELS: Record<EngagementStatus, string> = {
  DISCOVERY: 'Discovery',
  PROFILING: 'Profiling',
  MAPPING: 'Mapping',
  TRANSFORMING: 'Transforming',
  RECONCILING: 'Reconciling',
  PARALLEL_RUN: 'Parallel Run',
  CUTOVER_IN_PROGRESS: 'Cutover',
  GO_LIVE: 'Go-Live',
  COMPLETE: 'Complete',
};

function phaseIndex(status: EngagementStatus): number {
  return PHASE_ORDER.indexOf(status);
}

function minCommonPhase(a: EngagementStatus, b: EngagementStatus): EngagementStatus {
  return phaseIndex(a) <= phaseIndex(b) ? a : b;
}

interface MetricRow {
  label: string;
  key: string;
  /** Minimum phase required for this metric to be available */
  minPhase: EngagementStatus;
  format: (eng: CompareEngagement) => string;
  color?: (eng: CompareEngagement) => string;
}

const METRIC_ROWS: MetricRow[] = [
  {
    label: 'Status',
    key: 'status',
    minPhase: 'DISCOVERY',
    format: (e) => e.status.replace('_', ' '),
  },
  {
    label: 'Batches',
    key: 'batch_count',
    minPhase: 'TRANSFORMING',
    format: (e) => String(e.batch_count),
  },
  {
    label: 'Error Rate',
    key: 'error_rate',
    minPhase: 'TRANSFORMING',
    format: (e) => `${(e.error_rate * 100).toFixed(1)}%`,
    color: (e) => {
      if (e.error_rate <= 0.02) return C.sage;
      if (e.error_rate <= 0.05) return C.gold;
      return C.coral;
    },
  },
  {
    label: 'Recon Gate Score',
    key: 'recon_gate_score',
    minPhase: 'RECONCILING',
    format: (e) => `${(e.recon_gate_score * 100).toFixed(1)}%`,
    color: (e) => {
      if (e.recon_gate_score >= 0.95) return C.sage;
      if (e.recon_gate_score >= 0.9) return C.gold;
      return C.coral;
    },
  },
  {
    label: 'Accuracy',
    key: 'accuracy',
    minPhase: 'PROFILING',
    format: (e) => (e.quality_scores ? `${(e.quality_scores.accuracy * 100).toFixed(1)}%` : '--'),
  },
  {
    label: 'Completeness',
    key: 'completeness',
    minPhase: 'PROFILING',
    format: (e) =>
      e.quality_scores ? `${(e.quality_scores.completeness * 100).toFixed(1)}%` : '--',
  },
  {
    label: 'Consistency',
    key: 'consistency',
    minPhase: 'PROFILING',
    format: (e) =>
      e.quality_scores ? `${(e.quality_scores.consistency * 100).toFixed(1)}%` : '--',
  },
];

export default function ComparativeView() {
  const { data: engagements } = useEngagements();
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  const { data: compareResult, isLoading } = useCompare(leftId, rightId);

  const commonPhase = useMemo(() => {
    if (!compareResult || compareResult.engagements.length < 2) return null;
    return minCommonPhase(compareResult.engagements[0].status, compareResult.engagements[1].status);
  }, [compareResult]);

  const visibleMetrics = useMemo(() => {
    if (!commonPhase) return METRIC_ROWS;
    const maxIdx = phaseIndex(commonPhase);
    return METRIC_ROWS.filter((m) => phaseIndex(m.minPhase) <= maxIdx);
  }, [commonPhase]);

  const options = engagements ?? [];

  const selectStyle: React.CSSProperties = {
    fontFamily: BODY,
    fontSize: 13,
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.cardBg,
    color: C.text,
    minWidth: 200,
    cursor: 'pointer',
  };

  return (
    <div style={{ fontFamily: BODY }}>
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: 20,
          fontWeight: 700,
          color: C.navy,
          margin: '0 0 20px',
        }}
      >
        Comparative View
      </h2>

      {/* Selectors */}
      <div className="flex items-center gap-4" style={{ marginBottom: 24 }}>
        <div className="flex flex-col gap-1">
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.textTertiary,
              textTransform: 'uppercase',
            }}
          >
            Engagement A
          </label>
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)} style={selectStyle}>
            <option value="">Select engagement...</option>
            {options.map((eng) => (
              <option
                key={eng.engagement_id}
                value={eng.engagement_id}
                disabled={eng.engagement_id === rightId}
              >
                {eng.source_system_name}
              </option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: 18, color: C.textTertiary, paddingTop: 18 }}>vs</span>

        <div className="flex flex-col gap-1">
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.textTertiary,
              textTransform: 'uppercase',
            }}
          >
            Engagement B
          </label>
          <select value={rightId} onChange={(e) => setRightId(e.target.value)} style={selectStyle}>
            <option value="">Select engagement...</option>
            {options.map((eng) => (
              <option
                key={eng.engagement_id}
                value={eng.engagement_id}
                disabled={eng.engagement_id === leftId}
              >
                {eng.source_system_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stage gate notice */}
      {commonPhase && leftId && rightId && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: C.skyLight,
            color: C.sky,
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 16,
          }}
        >
          Comparing metrics available at or before the {PHASE_LABELS[commonPhase]} stage
        </div>
      )}

      {/* Comparison table */}
      {!leftId || !rightId ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: C.textTertiary,
            fontSize: 14,
          }}
        >
          Select two engagements to compare side by side.
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 40,
                borderRadius: 8,
                background: C.borderLight,
              }}
            />
          ))}
        </div>
      ) : compareResult && compareResult.engagements.length === 2 ? (
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              borderBottom: `1px solid ${C.border}`,
              background: C.pageBg,
            }}
          >
            <div
              style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: C.textTertiary }}
            >
              Metric
            </div>
            <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: C.navy }}>
              {compareResult.engagements[0].source_system_name}
            </div>
            <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: C.navy }}>
              {compareResult.engagements[1].source_system_name}
            </div>
          </div>

          {/* Data rows */}
          {visibleMetrics.map((metric, idx) => (
            <div
              key={metric.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                borderBottom:
                  idx < visibleMetrics.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                background: idx % 2 === 0 ? C.cardBg : C.pageBg,
              }}
            >
              <div
                style={{
                  padding: '10px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.textSecondary,
                }}
              >
                {metric.label}
              </div>
              {compareResult.engagements.map((eng) => (
                <div
                  key={eng.engagement_id}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    fontFamily: MONO,
                    fontWeight: 600,
                    color: metric.color ? metric.color(eng) : C.text,
                  }}
                >
                  {metric.format(eng)}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '32px 24px',
            textAlign: 'center',
            color: C.textTertiary,
            fontSize: 13,
          }}
        >
          No comparison data available.
        </div>
      )}
    </div>
  );
}
