import { Field, Callout, fmt } from '../shared';
import type { Member, ServiceCreditResponse } from '../../../types/Member';
import type { BenefitCalcResult } from '../../../types/BenefitCalculation';

export default function BenefitStage({
  member,
  calculation,
  serviceCredit,
}: {
  member?: Member;
  calculation?: BenefitCalcResult;
  serviceCredit?: ServiceCreditResponse;
  retirementDate?: string;
}) {
  const calc = calculation?.formula;
  const ams = calculation?.ams;
  const reduction = calculation?.reduction;
  const svc = serviceCredit?.summary;
  const tier = member?.tier_code || member?.tier || 1;

  const multiplierPct = calc
    ? (calc.multiplier * 100).toFixed(1)
    : tier === 1
      ? '2.0'
      : tier === 2
        ? '1.5'
        : '1.0';
  const monthlyBenefit = calc?.gross_benefit || calculation?.maximum_benefit;
  const reducedBenefit = reduction?.reduced_benefit;

  return (
    <div>
      {/* Hero benefit display */}
      <div className="bg-iw-sageLight/50 border border-iw-sage/20 rounded-lg p-4 mb-4 text-center">
        <div className="text-xs text-gray-500 uppercase tracking-widest">
          Formula: {multiplierPct}% × AMS × Years of Service
        </div>
        <div className="text-3xl font-bold text-iw-sage mt-2 font-mono">
          {fmt(reducedBenefit || monthlyBenefit)}/mo
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {calc
            ? `${multiplierPct}% × ${fmt(calc.ams)} × ${calc.service_years?.toFixed(2)}y`
            : `${multiplierPct}% × AMS × service`}
          {reduction?.applies && (
            <span className="text-amber-600 ml-1">
              × {((reduction.reduction_factor || 1) * 100).toFixed(1)}% reduction
            </span>
          )}
        </div>
      </div>

      {/* AMS detail */}
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 mt-4">
        Average Monthly Salary
      </div>
      <Field
        label="AMS Window"
        value={`${ams?.window_months || (tier === 3 ? 60 : 36)} consecutive months`}
      />
      <Field
        label="Window Period"
        value={
          ams
            ? `${new Date(ams.window_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} — ${new Date(ams.window_end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
            : '—'
        }
        highlight
      />
      <Field label="Average Monthly Salary" value={fmt(ams?.amount || calc?.ams)} highlight />
      {ams?.leave_payout_included && (
        <>
          <Field label="Leave Payout Amount" value={fmt(ams.leave_payout_amount)} />
          <Field label="AMS Impact" value={`+${fmt(ams.leave_payout_ams_impact)}/mo`} highlight />
          <Callout
            type="warning"
            title="Leave Payout Impact"
            text={`Leave payout of ${fmt(ams.leave_payout_amount)} added to final month — AMS boosted by ${fmt(ams.leave_payout_ams_impact)}/mo. Member hired before Jan 1, 2010.`}
          />
        </>
      )}

      {/* Benefit formula breakdown */}
      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 mt-6">
        Benefit Calculation
      </div>
      <Field label="Multiplier" value={`${multiplierPct}% (Tier ${tier})`} />
      <Field label="AMS" value={fmt(calc?.ams || ams?.amount)} />
      <Field
        label="Service Credit"
        value={`${(calc?.service_years || svc?.benefit_years || svc?.earned_years || 0).toFixed(2)} years`}
      />
      <Field label="Gross Monthly Benefit" value={fmt(monthlyBenefit)} />

      {reduction?.applies && (
        <>
          <Field
            label="Reduction Factor"
            value={`${(reduction.reduction_factor * 100).toFixed(1)}%`}
            highlight
          />
          <Field label="Reduced Monthly Benefit" value={fmt(reducedBenefit)} highlight />
          <Callout
            type="warning"
            title="Early Retirement Reduction"
            text={`${reduction.total_reduction_pct.toFixed(1)}% reduction applied (${reduction.years_under_65} years under 65 × ${(reduction.rate_per_year * 100).toFixed(0)}%/year). Per ${reduction.source_reference || 'RMC § 18-401'}.`}
          />
        </>
      )}

      <Field label="Annual Benefit" value={fmt((reducedBenefit || monthlyBenefit || 0) * 12)} />
      <Field label="Monthly Benefit" value={fmt(reducedBenefit || monthlyBenefit)} highlight />
    </div>
  );
}
