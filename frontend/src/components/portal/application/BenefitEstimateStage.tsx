import { C, BODY } from '@/lib/designSystem';
import FormulaBreakdown from '@/components/portal/calculator/FormulaBreakdown';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';

interface BenefitEstimateStageProps {
  result: WhatIfResult | null;
  loading?: boolean;
  onConfirm: () => void;
  onDispute: (reason: string) => void;
  bounceMessage?: string;
}

export default function BenefitEstimateStage({
  result,
  loading,
  onConfirm,
  onDispute,
  bounceMessage,
}: BenefitEstimateStageProps) {
  return (
    <div data-testid="benefit-estimate-stage">
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
          Review Benefit Estimate
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          This estimate is based on your verified information. Please review it carefully.
        </p>
      </div>

      {/* Bounce message */}
      {bounceMessage && (
        <div
          data-testid="bounce-message"
          style={{
            background: C.coralLight,
            border: `1px solid ${C.coral}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            fontFamily: BODY,
            fontSize: 14,
            color: C.coral,
          }}
        >
          <strong>Action needed:</strong> {bounceMessage}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          data-testid="loading-indicator"
          style={{
            padding: 40,
            textAlign: 'center',
            fontFamily: BODY,
            fontSize: 15,
            color: C.textSecondary,
          }}
        >
          Calculating your benefit estimate...
        </div>
      )}

      {/* Benefit result */}
      {result && !loading && (
        <div>
          {/* Formula breakdown (reused from calculator) */}
          <FormulaBreakdown result={result} />

          {/* Eligibility note */}
          {result.eligibility_type === 'EARLY' && (
            <div
              data-testid="early-retirement-note"
              style={{
                background: C.goldLight,
                border: `1px solid ${C.gold}`,
                borderRadius: 8,
                padding: '12px 16px',
                marginTop: 16,
                fontFamily: BODY,
                fontSize: 14,
                color: C.gold,
              }}
            >
              <strong>Early Retirement:</strong> Your benefit includes a {result.reduction_pct}%
              reduction because your retirement date is before age 65.
            </div>
          )}

          {/* Confirmation actions */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 24,
              padding: '16px 0',
              borderTop: `1px solid ${C.borderLight}`,
            }}
          >
            <button
              data-testid="confirm-button"
              onClick={onConfirm}
              style={{
                fontFamily: BODY,
                fontSize: 15,
                fontWeight: 700,
                padding: '10px 28px',
                borderRadius: 8,
                border: 'none',
                background: C.sage,
                color: '#FFFFFF',
                cursor: 'pointer',
                flex: 1,
              }}
            >
              Looks Correct
            </button>
            <button
              data-testid="dispute-button"
              onClick={() => onDispute('Member flagged estimate for review')}
              style={{
                fontFamily: BODY,
                fontSize: 15,
                fontWeight: 700,
                padding: '10px 28px',
                borderRadius: 8,
                border: `2px solid ${C.coral}`,
                background: 'transparent',
                color: C.coral,
                cursor: 'pointer',
                flex: 1,
              }}
            >
              Something Seems Wrong
            </button>
          </div>
        </div>
      )}

      {/* No result state */}
      {!result && !loading && (
        <div
          data-testid="no-estimate"
          style={{
            padding: 40,
            textAlign: 'center',
            fontFamily: BODY,
            fontSize: 15,
            color: C.textTertiary,
            background: C.cardBg,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 10,
          }}
        >
          Unable to generate benefit estimate. Please ensure your information has been verified.
        </div>
      )}
    </div>
  );
}
