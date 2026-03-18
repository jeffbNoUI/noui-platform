import { C, BODY } from '@/lib/designSystem';
import WizardStep from '../WizardStep';
import type { WhatIfInputs } from '@/hooks/useWhatIfCalculator';

interface ServicePurchaseStepProps {
  inputs: WhatIfInputs;
  onUpdate: <K extends keyof WhatIfInputs>(key: K, value: WhatIfInputs[K]) => void;
  currentServiceYears?: number;
}

export default function ServicePurchaseStep({
  inputs,
  onUpdate,
  currentServiceYears,
}: ServicePurchaseStepProps) {
  return (
    <WizardStep
      title="Are you planning to purchase service credit?"
      description="Purchased service credit increases your benefit amount but does not count toward eligibility rules (Rule of 75/85)."
      currentValueLabel="Current service"
      currentValue={
        currentServiceYears != null ? `${currentServiceYears.toFixed(1)} years` : undefined
      }
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
          Additional years to purchase
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            data-testid="service-purchase-input"
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={inputs.service_purchase_years}
            onChange={(e) => onUpdate('service_purchase_years', parseFloat(e.target.value))}
            style={{ flex: 1, maxWidth: 280 }}
          />
          <span
            data-testid="service-purchase-value"
            style={{
              fontFamily: BODY,
              fontSize: 16,
              fontWeight: 600,
              color: C.navy,
              minWidth: 60,
            }}
          >
            {inputs.service_purchase_years} yr{inputs.service_purchase_years !== 1 ? 's' : ''}
          </span>
        </div>
        {inputs.service_purchase_years > 0 && (
          <p
            data-testid="service-purchase-note"
            style={{
              fontFamily: BODY,
              fontSize: 13,
              color: C.textSecondary,
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            This adds {inputs.service_purchase_years} year
            {inputs.service_purchase_years !== 1 ? 's' : ''} to your benefit calculation but not to
            eligibility.
          </p>
        )}
      </div>
    </WizardStep>
  );
}
