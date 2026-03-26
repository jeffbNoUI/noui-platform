import { useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import {
  useCutoverPlan,
  useCreateCutoverPlan,
  useUpdateCutoverStep,
  useRollback,
  useInitiateRollback,
  useGoLiveStatus,
  useConfirmGoLive,
} from '@/hooks/useMigrationApi';
import type { CutoverStepStatus, GoLiveTerminalStatus } from '@/types/Migration';

interface Props {
  engagementId: string;
}

// ─── Step Status Helpers ──────────────────────────────────────────────────────

const STEP_STATUS_LABEL: Record<CutoverStepStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
};

const STEP_STATUS_COLOR: Record<CutoverStepStatus, string> = {
  PENDING: C.textTertiary,
  IN_PROGRESS: C.sky,
  COMPLETED: C.sage,
  FAILED: C.coral,
  SKIPPED: C.gold,
};

const STEP_STATUS_BG: Record<CutoverStepStatus, string> = {
  PENDING: C.borderLight,
  IN_PROGRESS: C.skyLight,
  COMPLETED: C.sageLight,
  FAILED: C.coralLight,
  SKIPPED: C.goldLight,
};

const GO_LIVE_COLOR: Record<GoLiveTerminalStatus, string> = {
  LIVE: C.sage,
  ROLLED_BACK: C.coral,
  ABORTED: C.gold,
};

const GO_LIVE_BG: Record<GoLiveTerminalStatus, string> = {
  LIVE: C.sageLight,
  ROLLED_BACK: C.coralLight,
  ABORTED: C.goldLight,
};

// ─── Plan Creator ─────────────────────────────────────────────────────────────

function PlanCreator({ engagementId, onCreated }: { engagementId: string; onCreated: () => void }) {
  const createPlan = useCreateCutoverPlan();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([{ label: '', description: '' }]);

  const addStep = () => setSteps((s) => [...s, { label: '', description: '' }]);
  const removeStep = (idx: number) => setSteps((s) => s.filter((_, i) => i !== idx));
  const updateStep = (idx: number, field: 'label' | 'description', value: string) =>
    setSteps((s) => s.map((step, i) => (i === idx ? { ...step, [field]: value } : step)));

  const canSubmit = name.trim() !== '' && steps.every((s) => s.label.trim() !== '');

  const handleSubmit = () => {
    if (!canSubmit) return;
    createPlan.mutate(
      {
        engagementId,
        req: {
          name: name.trim(),
          steps: steps.map((s) => ({
            label: s.label.trim(),
            description: s.description.trim(),
          })),
        },
      },
      { onSuccess: onCreated },
    );
  };

  return (
    <div
      style={{
        background: C.cardBg,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        padding: 24,
      }}
    >
      <h3
        style={{
          fontFamily: DISPLAY,
          fontSize: 18,
          fontWeight: 600,
          color: C.navy,
          margin: '0 0 16px',
        }}
      >
        Create Cutover Plan
      </h3>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: C.textSecondary,
            marginBottom: 6,
          }}
        >
          Plan Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Production Cutover Plan"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            fontFamily: BODY,
            fontSize: 14,
            color: C.text,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: C.textSecondary,
            marginBottom: 8,
          }}
        >
          Steps
        </label>
        {steps.map((step, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 8,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textTertiary,
                minWidth: 24,
                paddingTop: 10,
              }}
            >
              {idx + 1}.
            </span>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={step.label}
                onChange={(e) => updateStep(idx, 'label', e.target.value)}
                placeholder="Step label"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontFamily: BODY,
                  fontSize: 13,
                  color: C.text,
                  outline: 'none',
                  marginBottom: 4,
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                value={step.description}
                onChange={(e) => updateStep(idx, 'description', e.target.value)}
                placeholder="Description (optional)"
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontFamily: BODY,
                  fontSize: 12,
                  color: C.textSecondary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {steps.length > 1 && (
              <button
                onClick={() => removeStep(idx)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: C.coral,
                  fontFamily: BODY,
                  marginTop: 4,
                }}
                title="Remove step"
              >
                &#10005;
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addStep}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: `1px dashed ${C.border}`,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 12,
            color: C.textSecondary,
            fontFamily: BODY,
          }}
        >
          + Add Step
        </button>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || createPlan.isPending}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: canSubmit && !createPlan.isPending ? C.sage : C.border,
          color: canSubmit && !createPlan.isPending ? C.textOnDark : C.textTertiary,
          fontFamily: BODY,
          fontSize: 14,
          fontWeight: 600,
          cursor: canSubmit && !createPlan.isPending ? 'pointer' : 'default',
        }}
      >
        {createPlan.isPending ? 'Creating...' : 'Create Plan'}
      </button>
    </div>
  );
}

// ─── Step Tracker ─────────────────────────────────────────────────────────────

