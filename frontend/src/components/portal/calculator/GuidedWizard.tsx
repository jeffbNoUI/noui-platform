import { useState, useCallback } from 'react';
import { C, BODY } from '@/lib/designSystem';
import type { WhatIfInputs, WhatIfResult } from '@/hooks/useWhatIfCalculator';
import RetirementDateStep from './steps/RetirementDateStep';
import ServicePurchaseStep from './steps/ServicePurchaseStep';
import SalaryGrowthStep from './steps/SalaryGrowthStep';
import PaymentOptionStep from './steps/PaymentOptionStep';
import ResultsStep from './steps/ResultsStep';

// ── Types ───────────────────────────────────────────────────────────────────

export interface GuidedWizardProps {
  inputs: WhatIfInputs;
  onUpdate: <K extends keyof WhatIfInputs>(key: K, value: WhatIfInputs[K]) => void;
  onCalculate: () => void;
  result: WhatIfResult | null;
  isLoading: boolean;
  memberDOB?: string;
  memberHireDate?: string;
  currentServiceYears?: number;
  currentSalary?: number;
  onSaveScenario?: () => void;
}

// ── Step definitions ────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Retirement Date',
  'Service Purchase',
  'Salary Growth',
  'Payment Option',
  'Results',
];

// ── Component ───────────────────────────────────────────────────────────────

export default function GuidedWizard({
  inputs,
  onUpdate,
  onCalculate,
  result,
  isLoading,
  memberDOB,
  memberHireDate,
  currentServiceYears,
  currentSalary,
  onSaveScenario,
}: GuidedWizardProps) {
  const [step, setStep] = useState(0);
  const totalSteps = STEP_LABELS.length;
  const isFirstStep = step === 0;
  const isLastStep = step === totalSteps - 1;
  const isResultsStep = step === totalSteps - 1;

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 0:
        return inputs.retirement_date.length > 0;
      default:
        return true;
    }
  }, [step, inputs.retirement_date]);

  const handleNext = () => {
    if (step === totalSteps - 2) {
      // Moving to results — trigger calculation
      onCalculate();
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  return (
    <div data-testid="guided-wizard">
      {/* Progress bar */}
      <div data-testid="wizard-progress" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              data-testid={`wizard-progress-step-${i}`}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? C.sage : C.borderLight,
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: BODY,
            fontSize: 12,
            color: C.textTertiary,
          }}
        >
          Step {step + 1} of {totalSteps} — {STEP_LABELS[step]}
        </div>
      </div>

      {/* Step content */}
      <div style={{ minHeight: 240 }}>
        {step === 0 && (
          <RetirementDateStep
            inputs={inputs}
            onUpdate={onUpdate}
            memberDOB={memberDOB}
            memberHireDate={memberHireDate}
          />
        )}
        {step === 1 && (
          <ServicePurchaseStep
            inputs={inputs}
            onUpdate={onUpdate}
            currentServiceYears={currentServiceYears}
          />
        )}
        {step === 2 && (
          <SalaryGrowthStep inputs={inputs} onUpdate={onUpdate} currentSalary={currentSalary} />
        )}
        {step === 3 && <PaymentOptionStep inputs={inputs} onUpdate={onUpdate} />}
        {step === 4 && <ResultsStep result={result} isLoading={isLoading} />}
      </div>

      {/* Navigation buttons */}
      <div
        data-testid="wizard-nav"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 28,
          paddingTop: 20,
          borderTop: `1px solid ${C.borderLight}`,
        }}
      >
        <button
          data-testid="wizard-back"
          onClick={handleBack}
          disabled={isFirstStep}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: isFirstStep ? C.textTertiary : C.navy,
            cursor: isFirstStep ? 'default' : 'pointer',
            opacity: isFirstStep ? 0.5 : 1,
          }}
        >
          Back
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          {isResultsStep && result && onSaveScenario && (
            <button
              data-testid="wizard-save"
              onClick={onSaveScenario}
              style={{
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                padding: '10px 20px',
                borderRadius: 8,
                border: `1px solid ${C.sage}`,
                background: 'transparent',
                color: C.sage,
                cursor: 'pointer',
              }}
            >
              Save Scenario
            </button>
          )}

          {!isLastStep && (
            <button
              data-testid="wizard-next"
              onClick={handleNext}
              disabled={!canProceed()}
              style={{
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: canProceed() ? C.sage : C.borderLight,
                color: canProceed() ? '#fff' : C.textTertiary,
                cursor: canProceed() ? 'pointer' : 'default',
              }}
            >
              Next
            </button>
          )}

          {isResultsStep && (
            <button
              data-testid="wizard-restart"
              onClick={() => setStep(0)}
              style={{
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: C.navy,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Start Over
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
