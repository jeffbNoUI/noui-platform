import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { formatCurrency } from '../MemberPortalUtils';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeathBenefitClaim {
  id: string;
  retiree_name: string;
  benefit_amount: number;
  allocation_pct: number;
  claim_status: 'pending' | 'documents_required' | 'under_review' | 'approved' | 'paid';
  payment_method?: 'direct_deposit' | 'check';
  required_documents: DeathBenefitDocument[];
}

interface DeathBenefitDocument {
  id: string;
  label: string;
  status: 'not_submitted' | 'received' | 'approved';
}

// ── Props ───────────────────────────────────────────────────────────────────

interface DeathBenefitViewProps {
  claim: DeathBenefitClaim;
  onSelectPaymentMethod?: (method: 'direct_deposit' | 'check') => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DeathBenefitView({ claim, onSelectPaymentMethod }: DeathBenefitViewProps) {
  const [selectedMethod, setSelectedMethod] = useState<'direct_deposit' | 'check' | null>(
    claim.payment_method ?? null,
  );

  function handleMethodSelect(method: 'direct_deposit' | 'check') {
    setSelectedMethod(method);
    onSelectPaymentMethod?.(method);
  }

  return (
    <div
      data-testid="death-benefit-view"
      style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: BODY }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 24,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 4px',
          }}
        >
          Lump Sum Death Benefit
        </h2>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
          Following the passing of {claim.retiree_name}
        </p>
      </div>

      {/* ── Benefit Amount ────────────────────────────────────────────── */}
      <div
        data-testid="benefit-amount"
        style={{
          background: C.cardBgWarm,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: C.textTertiary,
              marginBottom: 4,
            }}
          >
            Benefit Amount
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, color: C.navy }}>
            {formatCurrency(claim.benefit_amount)}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: C.textTertiary,
              marginBottom: 4,
            }}
          >
            Your Allocation
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>
            {claim.allocation_pct}%
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: C.textTertiary,
              marginBottom: 4,
            }}
          >
            Your Amount
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: C.sage }}>
            {formatCurrency(Math.round(claim.benefit_amount * (claim.allocation_pct / 100)))}
          </div>
        </div>
      </div>

      {/* ── Claim Status ──────────────────────────────────────────────── */}
      <div
        data-testid="claim-status"
        style={{
          background: C.cardBg,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background:
              claim.claim_status === 'paid'
                ? C.sage
                : claim.claim_status === 'approved'
                  ? C.sky
                  : C.gold,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>
          {claim.claim_status.replace('_', ' ')}
        </span>
      </div>

      {/* ── Required Documents ────────────────────────────────────────── */}
      <div data-testid="death-benefit-documents">
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 12px',
          }}
        >
          Required Documents
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {claim.required_documents.map((doc) => (
            <div
              key={doc.id}
              data-testid={`death-doc-${doc.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                background: C.cardBg,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 14, color: C.text }}>{doc.label}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: doc.status === 'approved' ? C.sage : C.textTertiary,
                  textTransform: 'capitalize',
                }}
              >
                {doc.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Payment Method Selection ──────────────────────────────────── */}
      {claim.claim_status !== 'paid' && (
        <div data-testid="payment-method-section">
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 18,
              fontWeight: 600,
              color: C.navy,
              margin: '0 0 12px',
            }}
          >
            Payment Method
          </h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <PaymentOption
              label="Direct Deposit"
              description="Fastest — deposited within 5 business days"
              selected={selectedMethod === 'direct_deposit'}
              onClick={() => handleMethodSelect('direct_deposit')}
              testId="method-direct-deposit"
            />
            <PaymentOption
              label="Check by Mail"
              description="Mailed within 10 business days"
              selected={selectedMethod === 'check'}
              onClick={() => handleMethodSelect('check')}
              testId="method-check"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PaymentOption({
  label,
  description,
  selected,
  onClick,
  testId,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        flex: 1,
        padding: 16,
        background: selected ? C.sageLight : C.cardBg,
        border: `2px solid ${selected ? C.sage : C.borderLight}`,
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: BODY,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.textSecondary }}>{description}</div>
    </button>
  );
}
