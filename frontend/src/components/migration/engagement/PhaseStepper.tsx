import { C, BODY } from '@/lib/designSystem';
import type { EngagementStatus, PhaseGateTransition } from '@/types/Migration';

const PHASES: { key: EngagementStatus; label: string }[] = [
  { key: 'DISCOVERY', label: 'Discover' },
  { key: 'PROFILING', label: 'Profile' },
  { key: 'MAPPING', label: 'Map' },
  { key: 'TRANSFORMING', label: 'Transform' },
  { key: 'RECONCILING', label: 'Reconcile' },
  { key: 'PARALLEL_RUN', label: 'Parallel Run' },
  { key: 'CUTOVER_IN_PROGRESS', label: 'Cutover' },
  { key: 'GO_LIVE', label: 'Go-Live' },
  { key: 'COMPLETE', label: 'Complete' },
];

const STATUS_COLOR: Record<EngagementStatus, string> = {
  DISCOVERY: '#94a3b8',
  PROFILING: C.sky,
  MAPPING: C.gold,
  TRANSFORMING: C.sage,
  RECONCILING: C.coral,
  PARALLEL_RUN: C.navyLight,
  CUTOVER_IN_PROGRESS: C.gold,
  GO_LIVE: C.sage,
  COMPLETE: C.sage,
};

interface Props {
  currentStatus: EngagementStatus;
  attentionByPhase?: Partial<Record<EngagementStatus, number>>;
  gateHistory?: PhaseGateTransition[];
  onPhaseClick?: (phase: EngagementStatus) => void;
}

function getGateTooltip(
  phase: EngagementStatus,
  gateHistory?: PhaseGateTransition[],
): string | undefined {
  if (!gateHistory) return undefined;
  const transition = gateHistory.find((g) => g.toPhase === phase && g.direction === 'ADVANCE');
  if (!transition) return undefined;
  const date = new Date(transition.authorizedAt).toLocaleDateString();
  return `Authorized by ${transition.authorizedBy} on ${date}`;
}

export default function PhaseStepper({
  currentStatus,
  attentionByPhase,
  gateHistory,
  onPhaseClick,
}: Props) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentStatus);

  return (
    <>
      <style>{`
        @keyframes phasePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(91, 138, 114, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(91, 138, 114, 0); }
        }
        @media (max-width: 640px) {
          .phase-stepper-track { padding: 16px 12px !important; }
          .phase-stepper-track .phase-connector { width: 16px !important; }
          .phase-stepper-track .phase-label { font-size: 9px !important; }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 24px',
          fontFamily: BODY,
          overflowX: 'auto',
          minWidth: 0,
          gap: 0,
        }}
        className="phase-stepper-track"
      >
        {PHASES.map((phase, idx) => {
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;
          const color = STATUS_COLOR[phase.key];
          const attentionCount = attentionByPhase?.[phase.key];
          const tooltip = isCompleted ? getGateTooltip(phase.key, gateHistory) : undefined;
          const isClickable = !!onPhaseClick;
          // Clicking a completed phase from a later phase would be regression
          const isRegression = isCompleted && currentIdx > idx;

          return (
            <div key={phase.key} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Step circle + label */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  position: 'relative',
                }}
              >
                <div
                  title={tooltip}
                  onClick={isClickable ? () => onPhaseClick(phase.key) : undefined}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    cursor: isClickable ? 'pointer' : 'default',
                    position: 'relative',
                    ...(isCompleted
                      ? {
                          background: C.sage,
                          color: C.textOnDark,
                          border: `2px solid ${C.sage}`,
                        }
                      : isActive
                        ? {
                            background: C.cardBg,
                            color: color,
                            border: `2px solid ${color}`,
                            animation: 'phasePulse 2s ease-in-out infinite',
                          }
                        : {
                            background: C.cardBg,
                            color: C.textTertiary,
                            border: `2px solid ${C.border}`,
                          }),
                  }}
                >
                  {isCompleted ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2 7L5.5 10.5L12 3.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>

                {/* Attention badge */}
                {isCompleted && attentionCount != null && attentionCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: C.coral,
                      color: C.textOnDark,
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px solid ${C.cardBg}`,
                      lineHeight: 1,
                    }}
                  >
                    {attentionCount > 9 ? '9+' : attentionCount}
                  </span>
                )}

                <span
                  className="phase-label"
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 500,
                    color: isCompleted ? C.sage : isActive ? color : C.textTertiary,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  {phase.label}
                  {/* Regression indicator on hover — rendered always for completed phases, CSS handles visibility */}
                  {isRegression && isClickable && (
                    <span
                      style={{
                        fontSize: 10,
                        opacity: 0.5,
                      }}
                      title="Clicking will regress to this phase"
                    >
                      &#8617;
                    </span>
                  )}
                </span>
              </div>

              {/* Connecting line */}
              {idx < PHASES.length - 1 && (
                <div
                  className="phase-connector"
                  style={{
                    width: 32,
                    height: 2,
                    marginLeft: 6,
                    marginRight: 6,
                    marginBottom: 20,
                    background: isCompleted ? C.sage : C.border,
                    transition: 'background 0.2s',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
