import { useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import { useGateStatus, useAdvancePhase, useRegressPhase } from '@/hooks/useMigrationApi';
import AIRecommendationCard from '../ai/AIRecommendationCard';
import type { EngagementStatus } from '@/types/Migration';

interface Props {
  open: boolean;
  engagementId: string;
  currentPhase: EngagementStatus;
  targetPhase: EngagementStatus;
  direction: 'ADVANCE' | 'REGRESS';
  onClose: () => void;
  onTransitioned: () => void;
}

const PHASE_LABELS: Record<EngagementStatus, string> = {
  DISCOVERY: 'Discovery',
  PROFILING: 'Profiling',
  MAPPING: 'Mapping',
  TRANSFORMING: 'Transforming',
  RECONCILING: 'Reconciling',
  PARALLEL_RUN: 'Parallel Run',
  COMPLETE: 'Complete',
};

function metricColor(value: number, threshold = 0.85): string {
  if (value >= threshold) return C.sage;
  if (value >= threshold * 0.9) return C.gold;
  return C.coral;
}

export default function PhaseGateDialog({
  open,
  engagementId,
  currentPhase,
  targetPhase,
  direction,
  onClose,
  onTransitioned,
}: Props) {
  const { data: gateStatus, isLoading: gateLoading } = useGateStatus(
    open ? engagementId : undefined,
  );
  const advancePhase = useAdvancePhase();
  const regressPhase = useRegressPhase();

  const [notes, setNotes] = useState('');
  const [overrides, setOverrides] = useState<Set<string>>(new Set());

  if (!open) return null;

  const metrics = gateStatus?.metrics ?? {};
  const recommendation = gateStatus?.recommendation ?? null;

  // Determine which metrics are failing (below 0.85 threshold)
  const failingMetrics = Object.entries(metrics).filter(([, v]) => v < 0.85);
  const hasFailingMetrics = failingMetrics.length > 0;
  const allFailingOverridden = failingMetrics.every(([k]) => overrides.has(k));

  const isRegress = direction === 'REGRESS';
  const canSubmit = isRegress
    ? notes.trim().length > 0
    : !hasFailingMetrics || allFailingOverridden;

  const isMutating = advancePhase.isPending || regressPhase.isPending;

  const toggleOverride = (key: string) => {
    setOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirm = async () => {
    try {
      if (isRegress) {
        await regressPhase.mutateAsync({
          engagementId,
          req: { targetPhase, notes },
        });
      } else {
        await advancePhase.mutateAsync({
          engagementId,
          req: {
            notes: notes || undefined,
            overrides: overrides.size > 0 ? Array.from(overrides) : undefined,
          },
        });
      }
      onTransitioned();
    } catch {
      // Error is surfaced by react-query; user can retry
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(27, 46, 74, 0.45)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: C.cardBg,
          borderRadius: 12,
          maxWidth: 560,
          width: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          fontFamily: BODY,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <h2
            style={{
              fontFamily: DISPLAY,
              fontSize: 20,
              fontWeight: 600,
              color: C.navy,
              margin: 0,
            }}
          >
            {isRegress ? 'Return to' : 'Advance to'} {PHASE_LABELS[targetPhase]}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: C.textSecondary,
              margin: '6px 0 0',
            }}
          >
            {isRegress
              ? `Regressing from ${PHASE_LABELS[currentPhase]} to ${PHASE_LABELS[targetPhase]}`
              : `Transitioning from ${PHASE_LABELS[currentPhase]} to ${PHASE_LABELS[targetPhase]}`}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px 20px' }}>
          {/* Gate Metrics */}
          {gateLoading ? (
            <div
              className="animate-pulse"
              style={{ height: 80, borderRadius: 8, background: C.border, marginBottom: 16 }}
            />
          ) : Object.keys(metrics).length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.textSecondary,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  margin: '0 0 8px',
                }}
              >
                Gate Metrics
              </h4>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}
              >
                <tbody>
                  {Object.entries(metrics).map(([key, value]) => (
                    <tr key={key} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td
                        style={{
                          padding: '8px 0',
                          color: C.text,
                          fontWeight: 500,
                        }}
                      >
                        {formatMetricName(key)}
                      </td>
                      <td
                        style={{
                          padding: '8px 0',
                          textAlign: 'right',
                          fontFamily: MONO,
                          fontWeight: 600,
                          color: metricColor(value),
                        }}
                      >
                        {typeof value === 'number' && value <= 1
                          ? `${(value * 100).toFixed(1)}%`
                          : value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* AI Recommendation */}
          {recommendation && (
            <div style={{ marginBottom: 16 }}>
              <AIRecommendationCard recommendation={recommendation} />
            </div>
          )}

          {/* Override section for failing metrics */}
          {!isRegress && hasFailingMetrics && (
            <div
              style={{
                background: C.goldLight,
                borderRadius: 8,
                padding: 14,
                marginBottom: 16,
                border: `1px solid ${C.gold}`,
              }}
            >
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.gold,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  margin: '0 0 8px',
                }}
              >
                Metrics Below Threshold
              </h4>
              {failingMetrics.map(([key, value]) => (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: C.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={overrides.has(key)}
                    onChange={() => toggleOverride(key)}
                    style={{ width: 16, height: 16, accentColor: C.gold }}
                  />
                  <span style={{ fontWeight: 500 }}>
                    I understand the risk:{' '}
                    <span style={{ fontFamily: MONO, color: C.coral }}>
                      {formatMetricName(key)} = {typeof value === 'number' && value <= 1
                        ? `${(value * 100).toFixed(1)}%`
                        : value}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: C.textSecondary,
                marginBottom: 4,
              }}
            >
              Notes{isRegress ? ' (required)' : ' (optional)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isRegress
                  ? 'Explain the reason for regression...'
                  : 'Optional notes about this transition...'
              }
              rows={3}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                fontFamily: BODY,
                color: C.text,
                background: C.cardBg,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error display */}
          {(advancePhase.isError || regressPhase.isError) && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 6,
                background: C.coralLight,
                color: C.coral,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {(advancePhase.error ?? regressPhase.error)?.message ?? 'Transition failed'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            disabled={isMutating}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              color: C.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: BODY,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || isMutating}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: !canSubmit || isMutating ? C.border : isRegress ? C.coral : C.sage,
              color: C.textOnDark,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: BODY,
              cursor: !canSubmit || isMutating ? 'not-allowed' : 'pointer',
            }}
          >
            {isMutating ? 'Processing...' : 'Confirm Transition'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMetricName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
