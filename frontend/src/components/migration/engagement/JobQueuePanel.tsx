import { useState, useMemo } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { PANEL_HEADING, SECTION_HEADING } from '../panelStyles';
import { useJobs, useJobSummary, useCancelJob, useRetryJob } from '@/hooks/useMigrationApi';
import { useAuth } from '@/contexts/AuthContext';
import type { Job, JobStatus, JobType } from '@/types/Migration';
import type { UserRole } from '@/types/auth';

// ─── Constants ───────────────────────────────────────────────────────────────

const ERROR_TRUNCATE_LENGTH = 120;

const STATUS_COLORS: Record<JobStatus, { color: string; bg: string }> = {
  PENDING: { color: C.textSecondary, bg: C.borderLight },
  CLAIMED: { color: C.sky, bg: C.skyLight },
  RUNNING: { color: C.gold, bg: C.goldLight },
  COMPLETED: { color: C.sage, bg: C.sageLight },
  FAILED: { color: C.coral, bg: C.coralLight },
  CANCELLED: { color: C.textTertiary, bg: C.borderLight },
};

const JOB_TYPE_ICONS: Record<JobType, string> = {
  PROFILE: '📊',
  TRANSFORM: '🔄',
  RECONCILE: '⚖️',
  LOAD: '📥',
  VALIDATE: '✅',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateError(msg: string | null): string {
  if (!msg) return '';
  return msg.length > ERROR_TRUNCATE_LENGTH ? msg.slice(0, ERROR_TRUNCATE_LENGTH) + '...' : msg;
}

function formatDuration(job: Job): string {
  if (!job.started_at) return '—';
  const start = new Date(job.started_at).getTime();
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  const diffSec = Math.floor((end - start) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
  return `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
}

function canCancel(status: JobStatus): boolean {
  return status === 'PENDING' || status === 'CLAIMED';
}

function canRetry(status: JobStatus): boolean {
  return status === 'FAILED';
}

function isEditor(role: UserRole): boolean {
  return role === 'staff' || role === 'admin';
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  engagementId: string;
}

export default function JobQueuePanel({ engagementId }: Props) {
  const { user } = useAuth();
  const { data: jobs, isLoading: jobsLoading } = useJobs(engagementId);
  const { data: summary, isLoading: summaryLoading } = useJobSummary(engagementId);
  const cancelJob = useCancelJob();
  const retryJob = useRetryJob();

  const [confirmDialog, setConfirmDialog] = useState<{
    action: 'cancel' | 'retry';
    jobId: string;
  } | null>(null);

  const sortedJobs = useMemo(() => {
    if (!jobs) return [];
    return [...jobs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [jobs]);

  const userIsEditor = isEditor(user.role);

  // ─── Loading skeleton ────────────────────────────────────────────────────
  if (jobsLoading || summaryLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Summary cards skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: 72, borderRadius: 8, background: C.border }}
            />
          ))}
        </div>
        {/* Job list skeleton */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`row-${i}`}
            className="animate-pulse"
            style={{ height: 56, borderRadius: 8, background: C.border }}
          />
        ))}
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleAction(action: 'cancel' | 'retry', jobId: string) {
    setConfirmDialog({ action, jobId });
  }

  function handleConfirm() {
    if (!confirmDialog) return;
    const { action, jobId } = confirmDialog;
    if (action === 'cancel') {
      cancelJob.mutate({ engagementId, jobId });
    } else {
      retryJob.mutate({ engagementId, jobId });
    }
    setConfirmDialog(null);
  }

  function handleDismiss() {
    setConfirmDialog(null);
  }

  // ─── Stat cards ────────────────────────────────────────────────────────────

  const stats = [
    { label: 'Pending', value: summary?.pending ?? 0, color: C.textSecondary },
    { label: 'Running', value: summary?.running ?? 0, color: C.gold },
    { label: 'Completed', value: summary?.completed ?? 0, color: C.sage },
    { label: 'Failed', value: summary?.failed ?? 0, color: C.coral },
  ];

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Summary stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '16px 20px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color, fontFamily: DISPLAY }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4, fontWeight: 500 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Job list header */}
      <h3 style={{ ...PANEL_HEADING, margin: '0 0 12px' }}>Job Queue</h3>

      {/* Empty state */}
      {sortedJobs.length === 0 && (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: C.textSecondary,
            fontSize: 14,
            border: `1px dashed ${C.border}`,
            borderRadius: 8,
          }}
        >
          No jobs yet for this engagement.
        </div>
      )}

      {/* Job rows */}
      {sortedJobs.map((job) => (
        <JobRow
          key={job.job_id}
          job={job}
          showActions={userIsEditor}
          onCancel={() => handleAction('cancel', job.job_id)}
          onRetry={() => handleAction('retry', job.job_id)}
        />
      ))}

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleDismiss}
        >
          <div
            style={{
              background: C.cardBg,
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={SECTION_HEADING}>Are you sure?</h4>
            <p
              style={{ fontSize: 14, color: C.textSecondary, margin: '0 0 20px', lineHeight: 1.5 }}
            >
              {confirmDialog.action === 'cancel'
                ? 'This will cancel the pending job. It cannot be undone.'
                : 'This will retry the failed job from the beginning.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={handleDismiss}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.cardBg,
                  color: C.textSecondary,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                Dismiss
              </button>
              <button
                onClick={handleConfirm}
                aria-label="Confirm"
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: confirmDialog.action === 'cancel' ? C.coral : C.sage,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Job Row ─────────────────────────────────────────────────────────────────

function JobRow({
  job,
  showActions,
  onCancel,
  onRetry,
}: {
  job: Job;
  showActions: boolean;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const statusStyle = STATUS_COLORS[job.status];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: C.cardBg,
        marginBottom: 8,
      }}
    >
      {/* Type icon */}
      <span style={{ fontSize: 18, flexShrink: 0 }} title={job.job_type}>
        {JOB_TYPE_ICONS[job.job_type] ?? '📋'}
      </span>

      {/* Job info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{job.job_type}</span>
          <span
            role="status"
            aria-label={`Status: ${job.status}`}
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              color: statusStyle.color,
              background: statusStyle.bg,
            }}
          >
            {job.status}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 12,
            color: C.textSecondary,
          }}
        >
          <span title="Duration">{formatDuration(job)}</span>
          <span title="Attempts">
            {job.attempt} / {job.max_attempts}
          </span>
          {job.error_message && (
            <span
              style={{
                color: C.coral,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={truncateError(job.error_message)}
            >
              {truncateError(job.error_message)}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && canCancel(job.status) && (
        <button
          onClick={onCancel}
          aria-label="Cancel job"
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${C.coral}`,
            background: 'transparent',
            color: C.coral,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BODY,
            flexShrink: 0,
          }}
        >
          Cancel
        </button>
      )}
      {showActions && canRetry(job.status) && (
        <button
          onClick={onRetry}
          aria-label="Retry job"
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${C.sage}`,
            background: 'transparent',
            color: C.sage,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BODY,
            flexShrink: 0,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
