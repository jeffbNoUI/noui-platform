import { C } from '@/lib/designSystem';
import {
  useEnrollmentSubmission,
  useSubmitForValidation,
  useApproveSubmission,
  useRejectSubmission,
} from '@/hooks/useEmployerEnrollment';
import { useState } from 'react';
import type { SubmissionStatus } from '@/types/Employer';

interface StatusChangeFormProps {
  submissionId: string;
  onAction?: () => void;
}

const STATUS_BADGE: Record<SubmissionStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: C.border, text: C.textSecondary, label: 'Draft' },
  SUBMITTED: { bg: C.skyLight, text: C.sky, label: 'Submitted' },
  VALIDATING: { bg: C.goldLight, text: C.gold, label: 'Validating' },
  VALIDATED: { bg: C.sageLight, text: C.sage, label: 'Validated' },
  DUPLICATE_REVIEW: { bg: C.goldLight, text: C.gold, label: 'Duplicate Review' },
  APPROVED: { bg: C.sageLight, text: C.sage, label: 'Approved' },
  REJECTED: { bg: C.coralLight, text: C.coral, label: 'Rejected' },
};

export default function StatusChangeForm({ submissionId, onAction }: StatusChangeFormProps) {
  const { data: submission, isLoading } = useEnrollmentSubmission(submissionId);
  const submitMutation = useSubmitForValidation();
  const approveMutation = useApproveSubmission();
  const rejectMutation = useRejectSubmission();
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !submission) {
    return (
      <div style={{ padding: 16, color: C.textSecondary, fontSize: 14 }}>Loading submission...</div>
    );
  }

  const status = submission.submissionStatus as SubmissionStatus;
  const badge = STATUS_BADGE[status];

  const handleSubmit = async () => {
    setError(null);
    try {
      await submitMutation.mutateAsync(submissionId);
      onAction?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveMutation.mutateAsync(submissionId);
      onAction?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setError(null);
    try {
      await rejectMutation.mutateAsync({ id: submissionId, reason: rejectReason.trim() });
      setShowReject(false);
      setRejectReason('');
      onAction?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const btnStyle = (bg: string): React.CSSProperties => ({
    padding: '8px 16px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Member info summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
            {submission.firstName} {submission.lastName}
          </div>
          <div style={{ fontSize: 13, color: C.textSecondary }}>
            {submission.enrollmentType.replace(/_/g, ' ')} · {submission.planCode} ·{' '}
            {submission.divisionCode} · Hired {submission.hireDate}
          </div>
          {submission.tier && (
            <div style={{ fontSize: 12, color: C.textSecondary }}>Tier: {submission.tier}</div>
          )}
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 12,
            background: badge.bg,
            color: badge.text,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {badge.label}
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: C.coralLight,
            color: C.coral,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Action buttons based on current status */}
      <div style={{ display: 'flex', gap: 8 }}>
        {status === 'DRAFT' && (
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            style={btnStyle(C.sky)}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Validation'}
          </button>
        )}
        {(status === 'VALIDATED' || status === 'DUPLICATE_REVIEW') && (
          <>
            <button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              style={btnStyle(C.sage)}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </button>
            <button onClick={() => setShowReject(!showReject)} style={btnStyle(C.coral)}>
              Reject
            </button>
          </>
        )}
      </div>

      {/* Reject form */}
      {showReject && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            rows={2}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          <button
            onClick={handleReject}
            disabled={rejectMutation.isPending || !rejectReason.trim()}
            style={{ ...btnStyle(C.coral), opacity: !rejectReason.trim() ? 0.5 : 1 }}
          >
            {rejectMutation.isPending ? '...' : 'Confirm Reject'}
          </button>
        </div>
      )}

      {/* Rejection details */}
      {status === 'REJECTED' && submission.rejectionReason && (
        <div
          style={{
            padding: '10px 14px',
            background: C.coralLight,
            borderRadius: 6,
            fontSize: 13,
            color: C.coral,
          }}
        >
          <strong>Rejected:</strong> {submission.rejectionReason}
        </div>
      )}
    </div>
  );
}