function StepTracker({
  engagementId,
  steps,
}: {
  engagementId: string;
  steps: {
    step_id: string;
    sequence: number;
    label: string;
    description: string;
    status: CutoverStepStatus;
    notes: string | null;
  }[];
}) {
  const updateStep = useUpdateCutoverStep();
  const completedCount = steps.filter((s) => s.status === 'COMPLETED').length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  const nextStatus = (current: CutoverStepStatus): CutoverStepStatus => {
    switch (current) {
      case 'PENDING':
        return 'IN_PROGRESS';
      case 'IN_PROGRESS':
        return 'COMPLETED';
      default:
        return current;
    }
  };

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: C.textSecondary,
            marginBottom: 6,
          }}
        >
          <span>
            {completedCount} of {steps.length} steps completed
          </span>
          <span style={{ fontFamily: MONO }}>{progress.toFixed(0)}%</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: C.borderLight,
            overflow: 'hidden',
          }}
        >
          <div
            data-testid="cutover-progress-bar"
            style={{
              height: '100%',
              width: `${progress}%`,
              borderRadius: 3,
              background: C.sage,
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      {/* Steps list */}
      {steps.map((step, idx) => {
        const canAdvance = step.status === 'PENDING' || step.status === 'IN_PROGRESS';
        return (
          <div
            key={step.step_id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 0',
              borderBottom: idx < steps.length - 1 ? `1px solid ${C.borderLight}` : undefined,
            }}
          >
            {/* Step number circle */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
                background: STEP_STATUS_BG[step.status],
                color: STEP_STATUS_COLOR[step.status],
                border: `2px solid ${STEP_STATUS_COLOR[step.status]}`,
              }}
            >
              {step.status === 'COMPLETED' ? (
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 7L5.5 10.5L12 3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                step.sequence
              )}
            </div>

            {/* Step content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: C.navy,
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: STEP_STATUS_BG[step.status],
                    color: STEP_STATUS_COLOR[step.status],
                  }}
                >
                  {STEP_STATUS_LABEL[step.status]}
                </span>
              </div>
              {step.description && (
                <p
                  style={{
                    fontSize: 12,
                    color: C.textSecondary,
                    margin: '2px 0 0',
                    lineHeight: 1.4,
                  }}
                >
                  {step.description}
                </p>
              )}
              {step.notes && (
                <p
                  style={{
                    fontSize: 11,
                    color: C.textTertiary,
                    margin: '4px 0 0',
                    fontStyle: 'italic',
                  }}
                >
                  {step.notes}
                </p>
              )}
            </div>

            {/* Advance button */}
            {canAdvance && (
              <button
                onClick={() =>
                  updateStep.mutate({
                    engagementId,
                    stepId: step.step_id,
                    req: { status: nextStatus(step.status) },
                  })
                }
                disabled={updateStep.isPending}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.cardBg,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.navy,
                  fontFamily: BODY,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {step.status === 'PENDING' ? 'Start' : 'Complete'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Rollback Controls ────────────────────────────────────────────────────────

function RollbackControls({ engagementId }: { engagementId: string }) {
  const { data: rollback } = useRollback(engagementId);
  const initiateRollback = useInitiateRollback();
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);

  if (rollback && rollback.status !== 'AVAILABLE') {
    return (
      <div
        style={{
          background: C.coralLight,
          borderRadius: 10,
          border: `1px solid ${C.coral}`,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9V13M12 17H12.01M5.07 19H18.93C20.6 19 21.6 17.17 20.75 15.74L13.82 4.02C12.97 2.59 11.03 2.59 10.18 4.02L3.25 15.74C2.4 17.17 3.4 19 5.07 19Z"
              stroke={C.coral}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.coral }}>
            Rollback{' '}
            {rollback.status === 'INITIATED'
              ? 'In Progress'
              : rollback.status.toLowerCase().replace('_', ' ')}
          </span>
        </div>
        {rollback.trigger_reason && (
          <p style={{ fontSize: 13, color: C.text, margin: '4px 0 0' }}>
            Reason: {rollback.trigger_reason}
          </p>
        )}
        {rollback.initiated_by && (
          <p style={{ fontSize: 12, color: C.textSecondary, margin: '4px 0 0' }}>
            Initiated by: {rollback.initiated_by}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: C.cardBg,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4
          style={{
            fontFamily: DISPLAY,
            fontSize: 15,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Rollback Controls
        </h4>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: `1px solid ${C.coral}`,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: C.coral,
              fontFamily: BODY,
            }}
          >
            Initiate Rollback
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rollback..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              fontFamily: BODY,
              fontSize: 13,
              color: C.text,
              outline: 'none',
              minHeight: 60,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                if (!reason.trim()) return;
                initiateRollback.mutate(
                  { engagementId, req: { trigger_reason: reason.trim() } },
                  { onSuccess: () => setShowForm(false) },
                );
              }}
              disabled={!reason.trim() || initiateRollback.isPending}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: reason.trim() ? C.coral : C.border,
                color: reason.trim() ? C.textOnDark : C.textTertiary,
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 600,
                cursor: reason.trim() ? 'pointer' : 'default',
              }}
            >
              {initiateRollback.isPending ? 'Initiating...' : 'Confirm Rollback'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setReason('');
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.textSecondary,
                fontFamily: BODY,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Go-Live Display ──────────────────────────────────────────────────────────

function GoLiveDisplay({ engagementId }: { engagementId: string }) {
  const { data: goLive } = useGoLiveStatus(engagementId);
  const confirmGoLive = useConfirmGoLive();
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  if (goLive?.terminal_status) {
    const color = GO_LIVE_COLOR[goLive.terminal_status];
    const bg = GO_LIVE_BG[goLive.terminal_status];
    return (
      <div
        style={{
          background: bg,
          borderRadius: 10,
          border: `1px solid ${color}`,
          padding: 20,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}
        >
          {goLive.terminal_status === 'LIVE' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13L9 17L19 7"
                stroke={C.textOnDark}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke={C.textOnDark}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 700,
            color,
            margin: '0 0 4px',
          }}
        >
          {goLive.terminal_status === 'LIVE'
            ? 'System is Live'
            : goLive.terminal_status === 'ROLLED_BACK'
              ? 'Rolled Back'
              : 'Cutover Aborted'}
        </h3>
        {goLive.confirmed_by && (
          <p style={{ fontSize: 13, color: C.textSecondary, margin: '4px 0 0' }}>
            Confirmed by: {goLive.confirmed_by}
          </p>
        )}
        {goLive.go_live_at && (
          <p style={{ fontSize: 12, color: C.textTertiary, margin: '4px 0 0' }}>
            {new Date(goLive.go_live_at).toLocaleString()}
          </p>
        )}
        {goLive.notes && (
          <p
            style={{ fontSize: 12, color: C.textSecondary, margin: '8px 0 0', fontStyle: 'italic' }}
          >
            {goLive.notes}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: C.cardBg,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        padding: 20,
      }}
    >
      <h4
        style={{
          fontFamily: DISPLAY,
          fontSize: 15,
          fontWeight: 600,
          color: C.navy,
          margin: '0 0 12px',
        }}
      >
        Go-Live Confirmation
      </h4>
      <p style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 16px', lineHeight: 1.5 }}>
        Confirm that the migration cutover is complete and the system is ready for production use.
        This action will mark the engagement as live.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: C.sage,
            color: C.textOnDark,
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Confirm Go-Live
        </button>
      ) : (
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Go-live notes (optional)..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              fontFamily: BODY,
              fontSize: 13,
              color: C.text,
              outline: 'none',
              minHeight: 60,
              resize: 'vertical',
              marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() =>
                confirmGoLive.mutate(
                  { engagementId, req: { notes: notes.trim() || undefined } },
                  { onSuccess: () => setShowConfirm(false) },
                )
              }
              disabled={confirmGoLive.isPending}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: C.sage,
                color: C.textOnDark,
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                cursor: confirmGoLive.isPending ? 'default' : 'pointer',
              }}
            >
              {confirmGoLive.isPending ? 'Confirming...' : 'Confirm'}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setNotes('');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.textSecondary,
                fontFamily: BODY,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main CutoverPanel ───────────────────────────────────────────────────────

export default function CutoverPanel({ engagementId }: Props) {
  const { data: plan, isLoading } = useCutoverPlan(engagementId);

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: i === 0 ? 120 : 60,
              borderRadius: 8,
              background: C.border,
              marginBottom: 12,
            }}
          />
        ))}
      </div>
    );
  }

  if (!plan) {
    return <PlanCreator engagementId={engagementId} onCreated={() => {}} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Plan Header */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 4px',
          }}
        >
          {plan.name}
        </h3>
        <p style={{ fontSize: 12, color: C.textTertiary, margin: 0, fontFamily: MONO }}>
          Plan ID: {plan.plan_id.slice(0, 8)}...
        </p>
        {plan.scheduled_start && (
          <p style={{ fontSize: 12, color: C.textSecondary, margin: '4px 0 0' }}>
            Scheduled: {new Date(plan.scheduled_start).toLocaleDateString()}
            {plan.scheduled_end && ` - ${new Date(plan.scheduled_end).toLocaleDateString()}`}
          </p>
        )}
      </div>

      {/* Step Tracker */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
        }}
      >
        <h4
          style={{
            fontFamily: DISPLAY,
            fontSize: 15,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 16px',
          }}
        >
          Cutover Steps
        </h4>
        <StepTracker engagementId={engagementId} steps={plan.steps} />
      </div>

      {/* Rollback Controls */}
      <RollbackControls engagementId={engagementId} />

      {/* Go-Live Display */}
      <GoLiveDisplay engagementId={engagementId} />
    </div>
  );
}
