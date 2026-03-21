import { C, BODY } from '@/lib/designSystem';
import type { EngagementStatus } from '@/types/Migration';

const PHASES: { key: EngagementStatus; label: string }[] = [
  { key: 'PROFILING', label: 'Profile' },
  { key: 'MAPPING', label: 'Map' },
  { key: 'TRANSFORMING', label: 'Transform' },
  { key: 'RECONCILING', label: 'Reconcile' },
  { key: 'PARALLEL_RUN', label: 'Parallel Run' },
  { key: 'COMPLETE', label: 'Complete' },
];

const STATUS_COLOR: Record<EngagementStatus, string> = {
  PROFILING: C.sky,
  MAPPING: C.gold,
  TRANSFORMING: C.sage,
  RECONCILING: C.coral,
  PARALLEL_RUN: C.navyLight,
  COMPLETE: C.sage,
};

interface Props {
  currentStatus: EngagementStatus;
}

export default function PhaseStepper({ currentStatus }: Props) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentStatus);

  return (
    <>
      <style>{`
        @keyframes phasePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(91, 138, 114, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(91, 138, 114, 0); }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 24px',
          fontFamily: BODY,
        }}
      >
        {PHASES.map((phase, idx) => {
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;
          const color = STATUS_COLOR[phase.key];

          return (
            <div key={phase.key} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Step circle + label */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div
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
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 500,
                    color: isCompleted ? C.sage : isActive ? color : C.textTertiary,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connecting line */}
              {idx < PHASES.length - 1 && (
                <div
                  style={{
                    width: 48,
                    height: 2,
                    marginLeft: 8,
                    marginRight: 8,
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
