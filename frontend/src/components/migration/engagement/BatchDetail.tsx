import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import {
  useBatch,
  useExceptionClusters,
  useExceptions,
  useRetransformBatch,
  useReconcileBatch,
  useApplyCluster,
} from '@/hooks/useMigrationApi';
import type { BatchStatus, ExceptionDisposition } from '@/types/Migration';

interface BatchDetailProps {
  batchId: string;
  engagementId: string;
  onBack: () => void;
}

function statusColor(status: BatchStatus): string {
  switch (status) {
    case 'APPROVED':
    case 'RECONCILED':
    case 'LOADED':
      return C.sage;
    case 'RUNNING':
    case 'PENDING':
      return C.gold;
    case 'FAILED':
      return C.coral;
    default:
      return C.textSecondary;
  }
}

function dispositionColor(d: ExceptionDisposition): string {
  switch (d) {
    case 'AUTO_FIXED':
    case 'MANUAL_FIXED':
      return C.sage;
    case 'EXCLUDED':
      return C.coral;
    case 'DEFERRED':
      return C.gold;
    case 'PENDING':
      return C.textSecondary;
    default:
      return C.textSecondary;
  }
}

export default function BatchDetail({
  batchId,
  engagementId: _engagementId,
  onBack,
}: BatchDetailProps) {
  const { data: batch, isLoading } = useBatch(batchId);
  const { data: clusters } = useExceptionClusters(batchId);
  const { data: exceptions } = useExceptions(batchId);
  const retransform = useRetransformBatch();
  const reconcile = useReconcileBatch();
  const applyCluster = useApplyCluster();

  if (isLoading || !batch) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: C.borderLight,
              borderRadius: 12,
              height: i === 1 ? 180 : 120,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  const errorRate = batch.error_rate != null ? (batch.error_rate * 100).toFixed(1) : '--';
  const isActionDisabled = batch.status === 'PENDING' || batch.status === 'RUNNING';
  const displayedExceptions = exceptions?.slice(0, 100) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm hover:underline"
        style={{
          color: C.textSecondary,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: BODY,
          padding: 0,
        }}
      >
        &larr; Back to Engagement
      </button>

      {/* Header card */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 style={{ fontFamily: DISPLAY, fontSize: 22, color: C.navy, margin: 0 }}>
              {batch.batch_scope}
            </h2>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.textTertiary }}>
              {batch.batch_id}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontFamily: BODY,
              color: statusColor(batch.status),
              background: `${statusColor(batch.status)}18`,
              padding: '4px 12px',
              borderRadius: 999,
            }}
          >
            {batch.status}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Source Rows', value: batch.row_count_source?.toLocaleString() ?? '--' },
            { label: 'Loaded', value: batch.row_count_loaded?.toLocaleString() ?? '--' },
            { label: 'Exceptions', value: batch.row_count_exception?.toLocaleString() ?? '--' },
            { label: 'Error Rate', value: `${errorRate}%` },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: C.pageBg,
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              <div
                style={{ fontSize: 11, color: C.textTertiary, fontFamily: BODY, marginBottom: 4 }}
              >
                {stat.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.navy, fontFamily: BODY }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => retransform.mutate(batchId)}
            disabled={retransform.isPending}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              color: C.navy,
              cursor: retransform.isPending ? 'not-allowed' : 'pointer',
              opacity: retransform.isPending ? 0.6 : 1,
            }}
          >
            {retransform.isPending ? 'Retransforming...' : 'Retransform'}
          </button>
          <button
            onClick={() => reconcile.mutate(batchId)}
            disabled={isActionDisabled || reconcile.isPending}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: isActionDisabled ? C.borderLight : C.sage,
              color: isActionDisabled ? C.textTertiary : '#fff',
              cursor: isActionDisabled || reconcile.isPending ? 'not-allowed' : 'pointer',
              opacity: reconcile.isPending ? 0.6 : 1,
            }}
          >
            {reconcile.isPending ? 'Reconciling...' : 'Reconcile Batch'}
          </button>
        </div>
      </div>

      {/* Exception Clusters */}
      {clusters && clusters.length > 0 && (
        <div>
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 16,
              color: C.navy,
              marginBottom: 12,
            }}
          >
            Exception Clusters
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {clusters.map((cluster) => (
              <div
                key={cluster.cluster_id}
                style={{
                  background: C.cardBg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.navy }}>
                      {cluster.exception_type} &middot; {cluster.field_name}
                    </div>
                    <div
                      style={{
                        fontFamily: BODY,
                        fontSize: 13,
                        color: C.textSecondary,
                        marginTop: 4,
                      }}
                    >
                      {cluster.count} exceptions &middot; {(cluster.confidence * 100).toFixed(0)}%
                      confidence
                    </div>
                    {cluster.root_cause_pattern && (
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 12,
                          color: C.textTertiary,
                          marginTop: 6,
                          background: C.pageBg,
                          padding: '6px 10px',
                          borderRadius: 6,
                        }}
                      >
                        {cluster.root_cause_pattern}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {cluster.applied ? (
                      <span
                        style={{
                          fontFamily: BODY,
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.sage,
                        }}
                      >
                        Applied
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          applyCluster.mutate({
                            clusterId: cluster.cluster_id,
                            req: {
                              disposition: cluster.suggested_disposition || 'DEFERRED',
                            },
                          })
                        }
                        disabled={applyCluster.isPending}
                        style={{
                          fontFamily: BODY,
                          fontSize: 12,
                          fontWeight: 500,
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: C.sage,
                          color: '#fff',
                          cursor: applyCluster.isPending ? 'not-allowed' : 'pointer',
                          opacity: applyCluster.isPending ? 0.6 : 1,
                        }}
                      >
                        Apply Fix
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exception Table */}
      {exceptions && exceptions.length > 0 && (
        <div>
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 16,
              color: C.navy,
              marginBottom: 12,
            }}
          >
            Exceptions
          </h3>
          <div
            style={{
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 13 }}
            >
              <thead>
                <tr style={{ background: C.pageBg }}>
                  {['Source Table', 'Source ID', 'Field', 'Type', 'Disposition', 'Value'].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.textTertiary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {displayedExceptions.map((exc) => (
                  <tr key={exc.exception_id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: '8px 12px', color: C.text }}>{exc.source_table}</td>
                    <td
                      style={{
                        padding: '8px 12px',
                        fontFamily: MONO,
                        fontSize: 12,
                        color: C.textSecondary,
                      }}
                    >
                      {exc.source_id}
                    </td>
                    <td style={{ padding: '8px 12px', color: C.text }}>{exc.field_name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.coral,
                          background: C.coralLight,
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {exc.exception_type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: dispositionColor(exc.disposition),
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: `${dispositionColor(exc.disposition)}18`,
                        }}
                      >
                        {exc.disposition}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px 12px',
                        fontFamily: MONO,
                        fontSize: 12,
                        color: C.textSecondary,
                        maxWidth: 160,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={exc.attempted_value ?? ''}
                    >
                      {exc.attempted_value ?? '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {exceptions.length > 100 && (
              <div
                style={{
                  padding: '10px 12px',
                  fontSize: 12,
                  color: C.textTertiary,
                  fontFamily: BODY,
                  borderTop: `1px solid ${C.border}`,
                  textAlign: 'center',
                }}
              >
                Showing first 100 of {exceptions.length.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
