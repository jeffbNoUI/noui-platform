import { useState, useCallback } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { useEvents } from '@/hooks/useMigrationApi';
import type { WSEvent, WSEventType, MigrationEvent } from '@/types/Migration';

const EVENT_LABELS: Record<WSEventType, string> = {
  batch_started: 'Batch Started',
  batch_progress: 'Batch Progress',
  batch_completed: 'Batch Completed',
  batch_failed: 'Batch Failed',
  batch_halted: 'Batch Halted',
  exception_cluster: 'Exception Cluster',
  reconciliation_progress: 'Reconciliation Progress',
  reconciliation_complete: 'Reconciliation Complete',
  reconciliation_completed: 'Reconciliation Completed',
  risk_detected: 'Risk Detected',
  risk_resolved: 'Risk Resolved',
  risk_created: 'Risk Created',
  risk_updated: 'Risk Updated',
  engagement_status_changed: 'Status Changed',
  phase_changed: 'Phase Changed',
  mapping_agreement_updated: 'Mapping Updated',
  phase_transition: 'Phase Transition',
  gate_recommendation: 'Gate Recommendation',
  ai_insight: 'AI Insight',
  job_started: 'Job Started',
  job_completed: 'Job Completed',
  job_failed: 'Job Failed',
  job_cancelled: 'Job Cancelled',
  recon_rules_activated: 'Recon Rules Activated',
  recon_execution_completed: 'Recon Execution Completed',
  drift_detection_completed: 'Drift Detection Complete',
  drift_detection_started: 'Drift Detection Started',
};

function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return '';
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function summarizePayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  if (payload.batch_id) parts.push(`batch: ${String(payload.batch_id).slice(0, 8)}`);
  if (payload.scope) parts.push(String(payload.scope));
  if (payload.error_rate != null) parts.push(`err: ${Number(payload.error_rate).toFixed(1)}%`);
  if (payload.severity) parts.push(String(payload.severity));
  if (payload.status) parts.push(String(payload.status));
  if (payload.description) parts.push(String(payload.description).slice(0, 60));
  if (parts.length === 0 && payload.message) parts.push(String(payload.message).slice(0, 60));
  return parts.join(' / ') || 'No details';
}

interface Props {
  engagementId: string;
  events: WSEvent[];
  connected: boolean;
}

const PAGE_SIZE = 50;

export default function ActivityLog({ engagementId, events, connected }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [loadedHistory, setLoadedHistory] = useState<MigrationEvent[]>([]);

  const { data: historyPage, isLoading: historyLoading } = useEvents(engagementId, {
    limit: PAGE_SIZE,
    offset: historyOffset,
  });

  const connectionColor = connected ? C.sage : C.gold;
  const connectionLabel = connected ? 'Live' : 'Polling';

  // Accumulate loaded history pages
  const mergedHistory = loadedHistory;
  if (historyPage && historyPage.items.length > 0) {
    const existingIds = new Set(mergedHistory.map((e) => e.event_id));
    for (const item of historyPage.items) {
      if (!existingIds.has(item.event_id)) {
        mergedHistory.push(item);
      }
    }
  }

  const hasMore = historyPage?.pagination?.hasMore ?? false;

  const handleLoadMore = useCallback(() => {
    if (historyPage) {
      setLoadedHistory([...mergedHistory]);
      setHistoryOffset((prev) => prev + PAGE_SIZE);
    }
  }, [historyPage, mergedHistory]);

  if (collapsed) {
    return (
      <div
        style={{
          width: 40,
          flexShrink: 0,
          borderLeft: `1px solid ${C.border}`,
          background: C.cardBg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 12,
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: C.textSecondary,
          }}
          title="Expand activity log"
        >
          {'<'}
        </button>
        {events.length > 0 && (
          <span
            style={{
              marginTop: 8,
              fontSize: 10,
              fontWeight: 600,
              color: C.textOnDark,
              background: C.sage,
              borderRadius: 10,
              padding: '2px 6px',
              minWidth: 18,
              textAlign: 'center',
            }}
          >
            {events.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: `1px solid ${C.border}`,
        background: C.cardBg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: BODY,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>Activity</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: connectionColor,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: connectionColor,
                display: 'inline-block',
              }}
            />
            {connectionLabel}
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 14,
            color: C.textTertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Collapse activity log"
        >
          {'>'}
        </button>
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {events.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: C.textTertiary,
              fontSize: 13,
            }}
          >
            No events yet
          </div>
        ) : (
          <>
            {events.map((evt, idx) => {
              const label = EVENT_LABELS[evt.type as WSEventType] || evt.type;
              const ts = (evt.payload?.timestamp as string) || '';

              return (
                <div
                  key={`ws-${idx}`}
                  style={{
                    padding: '10px 16px',
                    borderBottom: `1px solid ${C.borderLight}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.navy,
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: C.textTertiary,
                        fontFamily: MONO,
                      }}
                    >
                      {formatRelativeTime(ts)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textSecondary,
                      fontFamily: MONO,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {summarizePayload(evt.payload)}
                  </div>
                </div>
              );
            })}

            {/* Historical events */}
            {mergedHistory.map((evt) => (
              <div
                key={`hist-${evt.event_id}`}
                style={{
                  padding: '10px 16px',
                  borderBottom: `1px solid ${C.borderLight}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.navy,
                    }}
                  >
                    {EVENT_LABELS[evt.event_type as WSEventType] || evt.event_type}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textTertiary,
                      fontFamily: MONO,
                    }}
                  >
                    {formatRelativeTime(evt.created_at)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: C.textSecondary,
                    fontFamily: MONO,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}
                >
                  {summarizePayload(evt.payload)}
                </div>
              </div>
            ))}

            {/* Load more button */}
            {hasMore && (
              <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                <button
                  onClick={handleLoadMore}
                  disabled={historyLoading}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: BODY,
                    color: C.sky,
                    background: C.skyLight,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 16px',
                    cursor: historyLoading ? 'default' : 'pointer',
                    opacity: historyLoading ? 0.6 : 1,
                  }}
                >
                  {historyLoading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
