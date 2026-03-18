import { C, BODY } from '@/lib/designSystem';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';
import BenefitResult from './BenefitResult';
import type { ScenarioEntry } from '@/types/BenefitCalculation';

interface CalculatorResultPanelProps {
  result: WhatIfResult | null;
  isLoading: boolean;
  isError: boolean;
  waitScenarios?: ScenarioEntry[];
  selectedDate?: string;
}

export default function CalculatorResultPanel({
  result,
  isLoading,
  isError,
  waitScenarios,
  selectedDate,
}: CalculatorResultPanelProps) {
  if (isLoading) {
    return (
      <div
        data-testid="calculator-result-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          fontFamily: BODY,
          fontSize: 14,
          color: C.textSecondary,
        }}
      >
        Calculating your estimate...
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-testid="calculator-result-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          fontFamily: BODY,
          fontSize: 14,
          color: C.coral,
          padding: 24,
          textAlign: 'center',
        }}
      >
        Unable to calculate estimate. Please check your inputs and try again.
      </div>
    );
  }

  if (!result) {
    return (
      <div
        data-testid="calculator-result-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          fontFamily: BODY,
          fontSize: 14,
          color: C.textTertiary,
          padding: 24,
          textAlign: 'center',
        }}
      >
        Select a retirement date to see your estimated benefit.
      </div>
    );
  }

  return (
    <div data-testid="calculator-result-panel">
      <BenefitResult result={result} waitScenarios={waitScenarios} selectedDate={selectedDate} />
    </div>
  );
}
