import { useEffect } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useRetirementApplication } from '@/hooks/useRetirementApplication';
import { useEligibility } from '@/hooks/useBenefitCalculation';
import { STAGE_LABELS, STAGE_DESCRIPTIONS } from '@/lib/applicationStateMachine';
import ApplicationTracker from './ApplicationTracker';
import VerifyInfoStage from './VerifyInfoStage';
import UploadDocsStage from './UploadDocsStage';
import BenefitEstimateStage from './BenefitEstimateStage';
import PaymentOptionStage from './PaymentOptionStage';
import ReviewSubmitStage from './ReviewSubmitStage';
import StaffReviewView from './StaffReviewView';
import type { MemberPersona } from '@/types/MemberPortal';

interface ApplicationSectionProps {
  memberId: number;
  personas: MemberPersona[];
}

export default function ApplicationSection({ memberId }: ApplicationSectionProps) {
  const {
    appState,
    applicationStatus,
    existingCase,
    casesLoading,
    startApplication,
    navigateToStage,
    markStageComplete,
    updateVerificationItem,
    setPaymentSelection,
    updateAcknowledgment,
    resolveBounce,
  } = useRetirementApplication(memberId);

  const eligibility = useEligibility(memberId);

  // If there's an existing case but no local state, we're in staff_review or complete
  const effectiveStatus = appState
    ? applicationStatus
    : existingCase
      ? 'under_review'
      : 'not_started';

  // Auto-populate from existing case on mount
  useEffect(() => {
    if (existingCase && !appState && existingCase.status !== 'complete') {
      // Case exists, show staff review view
    }
  }, [existingCase, appState]);

  if (casesLoading) {
    return (
      <div
        data-testid="application-loading"
        style={{
          padding: 40,
          textAlign: 'center',
          fontFamily: BODY,
          fontSize: 15,
          color: C.textSecondary,
        }}
      >
        Loading application status...
      </div>
    );
  }

  // Not started — show eligibility info and start button
  if (effectiveStatus === 'not_started') {
    return (
      <div data-testid="application-section">
        <div data-testid="not-started-view">
          <h2
            style={{
              fontFamily: BODY,
              fontSize: 22,
              fontWeight: 700,
              color: C.navy,
              margin: '0 0 8px 0',
            }}
          >
            Retirement Application
          </h2>
          <p
            style={{
              fontFamily: BODY,
              fontSize: 15,
              color: C.textSecondary,
              margin: '0 0 24px 0',
              lineHeight: 1.6,
            }}
          >
            When you&apos;re ready to retire, this guided process will walk you through verifying
            your information, uploading required documents, reviewing your benefit estimate, and
            selecting a payment option.
          </p>

          {/* Eligibility check */}
          {eligibility.data && (
            <div
              data-testid="eligibility-summary"
              style={{
                background: C.cardBg,
                border: `1px solid ${C.borderLight}`,
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
                  color: C.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                Your Eligibility
              </div>
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 15,
                  color: C.navy,
                  fontWeight: 600,
                }}
              >
                {eligibility.data.best_eligible_type === 'NORMAL'
                  ? 'You are eligible for normal retirement.'
                  : eligibility.data.best_eligible_type === 'EARLY'
                    ? 'You are eligible for early retirement (with benefit reduction).'
                    : 'You are not yet eligible for retirement.'}
              </div>
            </div>
          )}

          <button
            data-testid="start-application-button"
            onClick={() => startApplication()}
            style={{
              fontFamily: BODY,
              fontSize: 16,
              fontWeight: 700,
              padding: '12px 32px',
              borderRadius: 8,
              border: 'none',
              background: C.sage,
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Start Application
          </button>
        </div>
      </div>
    );
  }

  // Under review (existing case, no local state) — show staff review view
  if (effectiveStatus === 'under_review' && !appState) {
    return (
      <div data-testid="application-section">
        <StaffReviewView activities={[]} submittedAt={existingCase?.createdAt} />
      </div>
    );
  }

  // Complete
  if (effectiveStatus === 'complete' || existingCase?.status === 'complete') {
    return (
      <div data-testid="application-section">
        <div data-testid="complete-view">
          <h2
            style={{
              fontFamily: BODY,
              fontSize: 22,
              fontWeight: 700,
              color: C.sage,
              margin: '0 0 8px 0',
            }}
          >
            Application Complete
          </h2>
          <p style={{ fontFamily: BODY, fontSize: 15, color: C.textSecondary }}>
            Your retirement application has been processed. Check the My Benefit section for your
            payment details.
          </p>
        </div>
      </div>
    );
  }

  // In progress — show tracker + current stage
  if (!appState) return null;

  const currentStage = appState.current_stage;
  const bounceMsg = appState.bounce_stage === currentStage ? appState.bounce_message : undefined;

  return (
    <div data-testid="application-section">
      {/* Progress tracker */}
      <ApplicationTracker
        currentStage={currentStage}
        stages={appState.stages}
        onStageClick={navigateToStage}
      />

      {/* Stage header */}
      <div style={{ margin: '24px 0 16px 0' }}>
        <h2
          style={{
            fontFamily: BODY,
            fontSize: 18,
            fontWeight: 700,
            color: C.navy,
            margin: 0,
          }}
        >
          {STAGE_LABELS[currentStage]}
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.textTertiary,
            margin: '4px 0 0 0',
          }}
        >
          {STAGE_DESCRIPTIONS[currentStage]}
        </p>
      </div>

      {/* Stage content */}
      {currentStage === 'verify_info' && (
        <VerifyInfoStage
          items={appState.verification_items}
          onItemVerified={updateVerificationItem}
          onItemFlagged={() => {}}
          onComplete={markStageComplete}
          bounceMessage={bounceMsg}
        />
      )}

      {currentStage === 'upload_docs' && (
        <UploadDocsStage
          documents={appState.required_documents}
          onUpload={() => {}}
          uploadStatuses={{}}
          onComplete={markStageComplete}
          bounceMessage={bounceMsg}
        />
      )}

      {currentStage === 'benefit_estimate' && (
        <BenefitEstimateStage
          result={null}
          onConfirm={markStageComplete}
          onDispute={() => {}}
          bounceMessage={bounceMsg}
        />
      )}

      {currentStage === 'payment_option' && (
        <PaymentOptionStage
          options={[]}
          amounts={[]}
          selectedOption={appState.payment_selection ?? null}
          onSelect={setPaymentSelection}
          onComplete={markStageComplete}
          bounceMessage={bounceMsg}
        />
      )}

      {currentStage === 'review_submit' && (
        <ReviewSubmitStage
          application={appState}
          acknowledgments={appState.acknowledgments}
          onAcknowledgmentChange={updateAcknowledgment}
          onSubmit={markStageComplete}
        />
      )}

      {currentStage === 'staff_review' && (
        <StaffReviewView
          activities={[]}
          submittedAt={appState.submitted_at}
          bounced={appState.status === 'bounced'}
          bounceMessage={appState.bounce_message}
          bounceStage={appState.bounce_stage}
          onResolveBounce={resolveBounce}
        />
      )}

      {currentStage === 'complete' && (
        <div data-testid="complete-view">
          <h2
            style={{
              fontFamily: BODY,
              fontSize: 22,
              fontWeight: 700,
              color: C.sage,
              margin: '0 0 8px 0',
            }}
          >
            Application Complete
          </h2>
          <p style={{ fontFamily: BODY, fontSize: 15, color: C.textSecondary }}>
            Your retirement application has been processed.
          </p>
        </div>
      )}
    </div>
  );
}
