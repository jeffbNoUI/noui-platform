import { useState } from 'react';
import { useRefundEstimate } from '@/hooks/useRefundEstimate';
import { useMember } from '@/hooks/useMember';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { formatCurrency, DEMO_MEMBER } from '../MemberPortalUtils';

export interface RefundApplicationProps {
  memberId: number;
  onBack?: () => void;
}

const STAGE_LABELS = ['Verify Info', 'Distribution', 'Review', 'Acknowledge', 'Processing'];

export default function RefundApplication({ memberId, onBack }: RefundApplicationProps) {
  const { data: member, isLoading: memberLoading } = useMember(memberId);
  const { data: estimate, isLoading: estimateLoading } = useRefundEstimate(memberId);

  const [stage, setStage] = useState(0);
  const [distributionChoice, setDistributionChoice] = useState<'withholding' | 'rollover' | null>(
    null,
  );
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  const effectiveMember = member ?? DEMO_MEMBER;
  const total = estimate?.total ?? 0;
  // Use backend-provided values when available (single source of truth for financial calculations)
  const estAny = estimate as Record<string, number> | undefined;
  const netWithholding = estAny?.net_after_withhold ?? total * 0.8;

  const canContinue = (): boolean => {
    if (stage === 0) return true;
    if (stage === 1) return distributionChoice !== null;
    if (stage === 2) return true;
    if (stage === 3) return ack1 && ack2;
    return false;
  };

  const handleContinue = () => {
    if (stage < 3) {
      setStage(stage + 1);
    }
  };

  const handleSubmit = () => {
    if (ack1 && ack2) {
      setSubmitted(true);
      setSubmittedAt(Date.now());
      setStage(4);
    }
  };

  const handleBack = () => {
    if (stage > 0 && stage < 4) {
      setStage(stage - 1);
    }
  };

  if (memberLoading || estimateLoading) {
    return (
      <div data-testid="refund-application" style={{ padding: 32 }}>
        <p style={{ fontFamily: BODY, color: C.textSecondary }}>Loading...</p>
      </div>
    );
  }

  return (
    <div data-testid="refund-application" style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {onBack && (
          <button
            data-testid="back-to-dashboard"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: BODY,
              fontSize: 13,
              color: C.sage,
              padding: 0,
            }}
          >
            &larr; Back
          </button>
        )}
        <h2
          style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color: C.navy, margin: 0 }}
        >
          Refund Application
        </h2>
      </div>

      {/* Stage Tracker */}
      <div data-testid="refund-stage-tracker" style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {STAGE_LABELS.map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                marginBottom: 6,
                background: i <= stage ? C.sage : C.borderLight,
              }}
            />
            <div
              style={{
                fontFamily: BODY,
                fontSize: 11,
                fontWeight: i === stage ? 700 : 400,
                color: i <= stage ? C.sage : C.textTertiary,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Stage 0 — Verify Info */}
      {stage === 0 && (
        <div data-testid="verify-info-stage">
          <h3 style={{ fontFamily: BODY, fontSize: 18, fontWeight: 700, color: C.navy }}>
            Verify Your Information
          </h3>
          <p style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
            Please confirm the information below is correct before proceeding.
          </p>
          <div
            style={{
              background: C.cardBg,
              borderRadius: 10,
              border: `1px solid ${C.borderLight}`,
              padding: 20,
            }}
          >
            {[
              {
                label: 'Full Name',
                value: `${effectiveMember.first_name} ${effectiveMember.last_name}`,
              },
              { label: 'Member ID', value: `#${effectiveMember.member_id}` },
              { label: 'Status', value: 'Inactive \u2014 eligible for refund' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: `1px solid ${C.borderLight}`,
                }}
              >
                <span style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary }}>
                  {item.label}
                </span>
                <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.navy }}>
                  {'\u2713'} {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage 1 — Distribution Choice */}
      {stage === 1 && (
        <div data-testid="distribution-stage">
          <h3 style={{ fontFamily: BODY, fontSize: 18, fontWeight: 700, color: C.navy }}>
            Choose Distribution Method
          </h3>
          <p style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
            Select how you would like to receive your refund.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Lump Sum Check */}
            <div
              data-testid="choice-withholding"
              onClick={() => setDistributionChoice('withholding')}
              style={{
                flex: 1,
                padding: 20,
                borderRadius: 10,
                cursor: 'pointer',
                background: C.cardBg,
                border: `2px solid ${distributionChoice === 'withholding' ? C.sage : C.borderLight}`,
                transition: 'border-color 0.15s',
              }}
            >
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.navy,
                  marginBottom: 8,
                }}
              >
                Lump Sum Check
              </div>
              <div
                style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginBottom: 12 }}
              >
                20% federal tax withheld
              </div>
              <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.sage }}>
                You receive: {formatCurrency(netWithholding)}
              </div>
            </div>

            {/* Direct IRA Rollover */}
            <div
              data-testid="choice-rollover"
              onClick={() => setDistributionChoice('rollover')}
              style={{
                flex: 1,
                padding: 20,
                borderRadius: 10,
                cursor: 'pointer',
                background: C.cardBg,
                border: `2px solid ${distributionChoice === 'rollover' ? C.sage : C.borderLight}`,
                transition: 'border-color 0.15s',
              }}
            >
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.navy,
                  marginBottom: 8,
                }}
              >
                Direct IRA Rollover
              </div>
              <div
                style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginBottom: 12 }}
              >
                Full amount transferred
              </div>
              <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.sage }}>
                Tax deferred
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage 2 — Review */}
      {stage === 2 && (
        <div data-testid="review-stage">
          <h3 style={{ fontFamily: BODY, fontSize: 18, fontWeight: 700, color: C.navy }}>
            Review Your Refund
          </h3>
          <p style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
            Please review carefully before acknowledging.
          </p>
          <div
            style={{
              background: C.cardBg,
              borderRadius: 10,
              border: `1px solid ${C.borderLight}`,
              padding: 20,
            }}
          >
            {[
              { label: 'Total Refund', value: formatCurrency(total) },
              {
                label: 'Distribution Method',
                value:
                  distributionChoice === 'withholding'
                    ? 'Lump Sum Check (20% withheld)'
                    : 'Direct IRA Rollover',
              },
              {
                label: "Amount You'll Receive",
                value:
                  distributionChoice === 'withholding'
                    ? formatCurrency(netWithholding)
                    : formatCurrency(total),
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: `1px solid ${C.borderLight}`,
                }}
              >
                <span style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>
                  {item.label}
                </span>
                <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: C.navy }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage 3 — Acknowledge */}
      {stage === 3 && (
        <div data-testid="acknowledge-stage">
          <h3 style={{ fontFamily: BODY, fontSize: 18, fontWeight: 700, color: C.navy }}>
            Acknowledgment Required
          </h3>
          <p style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
            You must acknowledge both statements below before submitting.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label
              data-testid="ack-forfeiture"
              style={{
                display: 'flex',
                gap: 12,
                padding: 16,
                borderRadius: 10,
                cursor: 'pointer',
                background: C.cardBg,
                border: `1px solid ${ack1 ? C.sage : C.borderLight}`,
              }}
            >
              <input
                type="checkbox"
                checked={ack1}
                onChange={(e) => setAck1(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.sage }}
              />
              <span style={{ fontFamily: BODY, fontSize: 13, color: C.navy, lineHeight: 1.5 }}>
                I understand that by requesting a refund, I permanently forfeit all rights to a
                future pension benefit from this plan. This action cannot be reversed.
              </span>
            </label>
            <label
              data-testid="ack-tax"
              style={{
                display: 'flex',
                gap: 12,
                padding: 16,
                borderRadius: 10,
                cursor: 'pointer',
                background: C.cardBg,
                border: `1px solid ${ack2 ? C.sage : C.borderLight}`,
              }}
            >
              <input
                type="checkbox"
                checked={ack2}
                onChange={(e) => setAck2(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.sage }}
              />
              <span style={{ fontFamily: BODY, fontSize: 13, color: C.navy, lineHeight: 1.5 }}>
                I understand the tax implications of my chosen distribution method and that I am
                solely responsible for any tax liability.
              </span>
            </label>
          </div>

          <button
            data-testid="submit-refund"
            disabled={!ack1 || !ack2}
            onClick={handleSubmit}
            style={{
              marginTop: 24,
              width: '100%',
              padding: '14px 0',
              borderRadius: 10,
              border: 'none',
              cursor: ack1 && ack2 ? 'pointer' : 'not-allowed',
              fontFamily: BODY,
              fontSize: 15,
              fontWeight: 700,
              background: ack1 && ack2 ? C.coral : C.borderLight,
              color: ack1 && ack2 ? '#fff' : C.textTertiary,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            Submit Application
          </button>
        </div>
      )}

      {/* Stage 4 — Processing */}
      {stage === 4 && submitted && (
        <div data-testid="processing-stage" style={{ textAlign: 'center', padding: '40px 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: C.sageLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <span style={{ fontSize: 28, color: C.sage }}>{'\u2713'}</span>
          </div>
          <h3
            style={{
              fontFamily: BODY,
              fontSize: 20,
              fontWeight: 700,
              color: C.navy,
              marginBottom: 8,
            }}
          >
            Your refund application has been submitted
          </h3>
          <p style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>
            Application ID: REF-{memberId}-{submittedAt ?? 0}
          </p>
          <p style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginBottom: 28 }}>
            A staff member will review your application. You will be notified when it has been
            processed.
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: C.sageLight,
              borderRadius: 20,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.sage }} />
            <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.sage }}>
              Under Review
            </span>
          </div>
        </div>
      )}

      {/* Navigation buttons (stages 0-2 only; stage 3 has its own submit) */}
      {stage < 3 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          {stage > 0 ? (
            <button
              data-testid="stage-back"
              onClick={handleBack}
              style={{
                background: 'none',
                border: `1px solid ${C.borderLight}`,
                borderRadius: 10,
                padding: '10px 24px',
                cursor: 'pointer',
                fontFamily: BODY,
                fontSize: 14,
                color: C.textSecondary,
              }}
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            data-testid="continue-button"
            disabled={!canContinue()}
            onClick={handleContinue}
            style={{
              padding: '10px 32px',
              borderRadius: 10,
              border: 'none',
              cursor: canContinue() ? 'pointer' : 'not-allowed',
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              background: canContinue() ? C.sage : C.borderLight,
              color: canContinue() ? '#fff' : C.textTertiary,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            Continue
          </button>
        </div>
      )}

      {/* Back button for stage 3 (acknowledge) */}
      {stage === 3 && (
        <div style={{ marginTop: 12 }}>
          <button
            data-testid="stage-back"
            onClick={handleBack}
            style={{
              background: 'none',
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              padding: '10px 24px',
              cursor: 'pointer',
              fontFamily: BODY,
              fontSize: 14,
              color: C.textSecondary,
            }}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
