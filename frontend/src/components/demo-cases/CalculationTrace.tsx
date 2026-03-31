import type { DemoCase } from '@/types/Rules';

interface CalculationTraceProps {
  demoCase: DemoCase;
  onNavigateToRule?: (ruleId: string) => void;
}

interface TraceStep {
  number: number;
  title: string;
  ruleId?: string;
  detail: string;
  result: string;
  warning?: string;
}

export default function CalculationTrace({ demoCase, onNavigateToRule }: CalculationTraceProps) {
  const steps = buildSteps(demoCase);

  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <div key={step.number} className="border-l-4 border-iw-sage pl-4 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-iw-sage/10 text-xs font-semibold text-iw-sage">
              {step.number}
            </span>
            <h4 className="text-sm font-semibold text-gray-900">{step.title}</h4>
            {step.ruleId && (
              <button
                onClick={() => step.ruleId && onNavigateToRule?.(step.ruleId)}
                className="text-xs text-iw-sage hover:underline"
              >
                {step.ruleId}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600 ml-8">{step.detail}</p>
          <div className="mt-1 ml-8 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-gray-900">{step.result}</span>
          </div>
          {step.warning && (
            <div className="mt-2 ml-8 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">{step.warning}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function buildSteps(demoCase: DemoCase): TraceStep[] {
  const steps: TraceStep[] = [];
  const eligibility = demoCase.full?.expected_eligibility as Record<string, unknown> | undefined;
  const benefit = demoCase.full?.expected_benefit as Record<string, unknown> | undefined;
  const ipr = demoCase.full?.expected_ipr as Record<string, unknown> | undefined;
  const purchasedDemo = demoCase.full?.purchased_service_demonstration as
    | Record<string, unknown>
    | undefined;
  const inputs = demoCase.full?.inputs as Record<string, unknown> | undefined;

  const tier = String(demoCase.member.tier);
  let stepNum = 1;

  // Step 1: Tier Determination
  steps.push({
    number: stepNum++,
    title: 'Tier Determination',
    ruleId: 'RULE-TIER-DETERMINATION',
    detail: `Hire date ${demoCase.member.hireDate} places member in Tier ${tier}.`,
    result: `Tier ${tier}`,
  });

  // Step 2: Vesting
  const vested = eligibility?.vested;
  const earnedYears =
    (inputs?.earned_service_years as number | undefined) ??
    (demoCase.inputs.earned_service_years as number | undefined);
  steps.push({
    number: stepNum++,
    title: 'Vesting Check',
    ruleId: 'RULE-VESTING',
    detail: `${earnedYears != null ? `${earnedYears} years earned service.` : ''} Vesting requires 5 years.`,
    result: vested ? 'Vested' : 'Not vested',
  });

  // Step 3: Rule of 75/85
  const rule75Met = eligibility?.rule_of_75_met;
  const rule85Met = eligibility?.rule_of_85_met;
  const rule75Sum = eligibility?.rule_of_75_sum as number | undefined;
  const rule85Sum = eligibility?.rule_of_85_sum as number | undefined;

  if (tier === '3') {
    steps.push({
      number: stepNum++,
      title: 'Rule of 85',
      ruleId: 'RULE-OF-85',
      detail:
        rule85Sum != null
          ? `Age + earned service = ${rule85Sum}. Threshold: 85.`
          : 'Rule of 85 eligibility check.',
      result: rule85Met ? 'Rule of 85 MET' : 'Rule of 85 NOT MET',
      warning: purchasedDemo
        ? 'Purchased service is excluded from Rule of 85 calculation.'
        : undefined,
    });
  } else {
    steps.push({
      number: stepNum++,
      title: 'Rule of 75',
      ruleId: 'RULE-OF-75',
      detail:
        rule75Sum != null
          ? `Age + earned service = ${rule75Sum}. Threshold: 75.`
          : 'Rule of 75 eligibility check.',
      result: rule75Met ? 'Rule of 75 MET' : 'Rule of 75 NOT MET',
      warning: purchasedDemo
        ? 'Purchased service is excluded from Rule of 75 calculation.'
        : undefined,
    });
  }

  // Step 4: Best Eligibility
  const bestType = eligibility?.best_eligible_type as string | undefined;
  const reductionPct = eligibility?.reduction_pct as number | undefined;
  const reductionFactor = eligibility?.reduction_factor as number | undefined;
  if (bestType) {
    const reductionNote =
      reductionPct != null && reductionPct > 0
        ? `Reduction: ${reductionPct}% (factor ${reductionFactor}).`
        : 'No reduction applied.';
    steps.push({
      number: stepNum++,
      title: 'Best Eligibility Path',
      ruleId: 'RULE-ELIGIBILITY',
      detail: `Best eligible type: ${bestType}. ${reductionNote}`,
      result: bestType,
      warning:
        reductionPct != null && reductionPct > 0 && (tier === '1' || tier === '2')
          ? `Early retirement reduction is 3% per year for Tier ${tier} (NOT 6%). See CRITICAL-001.`
          : undefined,
    });
  }

  // Step 5: Benefit Calculation
  if (benefit) {
    const multiplier = benefit.multiplier as number | undefined;
    const formula = benefit.formula as string | undefined;
    const unreduced = benefit.unreduced_benefit as number | undefined;
    const reduced = benefit.reduced_benefit as number | undefined;
    const maxMonthly = benefit.maximum_monthly as number | undefined;
    const resultVal = maxMonthly ?? reduced ?? unreduced;
    steps.push({
      number: stepNum++,
      title: 'Benefit Calculation',
      ruleId: 'RULE-BENEFIT-CALCULATION',
      detail: formula
        ? `${formula}${multiplier != null ? ` (multiplier: ${(multiplier * 100).toFixed(1)}%)` : ''}`
        : `Multiplier: ${multiplier != null ? `${(multiplier * 100).toFixed(1)}%` : '--'}`,
      result:
        resultVal != null
          ? `$${resultVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month`
          : 'See expected_benefit',
    });
  }

  // Step 6: IPR
  if (ipr) {
    const iprEarned = ipr.earned_service_years as number | undefined;
    const nonMedicare = ipr.non_medicare_monthly as number | undefined;
    const medicare = ipr.medicare_monthly as number | undefined;
    steps.push({
      number: stepNum++,
      title: 'Insurance Premium Reduction (IPR)',
      ruleId: 'RULE-IPR',
      detail: `Based on ${iprEarned != null ? `${iprEarned} earned years` : 'earned service'}.${nonMedicare != null ? ` Non-Medicare: $${nonMedicare.toFixed(2)}/mo.` : ''}${medicare != null ? ` Medicare: $${medicare.toFixed(2)}/mo.` : ''}`,
      result:
        nonMedicare != null ? `$${nonMedicare.toFixed(2)}/mo (non-Medicare)` : 'See expected_ipr',
      warning: ipr.note ? String(ipr.note) : undefined,
    });
  }

  // Step 7: Death Benefit
  const deathAmount = benefit?.death_benefit_amount as number | undefined;
  if (deathAmount != null) {
    steps.push({
      number: stepNum++,
      title: 'Death Benefit',
      ruleId: 'RULE-DEATH-BENEFIT',
      detail: `Death benefit amount for ${bestType === 'EARLY' ? 'early' : 'normal'} retirement.`,
      result: `$${deathAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });
  }

  return steps;
}
