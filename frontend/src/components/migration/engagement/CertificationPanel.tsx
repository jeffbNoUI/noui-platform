import { useState, useMemo } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import {
  useGateEvaluation,
  useCreateCertification,
  useCertifications,
  useEngagement,
} from '@/hooks/useMigrationApi';
import type { GateMetric, EngagementStatus } from '@/types/Migration';

interface Props {
  engagementId: string;
}

const PHASE_ORDER: EngagementStatus[] = [
  'DISCOVERY',
  'PROFILING',
  'MAPPING',
  'TRANSFORMING',
  'RECONCILING',
  'PARALLEL_RUN',
  'COMPLETE',
];

const CHECKLIST_ITEMS = [
  { key: 'data_quality_validated', label: 'Data quality validated' },
  { key: 'reconciliation_reviewed', label: 'Reconciliation reviewed' },
  { key: 'stakeholder_signoff', label: 'Stakeholder sign-off obtained' },
];

function getNextPhase(current: EngagementStatus): EngagementStatus | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

export default function CertificationPanel({ engagementId }: Props) {
  const { data: engagement } = useEngagement(engagementId);
  const nextPhase = engagement ? getNextPhase(engagement.status) : null;

  const [evaluating, setEvaluating] = useState(false);
  const [certifying, setCertifying] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, false])),
  );
  const [notes, setNotes] = useState('');

  const { data: gateResult, refetch: refetchGate } = useGateEvaluation(
    evaluating ? engagementId : undefined,
    evaluating && nextPhase ? nextPhase : undefined,
  );

  const certifyMutation = useCreateCertification();
  const { data: certifications } = useCertifications(engagementId);

  const allChecked = useMemo(
    () => CHECKLIST_ITEMS.every((item) => checklist[item.key]),
    [checklist],
  );

  const latestCert = certifications?.[0] ?? null;

  const handleEvaluate = () => {
    setEvaluating(true);
    refetchGate();
  };

  const handleCertify = async () => {
    if (!gateResult || !allChecked) return;
    try {
      await certifyMutation.mutateAsync({
        engagementId,
        body: {
          gate_score:
            gateResult.metrics.reduce((sum, m) => sum + (m.passing ? 1 : 0), 0) /
            Math.max(gateResult.metrics.length, 1),
          p1_count: gateResult.blocking_failures.length,
          checklist,
          notes: notes.trim() || undefined,
        },
      });
      setCertifying(false);
      setNotes('');
      setChecklist(Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, false])));
    } catch {
      // Error shown by mutation state
    }
  };

  return (
    <div style={{ fontFamily: BODY }}>
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: 20,
          fontWeight: 600,
          color: C.navy,
          margin: '0 0 20px',
        }}
      >
        Certification
      </h2>

      {/* Gate Status Cards */}
      {gateResult && (
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 12px',
            }}
          >
            Gate Metrics
          </h3>
          <div
            data-testid="gate-status-cards"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {gateResult.metrics.map((metric) => (
              <GateStatusCard key={metric.metric_name} metric={metric} />
            ))}
          </div>
        </div>
      )}

      {/* Evaluate button */}
      {!evaluating && (
        <button
          data-testid="evaluate-gate-button"
          onClick={handleEvaluate}
          disabled={!nextPhase}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.textOnDark,
            background: !nextPhase ? C.border : C.navy,
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            cursor: !nextPhase ? 'not-allowed' : 'pointer',
            marginBottom: 24,
          }}
        >
          Evaluate Gate{nextPhase ? ` for ${nextPhase.replace('_', ' ')}` : ''}
        </button>
      )}

      {/* Gate Evaluation Result */}
      {evaluating && gateResult && (
        <div
          data-testid="gate-evaluation-result"
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 8,
            border: `2px solid ${gateResult.passed ? '#22C55E' : '#EF4444'}`,
            background: gateResult.passed ? '#F0FDF4' : '#FEF2F2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span
              data-testid="gate-overall-badge"
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 6,
                background: gateResult.passed ? '#22C55E' : '#EF4444',
                color: 'white',
              }}
            >
              {gateResult.passed ? 'PASSED' : 'FAILED'}
            </span>
            <span style={{ fontSize: 13, color: C.textSecondary }}>
              Gate evaluation for {gateResult.target_phase.replace('_', ' ')}
            </span>
          </div>

          {/* Per-metric detail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {gateResult.metrics.map((m) => (
              <div
                key={m.metric_name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: m.passing ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                  {m.passing ? '\u2713' : '\u2717'}
                </span>
                <span style={{ color: C.text, fontWeight: 500 }}>
                  {formatMetricName(m.metric_name)}
                </span>
                <span style={{ fontFamily: MONO, color: C.textSecondary, fontSize: 12 }}>
                  {formatMetricValue(m)} / {formatThreshold(m)}
                </span>
              </div>
            ))}
          </div>

          {/* Blocking failures */}
          {gateResult.blocking_failures.length > 0 && (
            <div
              data-testid="blocking-failures"
              style={{
                padding: 12,
                borderRadius: 6,
                background: '#FEE2E2',
                border: '1px solid #FECACA',
              }}
            >
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#EF4444',
                  margin: '0 0 6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Blocking Failures
              </h4>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {gateResult.blocking_failures.map((failure) => (
                  <li key={failure} style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>
                    {failure}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Certification section - only if gate passes */}
      {evaluating && gateResult?.passed && !certifying && (
        <button
          data-testid="certify-button"
          onClick={() => setCertifying(true)}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.textOnDark,
            background: C.sage,
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          Certify
        </button>
      )}

      {/* Certification form */}
      {certifying && (
        <div
          data-testid="certification-form"
          style={{
            marginBottom: 24,
            padding: 20,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.cardBg,
          }}
        >
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 16,
              fontWeight: 600,
              color: C.navy,
              margin: '0 0 16px',
            }}
          >
            Certification Checklist
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {CHECKLIST_ITEMS.map((item) => (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: C.text,
                }}
              >
                <input
                  type="checkbox"
                  data-testid={`checklist-${item.key}`}
                  checked={checklist[item.key]}
                  onChange={(e) =>
                    setChecklist((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                  style={{ width: 18, height: 18, accentColor: C.sage }}
                />
                {item.label}
              </label>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: C.textSecondary,
                marginBottom: 4,
              }}
            >
              Notes (optional)
            </label>
            <textarea
              data-testid="certification-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this certification..."
              rows={3}
              style={{
                width: '100%',
                fontFamily: BODY,
                fontSize: 13,
                padding: '9px 12px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.cardBg,
                color: C.text,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {certifyMutation.isError && (
            <div
              style={{
                marginBottom: 12,
                padding: '8px 12px',
                borderRadius: 6,
                background: '#FEE2E2',
                color: '#EF4444',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Certification failed. Please try again.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              data-testid="submit-certification"
              onClick={handleCertify}
              disabled={!allChecked || certifyMutation.isPending}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 600,
                color: C.textOnDark,
                background: !allChecked || certifyMutation.isPending ? C.border : C.sage,
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                cursor: !allChecked || certifyMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {certifyMutation.isPending ? 'Submitting...' : 'Submit Certification'}
            </button>
            <button
              onClick={() => setCertifying(false)}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 500,
                color: C.textSecondary,
                background: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '10px 16px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Latest certification */}
      {latestCert && (
        <div
          data-testid="latest-certification"
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.cardBg,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 12px',
            }}
          >
            Latest Certification
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div>
              <span style={{ color: C.textSecondary }}>Certified By:</span>{' '}
              <span style={{ fontWeight: 500, color: C.text }}>{latestCert.certified_by}</span>
            </div>
            <div>
              <span style={{ color: C.textSecondary }}>Date:</span>{' '}
              <span style={{ fontWeight: 500, color: C.text }}>
                {new Date(latestCert.certified_at).toLocaleString()}
              </span>
            </div>
            <div>
              <span style={{ color: C.textSecondary }}>Gate Score:</span>{' '}
              <span style={{ fontFamily: MONO, fontWeight: 600, color: C.sage }}>
                {typeof latestCert.gate_score === 'number'
                  ? `${(latestCert.gate_score * 100).toFixed(1)}%`
                  : latestCert.gate_score}
              </span>
            </div>
            <div>
              <span style={{ color: C.textSecondary }}>P1 Count:</span>{' '}
              <span
                style={{
                  fontFamily: MONO,
                  fontWeight: 600,
                  color: latestCert.p1_count > 0 ? '#EF4444' : C.sage,
                }}
              >
                {latestCert.p1_count}
              </span>
            </div>
          </div>
          {latestCert.checklist && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(latestCert.checklist).map(([key, val]) => (
                <span
                  key={key}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: val ? '#DCFCE7' : '#FEE2E2',
                    color: val ? '#22C55E' : '#EF4444',
                    fontWeight: 500,
                  }}
                >
                  {val ? '\u2713' : '\u2717'} {key.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certification history */}
      {certifications && certifications.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 12px',
            }}
          >
            Certification History
          </h3>
          <table
            data-testid="certification-history"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
          >
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: 'left' }}>
                <th style={certThStyle}>Date</th>
                <th style={certThStyle}>Certified By</th>
                <th style={certThStyle}>Gate Score</th>
                <th style={certThStyle}>P1 Count</th>
                <th style={certThStyle}>Phase</th>
              </tr>
            </thead>
            <tbody>
              {certifications.map((cert) => (
                <tr
                  key={cert.certification_id}
                  style={{ borderBottom: `1px solid ${C.borderLight}` }}
                >
                  <td style={certTdStyle}>{new Date(cert.certified_at).toLocaleDateString()}</td>
                  <td style={certTdStyle}>{cert.certified_by}</td>
                  <td style={certTdStyle}>
                    <span style={{ fontFamily: MONO }}>
                      {typeof cert.gate_score === 'number'
                        ? `${(cert.gate_score * 100).toFixed(1)}%`
                        : cert.gate_score}
                    </span>
                  </td>
                  <td style={certTdStyle}>{cert.p1_count}</td>
                  <td style={certTdStyle}>{cert.phase?.replace('_', ' ') ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────

function GateStatusCard({ metric }: { metric: GateMetric }) {
  const isPercentage = metric.display_type === 'percentage';
  const progressPct = isPercentage
    ? Math.min(metric.current_value * 100, 100)
    : Math.min((metric.current_value / Math.max(metric.threshold, 1)) * 100, 100);

  return (
    <div
      data-testid={`gate-card-${metric.metric_name}`}
      style={{
        padding: 14,
        borderRadius: 8,
        border: `2px solid ${metric.passing ? '#22C55E' : '#EF4444'}`,
        background: C.cardBg,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
          {formatMetricName(metric.metric_name)}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
            background: metric.passing ? '#DCFCE7' : '#FEE2E2',
            color: metric.passing ? '#22C55E' : '#EF4444',
          }}
        >
          {metric.passing ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: MONO, color: C.navy }}>
          {formatMetricValue(metric)}
        </span>
        <span style={{ fontSize: 11, color: C.textTertiary }}>/ {formatThreshold(metric)}</span>
      </div>

      {/* Progress bar for percentage metrics */}
      {isPercentage && (
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: C.borderLight,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 3,
              width: `${progressPct}%`,
              background: metric.passing ? '#22C55E' : '#EF4444',
              transition: 'width 0.3s',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMetricName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetricValue(m: GateMetric): string {
  if (m.display_type === 'percentage') {
    return `${(m.current_value * 100).toFixed(1)}%`;
  }
  return String(m.current_value);
}

function formatThreshold(m: GateMetric): string {
  if (m.display_type === 'percentage') {
    return `${(m.threshold * 100).toFixed(1)}%`;
  }
  return String(m.threshold);
}

const certThStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: C.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: BODY,
};

const certTdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};
