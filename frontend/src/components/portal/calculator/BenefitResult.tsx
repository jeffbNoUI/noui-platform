import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';
import type { ScenarioEntry } from '@/types/BenefitCalculation';
import { formatCurrency } from '../MemberPortalUtils';
import FormulaBreakdown from './FormulaBreakdown';
import WaitComparison from './WaitComparison';
import PaymentOptionTable from './PaymentOptionTable';

interface BenefitResultProps {
  result: WhatIfResult;
  waitScenarios?: ScenarioEntry[];
  selectedDate?: string;
  onSelectPaymentOption?: (optionId: string) => void;
}

export default function BenefitResult({
  result,
  waitScenarios,
  selectedDate,
  onSelectPaymentOption,
}: BenefitResultProps) {
  const isIneligible = result.eligibility_type === 'INELIGIBLE';

  return (
    <div data-testid="benefit-result" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero card */}
      <div
        data-testid="benefit-result-hero"
        style={{
          background: isIneligible ? C.coralLight : C.sageLight,
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
        }}
      >
        {isIneligible ? (
          <>
            <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 700, color: C.coral }}>
              Not Yet Eligible
            </div>
            <div style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary, marginTop: 6 }}>
              You do not meet eligibility requirements at the selected retirement date.
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
              data-testid="benefit-result-amount"
              style={{ fontFamily: DISPLAY, fontSize: 36, fontWeight: 700, color: C.sage }}
            >
              {formatCurrency(result.monthly_benefit)}
            </div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
              {result.eligibility_type === 'EARLY' ? 'Early Retirement' : 'Normal Retirement'}
              {result.reduction_detail.applies && ` (${result.reduction_pct}% reduction)`}
            </div>
          </>
        )}
      </div>

      {/* Formula breakdown */}
      {!isIneligible && <FormulaBreakdown result={result} />}

      {/* Wait comparison */}
      {waitScenarios && waitScenarios.length > 0 && (
        <WaitComparison scenarios={waitScenarios} selectedDate={selectedDate} />
      )}

      {/* Payment options */}
      {!isIneligible && result.payment_options.length > 0 && (
        <PaymentOptionTable
          options={result.payment_options}
          selectedOption={result.payment_options[0]?.option_id}
          onSelect={onSelectPaymentOption}
        />
      )}

      {/* Disclaimer */}
      <div
        data-testid="benefit-result-disclaimer"
        style={{
          fontFamily: BODY,
          fontSize: 12,
          color: C.textTertiary,
          padding: '12px 16px',
          background: C.cardBgWarm,
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
          lineHeight: 1.5,
        }}
      >
        This is an estimate based on current plan provisions and the information you provided.
        Actual benefits will be determined by the rules engine using certified plan provisions at
        the time of your application.
      </div>
    </div>
  );
}
