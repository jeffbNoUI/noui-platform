import { useState } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { PANEL_HEADING } from '../panelStyles';
import { useEngagement, useBatchSizingRecommendation, useBatches } from '@/hooks/useMigrationApi';
import AIRecommendationCard from '../ai/AIRecommendationCard';
import CreateBatchDialog from '../dialogs/CreateBatchDialog';
import type { EngagementStatus, BatchStatus } from '@/types/Migration';

const TRANSFORM_READY: EngagementStatus[] = [
  'TRANSFORMING',
  'RECONCILING',
  'PARALLEL_RUN',
  'CUTOVER_IN_PROGRESS',
  'GO_LIVE',
  'COMPLETE',
];

function statusBadgeColor(status: BatchStatus): { bg: string; fg: string } {
  switch (status) {
    case 'APPROVED':
    case 'RECONCILED':
    case 'LOADED':
      return { bg: C.sageLight, fg: C.sage };
    case 'RUNNING':
    case 'PENDING':
      return { bg: C.goldLight, fg: C.gold };
    case 'FAILED':
      return { bg: C.coralLight, fg: C.coral };
    default:
      return { bg: C.sageLight, fg: C.sage };
  }
}

interface Props {
  engagementId: string;
  onSelectBatch: (batchId: string) => void;
}

export default function TransformationPanel({ engagementId, onSelectBatch }: Props) {
  const { data: engagement, isLoading } = useEngagement(engagementId);
  const { data: batchSizing } = useBatchSizingRecommendation(engagementId);
  const { data: batches, isLoading: batchesLoading } = useBatches(engagementId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          className="animate-pulse"
          style={{ height: 120, borderRadius: 8, background: C.border }}
        />
      </div>
    );
  }

  const isReady = engagement && TRANSFORM_READY.includes(engagement.status);

  if (!isReady) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: C.sageLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 4H20V8M14 10L20 4M8 20H4V16M10 14L4 20"
              stroke={C.sage}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 style={{ ...PANEL_HEADING, margin: 0 }}>Batch Management</h3>
        <p
          style={{
            fontSize: 13,
            color: C.textSecondary,
            textAlign: 'center',
            maxWidth: 360,
            lineHeight: 1.5,
            margin: 0,
            fontFamily: BODY,
          }}
        >
          Batch management available when engagement reaches TRANSFORMING phase. Complete the
          profiling and mapping steps first.
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: C.goldLight,
            fontSize: 12,
            fontWeight: 600,
            color: C.gold,
            fontFamily: MONO,
          }}
        >
          Current: {engagement?.status ?? 'Unknown'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: BODY }}>
      {/* AI Batch Sizing Recommendation */}
      {batchSizing && (
        <div style={{ marginBottom: 16 }}>
          <AIRecommendationCard recommendation={batchSizing} />
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h3 style={{ ...PANEL_HEADING, margin: 0 }}>Transformation Batches</h3>
        <button
          onClick={() => setShowCreateDialog(true)}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: 600,
            color: C.textOnDark,
            background: C.navy,
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          + Create Batch
        </button>
      </div>

      {/* Batch table */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        {batchesLoading ? (
          <div style={{ padding: 24 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  height: 44,
                  borderRadius: 6,
                  background: C.border,
                  marginBottom: i < 3 ? 8 : 0,
                }}
              />
            ))}
          </div>
        ) : !batches || batches.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p
              style={{
                fontSize: 13,
                color: C.textSecondary,
                margin: '0 0 8px',
                lineHeight: 1.5,
              }}
            >
              No batches have been created yet.
            </p>
            <p style={{ fontSize: 12, color: C.textTertiary, margin: 0 }}>
              Create a batch to start transforming source data.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${C.border}`,
                  background: C.cardBgWarm,
                }}
              >
                {['Scope', 'Status', 'Source Rows', 'Loaded', 'Exceptions', 'Error Rate'].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        fontFamily: BODY,
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.textTertiary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '10px 14px',
                        textAlign: col === 'Scope' ? 'left' : 'right',
                      }}
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const badge = statusBadgeColor(batch.status);
                const errorRate =
                  batch.error_rate != null ? `${(batch.error_rate * 100).toFixed(1)}%` : '--';
                return (
                  <tr
                    key={batch.batch_id}
                    onClick={() => onSelectBatch(batch.batch_id)}
                    style={{
                      borderBottom: `1px solid ${C.borderLight}`,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = C.pageBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <td
                      style={{
                        padding: '12px 14px',
                        fontFamily: MONO,
                        fontSize: 13,
                        fontWeight: 500,
                        color: C.navy,
                      }}
                    >
                      {batch.batch_scope}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: MONO,
                          background: badge.bg,
                          color: badge.fg,
                        }}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        fontSize: 13,
                        color: C.text,
                      }}
                    >
                      {batch.row_count_source?.toLocaleString() ?? '--'}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        fontSize: 13,
                        color: C.text,
                      }}
                    >
                      {batch.row_count_loaded?.toLocaleString() ?? '--'}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        fontSize: 13,
                        color:
                          batch.row_count_exception && batch.row_count_exception > 0
                            ? C.coral
                            : C.text,
                      }}
                    >
                      {batch.row_count_exception?.toLocaleString() ?? '--'}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontFamily: MONO,
                        fontSize: 13,
                        color:
                          batch.error_rate != null && batch.error_rate > 0.05 ? C.coral : C.text,
                      }}
                    >
                      {errorRate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <CreateBatchDialog
        open={showCreateDialog}
        engagementId={engagementId}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
