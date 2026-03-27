import { useState, useCallback } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { PANEL_HEADING } from '../panelStyles';
import {
  useDriftRuns,
  useDriftRecords,
  useDriftSummary,
  useTriggerDriftDetection,
  useDriftSchedule,
  useUpdateDriftSchedule,
} from '@/hooks/useMigrationApi';
import type { DriftRun, DriftSeverity, DriftRecord } from '@/types/Migration';

// ─── Constants ──────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<DriftSeverity, string> = {
  CRITICAL: C.coral,
  HIGH: '#E67E22',
  MEDIUM: C.gold,
  LOW: C.textTertiary,
};

const SEVERITY_BG: Record<DriftSeverity, string> = {
  CRITICAL: C.coralLight,
  HIGH: '#FDF2E9',
  MEDIUM: C.goldLight,
  LOW: C.borderLight,
};

const STATUS_BADGE: Record<string, { color: string; bg: string }> = {
  CLEAN: { color: C.sage, bg: C.sageLight },
  DRIFTED: { color: C.gold, bg: C.goldLight },
  CRITICAL: { color: C.coral, bg: C.coralLight },
};

const RUN_STATUS_BADGE: Record<string, { color: string; bg: string }> = {
  PENDING: { color: C.textSecondary, bg: C.borderLight },
  RUNNING: { color: C.sky, bg: C.skyLight },
  COMPLETED: { color: C.sage, bg: C.sageLight },
  FAILED: { color: C.coral, bg: C.coralLight },
};

const INTERVAL_OPTIONS = [
  { value: 1, label: 'Every 1 hour' },
  { value: 6, label: 'Every 6 hours' },
  { value: 12, label: 'Every 12 hours' },
  { value: 24, label: 'Every 24 hours' },
  { value: 48, label: 'Every 48 hours' },
  { value: 168, label: 'Every 7 days' },
];

// ─── Severity filter options ────────────────────────────────────────────────

const SEVERITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Severities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  engagementId: string;
}

