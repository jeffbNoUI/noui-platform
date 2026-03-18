import { C, BODY } from '@/lib/designSystem';
import WizardStep from '../WizardStep';
import type { WhatIfInputs } from '@/hooks/useWhatIfCalculator';
import { getPlanProfile } from '@/lib/planProfile';

interface PaymentOptionStepProps {
  inputs: WhatIfInputs;
  onUpdate: <K extends keyof WhatIfInputs>(key: K, value: WhatIfInputs[K]) => void;
}

export default function PaymentOptionStep({ inputs, onUpdate }: PaymentOptionStepProps) {
  const profile = getPlanProfile();
  const options = profile.benefit_structure.payment_options;

  return (
    <WizardStep
      title="Which payment option are you considering?"
      description="Joint & Survivor options provide income to a beneficiary after your death, but reduce your monthly benefit."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((opt) => (
          <label
            key={opt.id}
            data-testid={`payment-option-${opt.id}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 8,
              border: `1px solid ${inputs.payment_option === opt.id ? C.sage : C.borderLight}`,
              background: inputs.payment_option === opt.id ? C.sageLight : C.cardBg,
              cursor: 'pointer',
              fontFamily: BODY,
              transition: 'all 0.15s',
            }}
          >
            <input
              type="radio"
              name="payment-option"
              value={opt.id}
              checked={inputs.payment_option === opt.id}
              onChange={() => onUpdate('payment_option', opt.id)}
              style={{ accentColor: C.sage, marginTop: 2 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{opt.label}</div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                {opt.description}
              </div>
            </div>
          </label>
        ))}

        {/* Beneficiary DOB for J&S options */}
        {inputs.payment_option.startsWith('js_') && (
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Beneficiary date of birth
            </label>
            <input
              data-testid="beneficiary-dob-input"
              type="date"
              value={inputs.beneficiary_dob ?? ''}
              onChange={(e) => onUpdate('beneficiary_dob', e.target.value || undefined)}
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
        )}
      </div>
    </WizardStep>
  );
}
