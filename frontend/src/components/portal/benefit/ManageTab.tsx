import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { usePayments } from '@/hooks/usePayments';
import DirectDepositForm from './DirectDepositForm';
import TaxWithholdingForm from './TaxWithholdingForm';

// ── Props ───────────────────────────────────────────────────────────────────

interface ManageTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ManageTab({ memberId }: ManageTabProps) {
  const { data: payments } = usePayments(memberId);
  const [letterRequested, setLetterRequested] = useState(false);

  // Get the most recent payment for current bank info
  const latestPayment = payments
    ?.slice()
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];

  return (
    <div data-testid="manage-tab" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* ── Direct Deposit ─────────────────────────────────────────────── */}
      <ManageSection
        title="Direct Deposit"
        description="Update your bank account for benefit payments."
      >
        <DirectDepositForm
          memberId={memberId}
          currentBankLast4={latestPayment?.bank_last_four ?? '----'}
        />
      </ManageSection>

      {/* ── Tax Withholding ────────────────────────────────────────────── */}
      <ManageSection
        title="Tax Withholding"
        description="Adjust federal and state tax withholding from your benefit payments."
      >
        <TaxWithholdingForm memberId={memberId} currentFederalPct={15} currentStatePct={5} />
      </ManageSection>

      {/* ── Benefit Verification Letter ────────────────────────────────── */}
      <ManageSection
        title="Benefit Verification Letter"
        description="Generate an official letter confirming your benefit amount for financial institutions or other agencies."
      >
        <div data-testid="verification-letter-section" style={{ fontFamily: BODY }}>
          {letterRequested ? (
            <div
              data-testid="letter-requested"
              style={{ fontSize: 14, color: C.sage, fontWeight: 600 }}
            >
              Your verification letter is being generated. It will be available for download
              shortly, and a copy will be mailed to your address on file.
            </div>
          ) : (
            <button
              data-testid="request-letter"
              onClick={() => setLetterRequested(true)}
              style={{
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                color: C.cardBg,
                background: C.sage,
                border: 'none',
                borderRadius: 6,
                padding: '10px 20px',
                cursor: 'pointer',
              }}
            >
              Generate Verification Letter
            </button>
          )}
        </div>
      </ManageSection>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ManageSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 12,
        padding: 24,
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
        {title}
      </h3>
      <p
        style={{
          fontFamily: BODY,
          fontSize: 13,
          color: C.textSecondary,
          margin: '0 0 16px',
        }}
      >
        {description}
      </p>
      {children}
    </div>
  );
}
