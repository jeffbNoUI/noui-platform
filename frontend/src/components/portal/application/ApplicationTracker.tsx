import { C, BODY } from '@/lib/designSystem';
import { MEMBER_STAGES, STAGE_LABELS, getStageIndex } from '@/lib/applicationStateMachine';
import type { MemberApplicationStage, StageCompletion } from '@/types/RetirementApplication';

interface ApplicationTrackerProps {
  currentStage: MemberApplicationStage;
  stages: StageCompletion[];
  onStageClick?: (stage: MemberApplicationStage) => void;
}

type StepStatus = 'complete' | 'current' | 'bounced' | 'future';

function getStepStatus(
  stage: MemberApplicationStage,
  currentStage: MemberApplicationStage,
  stages: StageCompletion[],
): StepStatus {
  const completion = stages.find((s) => s.stage === stage);
  if (completion?.status === 'bounced') return 'bounced';
  if (completion?.status === 'complete') return 'complete';
  if (stage === currentStage) return 'current';
  return 'future';
}

const STATUS_COLORS: Record<
  StepStatus,
  { bg: string; border: string; text: string; label: string }
> = {
  complete: { bg: C.sage, border: C.sage, text: '#FFFFFF', label: C.sage },
  current: { bg: C.sageLight, border: C.sage, text: C.sage, label: C.navy },
  bounced: { bg: C.coralLight, border: C.coral, text: C.coral, label: C.coral },
  future: { bg: C.pageBg, border: C.borderLight, text: C.textTertiary, label: C.textTertiary },
};

const STATUS_INDICATOR: Record<StepStatus, string> = {
  complete: '\u2713',
  current: '',
  bounced: '!',
  future: '',
};

export default function ApplicationTracker({
  currentStage,
  stages,
  onStageClick,
}: ApplicationTrackerProps) {
  // Only show member-facing stages in the tracker
  const isStaffOrComplete = currentStage === 'staff_review' || currentStage === 'complete';

  return (
    <div data-testid="application-tracker" style={{ width: '100%' }}>
      {/* Status banner for staff review / complete */}
      {isStaffOrComplete && (
        <div
          data-testid="status-banner"
          style={{
            background: currentStage === 'complete' ? C.sageLight : C.goldLight,
            border: `1px solid ${currentStage === 'complete' ? C.sage : C.gold}`,
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: currentStage === 'complete' ? C.sage : C.gold,
            textAlign: 'center',
          }}
        >
          {currentStage === 'complete'
            ? 'Your retirement application has been processed.'
            : 'Your application is being reviewed by a retirement specialist.'}
        </div>
      )}

      {/* Step tracker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0,
          position: 'relative',
        }}
      >
        {MEMBER_STAGES.map((stage, idx) => {
          const status = getStepStatus(stage, currentStage, stages);
          const colors = STATUS_COLORS[status];
          const indicator = STATUS_INDICATOR[status];
          const isClickable = onStageClick && status === 'complete';
          const isLast = idx === MEMBER_STAGES.length - 1;

          return (
            <div
              key={stage}
              data-testid={`step-${stage}`}
              data-status={status}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: isClickable ? 'pointer' : 'default',
              }}
              onClick={() => isClickable && onStageClick(stage)}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
            >
              {/* Circle + connector line */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  justifyContent: 'center',
                  position: 'relative',
                  marginBottom: 8,
                }}
              >
                {/* Connector line (left half) */}
                {idx > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: '50%',
                      top: '50%',
                      height: 2,
                      background:
                        getStepStatus(MEMBER_STAGES[idx - 1], currentStage, stages) === 'complete'
                          ? C.sage
                          : C.borderLight,
                      transform: 'translateY(-50%)',
                    }}
                  />
                )}

                {/* Connector line (right half) */}
                {!isLast && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      right: 0,
                      top: '50%',
                      height: 2,
                      background: status === 'complete' ? C.sage : C.borderLight,
                      transform: 'translateY(-50%)',
                    }}
                  />
                )}

                {/* Step circle */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: colors.bg,
                    border: `2px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: BODY,
                    fontSize: indicator ? 14 : 12,
                    fontWeight: 700,
                    color: colors.text,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {indicator || getStageIndex(stage) + 1}
                </div>
              </div>

              {/* Stage label */}
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 11,
                  fontWeight: status === 'current' ? 700 : 500,
                  color: colors.label,
                  textAlign: 'center',
                  lineHeight: 1.3,
                  maxWidth: 100,
                }}
              >
                {STAGE_LABELS[stage]}
              </div>

              {/* Status label */}
              {(status === 'current' || status === 'bounced') && (
                <div
                  data-testid={`label-${stage}`}
                  style={{
                    fontFamily: BODY,
                    fontSize: 10,
                    fontWeight: 600,
                    color: status === 'bounced' ? C.coral : C.sage,
                    marginTop: 4,
                  }}
                >
                  {status === 'bounced' ? 'Action needed' : 'Your action needed'}
                </div>
              )}

              {currentStage === 'staff_review' &&
                stage === 'review_submit' &&
                stages.find((s) => s.stage === 'review_submit')?.status === 'complete' && (
                  <div
                    data-testid="waiting-label"
                    style={{
                      fontFamily: BODY,
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.gold,
                      marginTop: 4,
                    }}
                  >
                    Waiting on staff
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
