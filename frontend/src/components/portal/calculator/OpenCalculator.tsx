import { C } from '@/lib/designSystem';
import type { WhatIfInputs, WhatIfResult } from '@/hooks/useWhatIfCalculator';
import type { ScenarioEntry } from '@/types/BenefitCalculation';
import CalculatorInputPanel from './CalculatorInputPanel';
import CalculatorResultPanel from './CalculatorResultPanel';

interface OpenCalculatorProps {
  inputs: WhatIfInputs;
  onUpdate: <K extends keyof WhatIfInputs>(key: K, value: WhatIfInputs[K]) => void;
  result: WhatIfResult | null;
  isLoading: boolean;
  isError: boolean;
  memberDOB?: string;
  memberHireDate?: string;
  currentServiceYears?: number;
  currentSalary?: number;
  waitScenarios?: ScenarioEntry[];
}

export default function OpenCalculator({
  inputs,
  onUpdate,
  result,
  isLoading,
  isError,
  memberDOB,
  memberHireDate,
  currentServiceYears,
  currentSalary,
  waitScenarios,
}: OpenCalculatorProps) {
  return (
    <div
      data-testid="open-calculator"
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 24,
        alignItems: 'start',
      }}
    >
      {/* Left: inputs */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 12,
          border: `1px solid ${C.borderLight}`,
          padding: 20,
        }}
      >
        <CalculatorInputPanel
          inputs={inputs}
          onUpdate={onUpdate}
          memberDOB={memberDOB}
          memberHireDate={memberHireDate}
          currentServiceYears={currentServiceYears}
          currentSalary={currentSalary}
        />
      </div>

      {/* Right: results */}
      <div>
        <CalculatorResultPanel
          result={result}
          isLoading={isLoading}
          isError={isError}
          waitScenarios={waitScenarios}
          selectedDate={inputs.retirement_date}
        />
      </div>
    </div>
  );
}
