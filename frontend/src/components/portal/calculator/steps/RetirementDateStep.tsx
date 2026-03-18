import { C, BODY } from '@/lib/designSystem';
import WizardStep from '../WizardStep';
import type { WhatIfInputs } from '@/hooks/useWhatIfCalculator';

interface RetirementDateStepProps {
  inputs: WhatIfInputs;
  onUpdate: <K extends keyof WhatIfInputs>(key: K, value: WhatIfInputs[K]) => void;
  memberDOB?: string;
  memberHireDate?: string;
}

export default function RetirementDateStep({
  inputs,
  onUpdate,
  memberDOB,
  memberHireDate,
}: RetirementDateStepProps) {
  const currentAge = memberDOB ? calculateAge(memberDOB) : undefined;

  return (
    <WizardStep
      title="When would you like to retire?"
      description="Choose a target retirement date. This determines your eligibility type (early or normal) and any benefit reductions."
      currentValueLabel="Your current age"
      currentValue={currentAge != null ? `${currentAge} years old` : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label
          style={{
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
          }}
        >
          Target retirement date
        </label>
        <input
          data-testid="retirement-date-input"
          type="date"
          value={inputs.retirement_date}
          onChange={(e) => onUpdate('retirement_date', e.target.value)}
          min={getMinRetirementDate(memberHireDate)}
          style={{
            fontFamily: BODY,
            fontSize: 15,
            padding: '10px 12px',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: C.text,
            outline: 'none',
            maxWidth: 240,
          }}
        />
      </div>
    </WizardStep>
  );
}

function calculateAge(dob: string): number {
  const normalized = dob.includes('T') ? dob : dob + 'T00:00:00';
  const birth = new Date(normalized);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function getMinRetirementDate(hireDate?: string): string {
  // Minimum: 5 years after hire (vesting)
  if (!hireDate) return '';
  const normalized = hireDate.includes('T') ? hireDate : hireDate + 'T00:00:00';
  const d = new Date(normalized);
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().split('T')[0];
}
