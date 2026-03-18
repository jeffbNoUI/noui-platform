import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useRefundEstimate } from '@/hooks/useRefundEstimate';
import { formatCurrency } from '../MemberPortalUtils';

interface RefundEstimateData {
  employee_contributions: number;
  interest: number;
  total: number;
  mandatory_withhold_20pct?: number;
  net_after_withhold?: number;
}

export interface RefundEstimateProps {
  memberId: number;
  onStartApplication?: () => void;
  onBack?: () => void;
}

export default function RefundEstimate({
  memberId,
  onStartApplication,
  onBack,
}: RefundEstimateProps) {
  const { data, isLoading, error } = useRefundEstimate(memberId);

  if (isLoading) {
    return (
      <div
        data-testid="refund-estimate"
        style={{
          fontFamily: BODY,
          fontSize: 14,
          color: C.textSecondary,
          textAlign: 'center',
          padding: 48,
        }}
      >
        Loading refund estimate...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        data-testid="refund-estimate"
        style={{ fontFamily: BODY, fontSize: 14, color: C.coral, textAlign: 'center', padding: 48 }}
      >
        Unable to load refund estimate. Please try again later.
      </div>
    );
  }

  // Use backend-provided values (single source of truth for financial calculations)
  const estData = data as RefundEstimateData;
  const withholdingAmount = estData.mandatory_withhold_20pct ?? data.total * 0.2;
  const netAfterWithholding = estData.net_after_withhold ?? data.total * 0.8;
  const rolloverAmount = data.total;

  return (
    <div
      data-testid="refund-estimate"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {/* Back button */}
      {onBack && (
        <button
          data-testid="back-to-dashboard"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: BODY,
            fontSize: 14,
            color: C.sage,
            padding: 0,
            alignSelf: 'flex-start',
          }}
        >
          &larr; Back
        </button>
      )}

      {/* Heading */}
      <div>
        <h1
          style={{
            fontFamily: DISPLAY,
            fontSize: 28,
            color: C.navy,
            margin: 0,
            fontWeight: 600,
          }}
        >
          Refund Estimate
        </h1>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: '8px 0 0',
          }}
        >
          Review your refund amount and tax implications before applying.
        </p>
      </div>

      {/* Amount Summary Card */}
      <div
        data-testid="refund-amount-summary"
        style={{
          background: C.cardBg,
          borderRadius: 12,
          border: `1px solid ${C.borderLight}`,
          padding: 24,
        }}
      >
        {/* Employee Contributions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: BODY,
            fontSize: 14,
            color: C.text,
            marginBottom: 12,
          }}
        >
          <span>Employee Contributions</span>
          <span>{formatCurrency(data.employee_contributions)}</span>
        </div>

        {/* Interest Earned */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: BODY,
            fontSize: 14,
            color: C.text,
            marginBottom: 16,
          }}
        >
          <span>+ Interest Earned</span>
          <span>{formatCurrency(data.interest)}</span>
        </div>

        {/* Separator */}
        <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: 16 }}>
          <div
            data-testid="refund-total"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: 24,
                fontWeight: 700,
                color: C.navy,
              }}
            >
              Total Refundable
            </span>
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: 24,
                fontWeight: 700,
                color: C.navy,
              }}
            >
              {formatCurrency(data.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Tax Comparison Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Federal Withholding Card */}
        <div
          data-testid="tax-withholding"
          style={{
            background: C.cardBg,
            borderRadius: 12,
            border: `1px solid ${C.borderLight}`,
            padding: 24,
          }}
        >
          <div
            style={{
              fontFamily: BODY,
              fontSize: 11,
              fontWeight: 700,
              color: C.textSecondary,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              marginBottom: 16,
            }}
          >
            20% Mandatory Withholding
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 14,
              color: C.text,
              marginBottom: 8,
            }}
          >
            You receive: <strong>{formatCurrency(netAfterWithholding)}</strong>
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 14,
              color: C.text,
              marginBottom: 12,
            }}
          >
            Withheld: <strong>{formatCurrency(withholdingAmount)}</strong>
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 13,
              color: C.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Sent to IRS on your behalf. May owe more or get refund at tax time.
          </div>
        </div>

        {/* IRA Rollover Card */}
        <div
          data-testid="tax-rollover"
          style={{
            background: C.sageLight,
            borderRadius: 12,
            border: `1px solid ${C.sage}`,
            padding: 24,
          }}
        >
          <div
            style={{
              fontFamily: BODY,
              fontSize: 11,
              fontWeight: 700,
              color: C.textSecondary,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              marginBottom: 16,
            }}
          >
            Direct IRA Rollover
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 14,
              color: C.text,
              marginBottom: 8,
            }}
          >
            You receive: <strong>{formatCurrency(rolloverAmount)}</strong>
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 14,
              color: C.text,
              marginBottom: 12,
            }}
          >
            Tax deferred — no immediate tax
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 13,
              color: C.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Rolled into a qualifying IRA or employer plan. No tax until withdrawal.
          </div>
        </div>
      </div>

      {/* Important Notice */}
      <div
        data-testid="refund-warning"
        style={{
          background: C.goldLight,
          borderRadius: 12,
          border: `1px solid ${C.gold}`,
          padding: 24,
          fontFamily: BODY,
          fontSize: 13,
          color: C.text,
          lineHeight: 1.6,
        }}
      >
        <strong>Important:</strong> Requesting a refund permanently forfeits your pension benefit.
        Once processed, this cannot be reversed. If you are vested, you may want to consider keeping
        your deferred benefit instead.
      </div>

      {/* CTA Button */}
      <button
        data-testid="start-refund-button"
        onClick={onStartApplication}
        style={{
          background: C.sage,
          color: '#FFFFFF',
          fontFamily: BODY,
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          borderRadius: 8,
          padding: '12px 32px',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        Start Refund Application
      </button>
    </div>
  );
}
