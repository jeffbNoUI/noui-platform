import { useState, useCallback } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useWhatIfCalculator } from '@/hooks/useWhatIfCalculator';
import { useMember } from '@/hooks/useMember';
import { useSavedScenarios } from '@/hooks/useSavedScenarios';
import { DEMO_MEMBER, formatCurrency } from '../MemberPortalUtils';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeferredBenefitExplorerProps {
  memberId: number;
  onBack?: () => void;
}

// ── Step definitions ────────────────────────────────────────────────────────

const STEP_LABELS = ['Retirement Date', 'Service Purchase', 'Payment Option', 'Results'];

// ── Component ───────────────────────────────────────────────────────────────

export default function DeferredBenefitExplorer({
  memberId,
  onBack,
}: DeferredBenefitExplorerProps) {
  const [step, setStep] = useState(0);
  const totalSteps = STEP_LABELS.length;
  const isFirstStep = step === 0;
  const isLastStep = step === totalSteps - 1;
  const isResultsStep = step === totalSteps - 1;

  // Data hooks
  const { data: memberData, isLoading: memberLoading } = useMember(memberId);
  const {
    inputs,
    updateInput,
    calculateNow,
    result,
    isLoading: calcLoading,
    toScenario,
  } = useWhatIfCalculator(memberId, { salary_growth_pct: 0 });
  const { save: saveScenario } = useSavedScenarios(memberId);

  // Effective member: real data or fallback
  // The member record may have extended fields (current_salary, earned_service_years)
  // that aren't in the base Member type, so we access them via an untyped handle.
  const memberAny = memberData as unknown as Record<string, unknown> | undefined;
  const effectiveMember = memberData
    ? {
        member_id: memberData.member_id,
        first_name: memberData.first_name,
        last_name: memberData.last_name,
        dob: memberData.dob,
        hire_date: memberData.hire_date,
        current_salary: (memberAny?.current_salary as number | undefined) ?? 72000,
        earned_service_years: (memberAny?.earned_service_years as number | undefined) ?? 12.5,
        tier: memberData.tier_code ?? (memberAny?.tier as number | undefined) ?? 2,
      }
    : {
        member_id: DEMO_MEMBER.member_id,
        first_name: DEMO_MEMBER.first_name,
        last_name: DEMO_MEMBER.last_name,
        dob: DEMO_MEMBER.dob,
        hire_date: DEMO_MEMBER.hire_date,
        current_salary: 72000,
        earned_service_years: 12.5,
        tier: DEMO_MEMBER.tier_code,
      };

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
      calculateNow();
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSave = () => {
    const scenario = toScenario();
    if (!scenario) return;
    const label = window.prompt('Name this scenario:', 'Deferred benefit scenario');
    if (!label) return;
    saveScenario({
      label,
      inputs: scenario.inputs,
      results: scenario.results,
      dataVersion: new Date().toISOString(),
    });
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (memberLoading) {
    return (
      <div data-testid="deferred-benefit-explorer">
        <p style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>
          Loading member data...
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div data-testid="deferred-benefit-explorer">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          {onBack && (
            <button
              data-testid="back-to-dashboard"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: BODY,
                fontSize: 14,
                color: C.sage,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              &larr; Back
            </button>
          )}
          <h2
            style={{
              fontFamily: DISPLAY,
              fontSize: 28,
              fontWeight: 700,
              color: C.navy,
              margin: 0,
            }}
          >
            Deferred Benefit Explorer
          </h2>
        </div>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.textSecondary,
            margin: 0,
          }}
        >
          Your salary is frozen at separation. Explore when to start receiving your deferred
          pension.
        </p>
      </div>

      {/* Progress bar */}
      <div data-testid="deferred-wizard-progress" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              data-testid={`progress-step-${i}`}
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
          Step {step + 1} of {totalSteps} &mdash; {STEP_LABELS[step]}
        </div>
      </div>

      {/* Step content */}
      <div style={{ minHeight: 240 }}>
        {/* Step 0: Retirement Date */}
        {step === 0 && (
          <div data-testid="deferred-step-0">
            <div
              style={{
                background: C.goldLight,
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                border: `1px solid ${C.gold}`,
              }}
            >
              <div
                style={{
                  fontFamily: BODY,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.gold,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Salary at Separation (Frozen)
              </div>
              <div
                data-testid="frozen-salary-display"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 20,
                  fontWeight: 700,
                  color: C.navy,
                  marginTop: 4,
                }}
              >
                {formatCurrency((effectiveMember.current_salary ?? 0) / 12)}/mo
              </div>
            </div>

            <label
              style={{
                display: 'block',
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                color: C.navy,
                marginBottom: 8,
              }}
            >
              When would you like to start receiving benefits?
            </label>
            <input
              data-testid="retirement-date-input"
              type="date"
              value={inputs.retirement_date}
              onChange={(e) => updateInput('retirement_date', e.target.value)}
              style={{
                fontFamily: BODY,
                fontSize: 14,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                color: C.navy,
                width: '100%',
                maxWidth: 240,
              }}
            />
          </div>
        )}

        {/* Step 1: Service Purchase */}
        {step === 1 && (
          <div data-testid="deferred-step-1">
            <label
              style={{
                display: 'block',
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                color: C.navy,
                marginBottom: 8,
              }}
            >
              Would you like to purchase service credit?
            </label>
            <p
              style={{
                fontFamily: BODY,
                fontSize: 13,
                color: C.textSecondary,
                marginBottom: 16,
                marginTop: 0,
              }}
            >
              You currently have {effectiveMember.earned_service_years} years of earned service.
            </p>
            <input
              data-testid="service-purchase-input"
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={inputs.service_purchase_years}
              onChange={(e) =>
                updateInput('service_purchase_years', parseFloat(e.target.value) || 0)
              }
              style={{
                fontFamily: BODY,
                fontSize: 14,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                color: C.navy,
                width: 120,
              }}
            />
            <span
              style={{
                fontFamily: BODY,
                fontSize: 13,
                color: C.textSecondary,
                marginLeft: 8,
              }}
            >
              additional years
            </span>
          </div>
        )}

        {/* Step 2: Payment Option */}
        {step === 2 && (
          <div data-testid="deferred-step-2">
            <label
              style={{
                display: 'block',
                fontFamily: BODY,
                fontSize: 14,
                fontWeight: 600,
                color: C.navy,
                marginBottom: 12,
              }}
            >
              Which payment option would you prefer?
            </label>
            {[
              { id: 'maximum', label: 'Maximum', desc: 'Highest monthly benefit, no survivor' },
              { id: 'js_100', label: 'Joint & 100% Survivor', desc: '100% continues to survivor' },
              { id: 'js_75', label: 'Joint & 75% Survivor', desc: '75% continues to survivor' },
              { id: 'js_50', label: 'Joint & 50% Survivor', desc: '50% continues to survivor' },
            ].map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  marginBottom: 8,
                  borderRadius: 8,
                  border: `1px solid ${inputs.payment_option === opt.id ? C.sage : C.borderLight}`,
                  background: inputs.payment_option === opt.id ? C.sageLight : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="payment_option"
                  value={opt.id}
                  checked={inputs.payment_option === opt.id}
                  onChange={() => updateInput('payment_option', opt.id)}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: BODY,
                      fontSize: 14,
                      fontWeight: 600,
                      color: C.navy,
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      fontFamily: BODY,
                      fontSize: 12,
                      color: C.textSecondary,
                    }}
                  >
                    {opt.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <div data-testid="deferred-step-3">
            {calcLoading && (
              <div data-testid="deferred-results-loading">
                <p style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>
                  Calculating your deferred benefit...
                </p>
              </div>
            )}

            {!calcLoading && result && (
              <div data-testid="deferred-results">
                {/* Monthly benefit hero */}
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: 24,
                    padding: 24,
                    background: C.cardBgWarm,
                    borderRadius: 12,
                    border: `1px solid ${C.borderLight}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: BODY,
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      marginBottom: 4,
                    }}
                  >
                    Estimated Monthly Benefit
                  </div>
                  <div
                    data-testid="deferred-monthly-benefit"
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 36,
                      fontWeight: 700,
                      color: C.sage,
                    }}
                  >
                    {formatCurrency(result.monthly_benefit)}
                  </div>
                </div>

                {/* Eligibility badge */}
                <div style={{ marginBottom: 16 }}>
                  <span
                    data-testid="deferred-eligibility-type"
                    style={{
                      fontFamily: BODY,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 12,
                      background:
                        result.eligibility_type === 'NORMAL'
                          ? C.sageLight
                          : result.eligibility_type === 'EARLY'
                            ? C.goldLight
                            : C.coralLight,
                      color:
                        result.eligibility_type === 'NORMAL'
                          ? C.sage
                          : result.eligibility_type === 'EARLY'
                            ? C.gold
                            : C.coral,
                    }}
                  >
                    {result.eligibility_type === 'NORMAL'
                      ? 'Normal Retirement'
                      : result.eligibility_type === 'EARLY'
                        ? 'Early Retirement'
                        : 'Not Yet Eligible'}
                  </span>
                </div>

                {/* Formula breakdown */}
                <div
                  data-testid="deferred-formula"
                  style={{
                    fontFamily: BODY,
                    fontSize: 13,
                    color: C.textSecondary,
                    padding: '12px 16px',
                    background: C.pageBg,
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontWeight: 600, color: C.navy, marginBottom: 4 }}>
                    Benefit Formula
                  </div>
                  <div>{result.formula_display}</div>
                  <div style={{ marginTop: 8 }}>
                    Service Years: {result.service_years} | AMS: {formatCurrency(result.ams)}/mo
                  </div>
                  {result.reduction_detail.applies && (
                    <div style={{ marginTop: 4, color: C.coral }}>
                      Early retirement reduction: {result.reduction_pct}% (
                      {result.reduction_detail.years_under_65} years under 65 at{' '}
                      {(result.reduction_detail.rate_per_year * 100).toFixed(0)}%/year)
                    </div>
                  )}
                </div>
              </div>
            )}

            {!calcLoading && !result && (
              <p style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>
                No calculation results available. Try adjusting your inputs.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div
        data-testid="deferred-wizard-nav"
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
          data-testid="deferred-back"
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
          {isResultsStep && result && (
            <button
              data-testid="deferred-save"
              onClick={handleSave}
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
              data-testid="deferred-next"
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
              data-testid="deferred-restart"
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