export default function DriftPanel({ engagementId }: Props) {
  const { data: summary } = useDriftSummary(engagementId);
  const { data: schedule } = useDriftSchedule(engagementId);
  const [page, setPage] = useState(1);
  const { data: runsData, isLoading: runsLoading } = useDriftRuns(engagementId, page);
  const triggerDetection = useTriggerDriftDetection();
  const updateSchedule = useUpdateDriftSchedule();

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [recordPage, setRecordPage] = useState(1);

  const { data: recordsData } = useDriftRecords(
    engagementId,
    expandedRunId ?? undefined,
    severityFilter || undefined,
    recordPage,
  );

  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const handleRunDetection = useCallback(() => {
    triggerDetection.mutate(engagementId);
  }, [triggerDetection, engagementId]);

  const handleScheduleToggle = useCallback(() => {
    if (!schedule) return;
    updateSchedule.mutate({
      engagementId,
      req: { enabled: !schedule.enabled },
    });
  }, [schedule, updateSchedule, engagementId]);

  const handleIntervalChange = useCallback(
    (value: number) => {
      updateSchedule.mutate({
        engagementId,
        req: { interval_hours: value },
      });
    },
    [updateSchedule, engagementId],
  );

  const handleRunClick = useCallback(
    (runId: string) => {
      if (expandedRunId === runId) {
        setExpandedRunId(null);
      } else {
        setExpandedRunId(runId);
        setRecordPage(1);
        setSeverityFilter('');
        setExpandedRecordId(null);
      }
    },
    [expandedRunId],
  );

  const summaryStatus = summary?.status ?? 'CLEAN';
  const badge = STATUS_BADGE[summaryStatus] ?? STATUS_BADGE.CLEAN;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: BODY }}>
      {/* Summary + Actions header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Drift status badge */}
        <div
          data-testid="drift-status-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            background: badge.bg,
            border: `1px solid ${badge.color}20`,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: badge.color,
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: badge.color,
            }}
          >
            {summaryStatus}
          </span>
          {summary?.last_run_at && (
            <span style={{ fontSize: 12, color: C.textSecondary, marginLeft: 4 }}>
              Last: {new Date(summary.last_run_at).toLocaleString()}
            </span>
          )}
        </div>

        {/* Run Detection button */}
        <button
          data-testid="run-detection-btn"
          onClick={handleRunDetection}
          disabled={triggerDetection.isPending}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: `1px solid ${C.sage}`,
            background: C.sage,
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            cursor: triggerDetection.isPending ? 'not-allowed' : 'pointer',
            opacity: triggerDetection.isPending ? 0.6 : 1,
            fontFamily: BODY,
          }}
        >
          {triggerDetection.isPending ? 'Running...' : 'Run Detection'}
        </button>

        <div style={{ flex: 1 }} />

        {/* Summary counts */}
        {summary && (
          <div style={{ display: 'flex', gap: 12 }}>
            {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
              const count = summary[`${sev}_count` as keyof typeof summary] as number;
              const severityKey = sev.toUpperCase() as DriftSeverity;
              return (
                <span
                  key={sev}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: SEVERITY_COLORS[severityKey],
                    background: SEVERITY_BG[severityKey],
                    padding: '3px 10px',
                    borderRadius: 12,
                  }}
                >
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}: {count ?? 0}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule configuration */}
      <div
        data-testid="drift-schedule-config"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 8,
          background: C.cardBgWarm,
          border: `1px solid ${C.border}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Schedule:</span>

        <select
          data-testid="drift-interval-select"
          value={schedule?.interval_hours ?? 24}
          onChange={(e) => handleIntervalChange(Number(e.target.value))}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            fontFamily: BODY,
            color: C.text,
            background: 'white',
          }}
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          data-testid="drift-schedule-toggle"
          onClick={handleScheduleToggle}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: `1px solid ${schedule?.enabled ? C.sage : C.border}`,
            background: schedule?.enabled ? C.sageLight : C.borderLight,
            color: schedule?.enabled ? C.sage : C.textSecondary,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BODY,
          }}
        >
          {schedule?.enabled ? 'Enabled' : 'Disabled'}
        </button>

        {schedule?.next_run_at && (
          <span style={{ fontSize: 12, color: C.textSecondary }}>
            Next: {new Date(schedule.next_run_at).toLocaleString()}
          </span>
        )}
      </div>

      {/* Run list */}
      <div>
        <h3 style={{ ...PANEL_HEADING, margin: '0 0 12px' }}>Detection Runs</h3>

        {runsLoading ? (
          <div
            className="animate-pulse"
            style={{ height: 120, borderRadius: 8, background: C.border }}
          />
        ) : !runsData?.runs?.length ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: C.textSecondary,
              fontSize: 13,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
            }}
          >
            No drift detection runs yet. Click "Run Detection" to start.
          </div>
        ) : (
          <div
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 100px 100px 100px 100px 1fr',
                gap: 0,
                padding: '8px 16px',
                background: C.cardBgWarm,
                borderBottom: `1px solid ${C.border}`,
                fontSize: 11,
                fontWeight: 600,
                color: C.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span>Run ID</span>
              <span>Type</span>
              <span>Status</span>
              <span>Changes</span>
              <span>Critical</span>
              <span>Started</span>
            </div>

            {/* Rows */}
            {runsData.runs.map((run: DriftRun) => (
              <div key={run.run_id}>
                <div
                  data-testid={`drift-run-${run.run_id}`}
                  onClick={() => handleRunClick(run.run_id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 100px 100px 100px 100px 1fr',
                    gap: 0,
                    padding: '10px 16px',
                    borderBottom: `1px solid ${C.borderLight}`,
                    cursor: 'pointer',
                    background: expandedRunId === run.run_id ? C.skyLight : 'white',
                    transition: 'background 0.15s',
                  }}
                >
                  <span
                    style={{ fontFamily: MONO, fontSize: 12, color: C.navy }}
                    title={run.run_id}
                  >
                    {run.run_id.slice(0, 8)}
                  </span>
                  <span style={{ fontSize: 12, color: C.text }}>{run.drift_type}</span>
                  <span>
                    <RunStatusBadge status={run.status} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>
                    {run.detected_changes}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: run.critical_changes > 0 ? C.coral : C.sage,
                    }}
                  >
                    {run.critical_changes}
                  </span>
                  <span style={{ fontSize: 12, color: C.textSecondary }}>
                    {new Date(run.started_at).toLocaleString()}
                  </span>
                </div>

                {/* Expanded record browser */}
                {expandedRunId === run.run_id && (
                  <RecordBrowser
                    records={recordsData?.records ?? []}
                    total={recordsData?.total ?? 0}
                    severityFilter={severityFilter}
                    onSeverityChange={(s) => {
                      setSeverityFilter(s);
                      setRecordPage(1);
                    }}
                    expandedRecordId={expandedRecordId}
                    onToggleRecord={(id) =>
                      setExpandedRecordId(expandedRecordId === id ? null : id)
                    }
                    page={recordPage}
                    onPageChange={setRecordPage}
                  />
                )}
              </div>
            ))}

            {/* Pagination */}
            {runsData.total > 20 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 12,
                  background: C.cardBgWarm,
                }}
              >
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                    background: 'white',
                    fontSize: 12,
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    fontFamily: BODY,
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 12, color: C.textSecondary, lineHeight: '28px' }}>
                  Page {page} of {Math.ceil(runsData.total / 20)}
                </span>
                <button
                  disabled={page * 20 >= runsData.total}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                    background: 'white',
                    fontSize: 12,
                    cursor: page * 20 >= runsData.total ? 'not-allowed' : 'pointer',
                    fontFamily: BODY,
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function RunStatusBadge({ status }: { status: string }) {
  const badge = RUN_STATUS_BADGE[status] ?? RUN_STATUS_BADGE.PENDING;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 10,
        color: badge.color,
        background: badge.bg,
      }}
    >
      {status}
    </span>
  );
}

function RecordBrowser({
  records,
  total,
  severityFilter,
  onSeverityChange,
  expandedRecordId,
  onToggleRecord,
  page,
  onPageChange,
}: {
  records: DriftRecord[];
  total: number;
  severityFilter: string;
  onSeverityChange: (s: string) => void;
  expandedRecordId: string | null;
  onToggleRecord: (id: string) => void;
  page: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div
      data-testid="drift-record-browser"
      style={{
        padding: '12px 16px 12px 32px',
        background: C.pageBg,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {/* Severity filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>Filter:</span>
        <select
          data-testid="severity-filter"
          value={severityFilter}
          onChange={(e) => onSeverityChange(e.target.value)}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: `1px solid ${C.border}`,
            fontSize: 12,
            fontFamily: BODY,
            background: 'white',
          }}
        >
          {SEVERITY_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: C.textTertiary, marginLeft: 8 }}>
          {total} record{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Records */}
      {records.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: C.textSecondary, fontSize: 12 }}>
          No records found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {records.map((rec) => (
            <div key={rec.record_id}>
              <div
                data-testid={`drift-record-${rec.record_id}`}
                onClick={() => onToggleRecord(rec.record_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: 'white',
                  border: `1px solid ${SEVERITY_COLORS[rec.severity]}20`,
                  cursor: 'pointer',
                }}
              >
                {/* Severity dot */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: SEVERITY_COLORS[rec.severity],
                    flexShrink: 0,
                  }}
                />
                {/* Severity badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 8,
                    color: SEVERITY_COLORS[rec.severity],
                    background: SEVERITY_BG[rec.severity],
                    flexShrink: 0,
                  }}
                >
                  {rec.severity}
                </span>
                {/* Change type badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 8,
                    color: C.navyLight,
                    background: C.skyLight,
                    flexShrink: 0,
                  }}
                >
                  {rec.change_type}
                </span>
                {/* Entity name */}
                <span style={{ fontSize: 13, fontWeight: 500, color: C.navy, flex: 1 }}>
                  {rec.entity_name}
                  {rec.field_name && (
                    <span style={{ color: C.textSecondary }}>.{rec.field_name}</span>
                  )}
                </span>
                {/* Expand arrow */}
                <span
                  style={{
                    color: C.textTertiary,
                    fontSize: 12,
                    transform:
                      expandedRecordId === rec.record_id ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                >
                  &#9654;
                </span>
              </div>

              {/* Detail expansion */}
              {expandedRecordId === rec.record_id && (
                <div
                  data-testid={`drift-record-detail-${rec.record_id}`}
                  style={{
                    margin: '4px 0 8px 20px',
                    padding: 12,
                    borderRadius: 6,
                    background: 'white',
                    border: `1px solid ${C.border}`,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.coral,
                          marginBottom: 4,
                        }}
                      >
                        Old Value
                      </div>
                      <pre
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          color: C.text,
                          background: C.coralLight,
                          padding: 8,
                          borderRadius: 4,
                          overflow: 'auto',
                          maxHeight: 200,
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {formatValue(rec.old_value)}
                      </pre>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.sage,
                          marginBottom: 4,
                        }}
                      >
                        New Value
                      </div>
                      <pre
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          color: C.text,
                          background: C.sageLight,
                          padding: 8,
                          borderRadius: 4,
                          overflow: 'auto',
                          maxHeight: 200,
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {formatValue(rec.new_value)}
                      </pre>
                    </div>
                  </div>
                  {Object.keys(rec.detail).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.textSecondary,
                          marginBottom: 4,
                        }}
                      >
                        Detail
                      </div>
                      <pre
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          color: C.text,
                          background: C.pageBg,
                          padding: 8,
                          borderRadius: 4,
                          overflow: 'auto',
                          maxHeight: 200,
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {JSON.stringify(rec.detail, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Record pagination */}
      {total > 50 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: 8,
          }}
        >
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: `1px solid ${C.border}`,
              background: 'white',
              fontSize: 11,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              fontFamily: BODY,
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: 11, color: C.textSecondary, lineHeight: '24px' }}>
            Page {page}
          </span>
          <button
            disabled={page * 50 >= total}
            onClick={() => onPageChange(page + 1)}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: `1px solid ${C.border}`,
              background: 'white',
              fontSize: 11,
              cursor: page * 50 >= total ? 'not-allowed' : 'pointer',
              fontFamily: BODY,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(null)';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
