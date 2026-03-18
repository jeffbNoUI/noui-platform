import { C, DISPLAY, BODY } from '@/lib/designSystem';
import { formatCurrency } from '../MemberPortalUtils';
import type { RefundEstimate } from '@/hooks/useRefundEstimate';

export interface OptionsComparisonProps {
  isVested: boolean;
  deferredMonthly?: number;
  refundEstimate?: RefundEstimate | null;
  isLoading?: boolean;
  onNavigate?: (section: string) => void;
}

export default function OptionsComparison({
  isVested,
  deferredMonthly,
  refundEstimate,
  isLoading,
  onNavigate,
}: OptionsComparisonProps) {
  return (
    <div
      data-testid="options-comparison"
      data-tour-id="options-comparison"
      style={{
        display: 'grid',
        gridTemplateColumns: isVested ? '1fr 1fr' : '1fr',
        gap: 20,
      }}
    >
      {/* Deferred benefit option — only for vested members */}
      {isVested && (
        <div
          data-testid="deferred-option"
          style={{
            background: C.cardBg,
            borderRadius: 12,
            border: `2px solid ${C.sage}`,
            padding: '24px 28px',
          }}
        >
          <div
            style={{
              fontFamily: BODY,
              fontSize: 11,
              fontWeight: 600,
              color: C.sage,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Option A — Deferred Benefit
          </div>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 28,
              fontWeight: 700,
              color: C.navy,
              lineHeight: 1.1,
            }}
          >
            {deferredMonthly ? formatCurrency(deferredMonthly) : '—'}
            <span
              style={{ fontFamily: BODY, fontSize: 14, fontWeight: 400, color: C.textSecondary }}
            >
              /mo at 65
            </span>
          </div>
          <p
            style={{
              fontFamily: BODY,
              fontSize: 13,
              color: C.textSecondary,
              margin: '12px 0 16px',
              lineHeight: 1.5,
            }}
          >
            Keep your contributions in the plan and receive a monthly pension at retirement age.
            Your benefit is calculated using your service years and salary at separation.
          </p>
          <button
            onClick={() => onNavigate?.('projections')}
            style={{
              background: C.sage,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 20px',
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View Projection
          </button>
        </div>
      )}

      {/* Refund option */}
      <div
        data-testid="refund-option"
        style={{
          background: C.cardBg,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          padding: '24px 28px',
        }}
      >
        <div
          style={{
            fontFamily: BODY,
            fontSize: 11,
            fontWeight: 600,
            color: C.gold,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          {isVested ? 'Option B — Refund' : 'Your Option — Refund'}
        </div>

        {isLoading ? (
          <div style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>
            Calculating refund estimate...
          </div>
        ) : refundEstimate ? (
          <>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 28,
                fontWeight: 700,
                color: C.navy,
                lineHeight: 1.1,
              }}
            >
              {formatCurrency(refundEstimate.total)}
              <span
                style={{ fontFamily: BODY, fontSize: 14, fontWeight: 400, color: C.textSecondary }}
              >
                {' '}
                lump sum
              </span>
            </div>
            <div
              style={{
                fontFamily: BODY,
                fontSize: 12,
                color: C.textSecondary,
                marginTop: 8,
              }}
            >
              Contributions: {formatCurrency(refundEstimate.employee_contributions)} + Interest:{' '}
              {formatCurrency(refundEstimate.interest)}
            </div>
          </>
        ) : (
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 28,
              fontWeight: 700,
              color: C.navy,
              lineHeight: 1.1,
            }}
          >
            —
          </div>
        )}

        <p
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.textSecondary,
            margin: '12px 0 16px',
            lineHeight: 1.5,
          }}
        >
          {isVested
            ? 'Withdraw your employee contributions plus interest. You forfeit the employer match and future pension benefit.'
            : 'Since you have fewer than 5 years of service, you are not vested. You may withdraw your employee contributions plus interest.'}
        </p>

        <button
          onClick={() => onNavigate?.('refund')}
          style={{
            background: isVested ? C.cardBgWarm : C.gold,
            color: isVested ? C.navy : '#fff',
            border: isVested ? `1px solid ${C.border}` : 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isVested ? 'Learn More' : 'Start Refund Application'}
        </button>
      </div>
    </div>
  );
}
