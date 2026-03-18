import { C, BODY } from '@/lib/designSystem';
import { formatCurrency } from '@/components/portal/MemberPortalUtils';
import { STAGE_LABELS } from '@/lib/applicationStateMachine';
import type {
  Acknowledgment,
  PaymentSelection,
  RetirementApplicationState,
} from '@/types/RetirementApplication';

interface ReviewSubmitStageProps {
  application: RetirementApplicationState;
  acknowledgments: Acknowledgment[];
  onAcknowledgmentChange: (id: string, checked: boolean) => void;
  onSubmit: () => void;
  submitting?: boolean;
}

export default function ReviewSubmitStage({
  application,
  acknowledgments,
  onAcknowledgmentChange,
  onSubmit,
  submitting,
}: ReviewSubmitStageProps) {
  const allAcknowledged = acknowledgments.every((a) => a.checked);

  return (
    <div data-testid="review-submit-stage">
      {/* Stage header */}
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
          Review &amp; Submit
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          Review your selections below. Once submitted, a retirement specialist will process your
          application.
        </p>
      </div>

      {/* Summary sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Retirement date */}
        {application.retirement_date && (
          <SummaryCard
            testId="summary-retirement-date"
            label="Retirement Date"
            value={new Date(application.retirement_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        )}

        {/* Verification summary */}
        <SummaryCard
          testId="summary-verification"
          label={STAGE_LABELS.verify_info}
          value={`${application.verification_items.filter((i) => i.verified === true).length} items confirmed`}
          detail={
            application.verification_items.some((i) => i.verified === false)
              ? `${application.verification_items.filter((i) => i.verified === false).length} items flagged for review`
              : undefined
          }
        />

        {/* Documents summary */}
        <SummaryCard
          testId="summary-documents"
          label={STAGE_LABELS.upload_docs}
          value={`${application.required_documents.filter((d) => d.uploaded).length} of ${application.required_documents.length} documents uploaded`}
        />

        {/* Benefit estimate summary */}
        {application.benefit_estimate && (
          <SummaryCard
            testId="summary-benefit"
            label={STAGE_LABELS.benefit_estimate}
            value={`${formatCurrency(application.benefit_estimate.monthly_benefit)}/month`}
            detail={`${application.benefit_estimate.eligibility_type === 'EARLY' ? 'Early' : 'Normal'} retirement \u2022 ${application.benefit_estimate.service_years} years service`}
          />
        )}

        {/* Payment option summary */}
        {application.payment_selection && (
          <PaymentSummary selection={application.payment_selection} />
        )}
      </div>

      {/* Acknowledgment checkboxes */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: C.cardBgWarm,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
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
            marginBottom: 12,
          }}
        >
          Acknowledgments
        </div>

        {acknowledgments.map((ack) => (
          <label
            key={ack.id}
            data-testid={`ack-${ack.id}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 12,
              cursor: 'pointer',
              fontFamily: BODY,
              fontSize: 14,
              color: C.text,
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={ack.checked}
              onChange={(e) => onAcknowledgmentChange(ack.id, e.target.checked)}
              data-testid={`checkbox-${ack.id}`}
              style={{
                marginTop: 3,
                width: 18,
                height: 18,
                accentColor: C.sage,
                flexShrink: 0,
              }}
            />
            {ack.label}
          </label>
        ))}
      </div>

      {/* Submit button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 24,
          padding: '16px 0',
          borderTop: `1px solid ${C.borderLight}`,
        }}
      >
        <button
          data-testid="submit-button"
          onClick={onSubmit}
          disabled={!allAcknowledged || submitting}
          style={{
            fontFamily: BODY,
            fontSize: 16,
            fontWeight: 700,
            padding: '12px 36px',
            borderRadius: 8,
            border: 'none',
            background: allAcknowledged && !submitting ? C.sage : C.borderLight,
            color: allAcknowledged && !submitting ? '#FFFFFF' : C.textTertiary,
            cursor: allAcknowledged && !submitting ? 'pointer' : 'default',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  testId,
  label,
  value,
  detail,
}: {
  testId: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          fontFamily: BODY,
          fontSize: 12,
          fontWeight: 600,
          color: C.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: BODY, fontSize: 15, fontWeight: 600, color: C.navy }}>{value}</div>
      {detail && (
        <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function PaymentSummary({ selection }: { selection: PaymentSelection }) {
  return (
    <div
      data-testid="summary-payment"
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          fontFamily: BODY,
          fontSize: 12,
          fontWeight: 600,
          color: C.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        Payment Option
      </div>
      <div style={{ fontFamily: BODY, fontSize: 15, fontWeight: 600, color: C.navy }}>
        {selection.option_label}
      </div>
      <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
        {formatCurrency(selection.member_amount)}/month
        {selection.survivor_amount > 0 &&
          ` \u2022 Survivor: ${formatCurrency(selection.survivor_amount)}/month`}
      </div>
    </div>
  );
}
