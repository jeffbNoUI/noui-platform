import { C, BODY } from '@/lib/designSystem';
import { STAGE_LABELS } from '@/lib/applicationStateMachine';
import type { StaffActivityEntry, MemberApplicationStage } from '@/types/RetirementApplication';

interface StaffReviewViewProps {
  activities: StaffActivityEntry[];
  submittedAt?: string;
  bounced?: boolean;
  bounceMessage?: string;
  bounceStage?: MemberApplicationStage;
  onResolveBounce?: () => void;
}

export default function StaffReviewView({
  activities,
  submittedAt,
  bounced,
  bounceMessage,
  bounceStage,
  onResolveBounce,
}: StaffReviewViewProps) {
  return (
    <div data-testid="staff-review-view">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontFamily: BODY,
            fontSize: 20,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 6px 0',
          }}
        >
          {bounced ? 'Action Required' : 'Application Under Review'}
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          {bounced
            ? 'Your retirement specialist needs you to make a correction before they can continue.'
            : 'A retirement specialist is reviewing your application. You will be notified when there is an update.'}
        </p>
      </div>

      {/* Bounce-back card */}
      {bounced && bounceMessage && (
        <div
          data-testid="bounce-card"
          style={{
            background: C.coralLight,
            border: `1px solid ${C.coral}`,
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: C.coral,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            Correction Requested
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 15,
              color: C.text,
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            {bounceMessage}
          </div>
          {bounceStage && (
            <div
              data-testid="bounce-target"
              style={{
                fontFamily: BODY,
                fontSize: 13,
                color: C.textSecondary,
                marginBottom: 12,
              }}
            >
              Please return to: <strong>{STAGE_LABELS[bounceStage]}</strong>
            </div>
          )}
          {onResolveBounce && (
            <button
              data-testid="resolve-bounce-button"
              onClick={onResolveBounce}
              style={{
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 700,
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                background: C.coral,
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              Go to {bounceStage ? STAGE_LABELS[bounceStage] : 'Stage'}
            </button>
          )}
        </div>
      )}

      {/* Submission timestamp */}
      {submittedAt && (
        <div
          data-testid="submitted-at"
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.textTertiary,
            marginBottom: 16,
          }}
        >
          Submitted on{' '}
          {new Date(submittedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      )}

      {/* Activity log */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${C.borderLight}`,
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: 600,
            color: C.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Staff Activity
        </div>

        {activities.length === 0 ? (
          <div
            data-testid="no-activities"
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              fontFamily: BODY,
              fontSize: 14,
              color: C.textTertiary,
            }}
          >
            No activity yet. A specialist will begin reviewing your application shortly.
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              data-testid={`activity-${activity.id}`}
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${C.borderLight}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: BODY,
                    fontSize: 14,
                    fontWeight: 600,
                    color: C.navy,
                  }}
                >
                  {activity.action}
                </div>
                {activity.note && (
                  <div
                    style={{
                      fontFamily: BODY,
                      fontSize: 13,
                      color: C.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {activity.note}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 12,
                  color: C.textTertiary,
                  whiteSpace: 'nowrap',
                  marginLeft: 16,
                }}
              >
                {new Date(activity.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
