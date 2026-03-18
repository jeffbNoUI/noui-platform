import { C, BODY } from '@/lib/designSystem';
import WizardStep from '../WizardStep';
import type { WhatIfInputs } from '@/hooks/useWhatIfCalculator';
import { formatCurrency } from '../../MemberPortalUtils';

interface SalaryGrowthStepProps {
  inputs: WhatIfInputs;
  onUpdate: <K extends keyof WhatIfInputs>(key: K, value: WhatIfInputs[K]) => void;
  currentSalary?: number;
}

const GROWTH_OPTIONS = [
  { value: 0, label: '0% — No raises' },
  { value: 2, label: '2% — Conservative' },
  { value: 3, label: '3% — Typical' },
  { value: 4, label: '4% — Above average' },
  { value: 5, label: '5% — Optimistic' },
];

export default function SalaryGrowthStep({
  inputs,
  onUpdate,
  currentSalary,
}: SalaryGrowthStepProps) {
  return (
    <WizardStep
      title="What salary growth do you expect?"
      description="Your Average Monthly Salary (AMS) is based on your highest consecutive months. Future raises affect your projected AMS."
      currentValueLabel="Current monthly salary"
      currentValue={currentSalary != null ? formatCurrency(currentSalary) : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {GROWTH_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            data-testid={`salary-growth-option-${opt.value}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${inputs.salary_growth_pct === opt.value ? C.sage : C.borderLight}`,
              background: inputs.salary_growth_pct === opt.value ? C.sageLight : C.cardBg,
              cursor: 'pointer',
              fontFamily: BODY,
              fontSize: 14,
              color: C.text,
              transition: 'all 0.15s',
            }}
          >
            <input
              type="radio"
              name="salary-growth"
              value={opt.value}
              checked={inputs.salary_growth_pct === opt.value}
              onChange={() => onUpdate('salary_growth_pct', opt.value)}
              style={{ accentColor: C.sage }}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </WizardStep>
  );
}
