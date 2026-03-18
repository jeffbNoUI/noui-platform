import { C, BODY, DISPLAY } from '@/lib/designSystem';
import WizardStep from '../WizardStep';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';
import { formatCurrency } from '../../MemberPortalUtils';

interface ResultsStepProps {
  result: WhatIfResult | null;
  isLoading: boolean;
}

export default function ResultsStep({ result, isLoading }: ResultsStepProps) {
  if (isLoading) {
    return (
      <WizardStep
        title="Calculating Your Estimate"
        description="Running your scenario through the rules engine..."
      >
        <div
          data-testid="results-loading"
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            padding: 32,
            textAlign: 'center',
          }}
        >
          Calculating...
        </div>
      </WizardStep>
    );
  }

  if (!result) {
    return (
      <WizardStep
        title="Your Estimate"
        description="Complete the previous steps to see your estimate."
      >
        <div
          data-testid="results-empty"
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            padding: 32,
            textAlign: 'center',
          }}
        >
          No results yet
        </div>
      </WizardStep>
    );
  }

  const isIneligible = result.eligibility_type === 'INELIGIBLE';

  return (
    <WizardStep
      title="Your Estimated Benefit"
      description="This estimate is based on current plan provisions and your inputs."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Hero benefit amount */}
        <div
          data-testid="results-hero"
          style={{
            background: isIneligible ? C.coralLight : C.sageLight,
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          {isIneligible ? (
            <>
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 24,
                  fontWeight: 700,
                  color: C.coral,
                }}
              >
                Not Yet Eligible
              </div>
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 14,
                  color: C.textSecondary,
                  marginTop: 6,
                }}
              >
                You do not meet eligibility requirements at the selected date.
              </div>
            </>
          ) : (
            <>
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
                Estimated monthly benefit
              </div>
              <div
                data-testid="results-monthly-benefit"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 36,
                  fontWeight: 700,
                  color: C.sage,
                }}
              >
                {formatCurrency(result.monthly_benefit)}
              </div>
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 13,
                  color: C.textSecondary,
                  marginTop: 4,
                }}
              >
                {result.eligibility_type === 'EARLY' ? 'Early Retirement' : 'Normal Retirement'}
                {result.reduction_detail.applies && ` (${result.reduction_pct}% reduction)`}
              </div>
            </>
          )}
        </div>

        {/* Formula breakdown */}
        {!isIneligible && (
          <div
            data-testid="results-formula"
            style={{
              background: C.cardBg,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              padding: 16,
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
                marginBottom: 10,
              }}
            >
              How it&apos;s calculated
            </div>
            <div style={{ fontFamily: BODY, fontSize: 14, color: C.text, lineHeight: 1.8 }}>
              <div>
                AMS: <strong>{formatCurrency(result.ams)}</strong>/month
              </div>
              <div>
                Formula: <strong>{result.formula_display}</strong>
              </div>
              <div>
                Base benefit: <strong>{formatCurrency(result.base_benefit)}</strong>/month
              </div>
              {result.reduction_detail.applies && (
                <div>
                  Reduction: {result.reduction_detail.rate_per_year * 100}% x{' '}
                  {result.reduction_detail.years_under_65} yrs ={' '}
                  <strong>{result.reduction_pct}%</strong>
                </div>
              )}
              <div>
                Service: <strong>{result.service_years} years</strong>
              </div>
            </div>
          </div>
        )}

        {/* Payment options summary */}
        {!isIneligible && result.payment_options.length > 0 && (
          <div
            data-testid="results-payment-options"
            style={{
              background: C.cardBg,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              padding: 16,
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
                marginBottom: 10,
              }}
            >
              Payment options
            </div>
            {result.payment_options.map((opt) => (
              <div
                key={opt.option_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  fontFamily: BODY,
                  fontSize: 14,
                  color: C.text,
                  borderBottom: `1px solid ${C.borderLight}`,
                }}
              >
                <span>{formatOptionLabel(opt.option_id)}</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(opt.member_amount)}/mo</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WizardStep>
  );
}

function formatOptionLabel(id: string): string {
  switch (id) {
    case 'maximum':
      return 'Maximum (Single Life)';
    case 'js_100':
      return 'Joint & 100% Survivor';
    case 'js_75':
      return 'Joint & 75% Survivor';
    case 'js_50':
      return 'Joint & 50% Survivor';
    default:
      return id;
  }
}
