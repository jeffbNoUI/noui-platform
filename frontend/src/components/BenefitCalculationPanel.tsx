import type { BenefitCalcResult } from '@/types/BenefitCalculation';
import { formatCurrency, formatPercent, formatServiceYears, eligibilityLabel } from '@/lib/formatters';

interface BenefitCalculationPanelProps {
  calculation: BenefitCalcResult;
}

export default function BenefitCalculationPanel({ calculation }: BenefitCalculationPanelProps) {
  const { formula, reduction, eligibility, ams } = calculation;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Benefit Calculation</h2>
        <p className="text-sm text-gray-500">
          The rules engine calculated the benefit using certified plan provisions.
          Every step is shown for verification.
        </p>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Eligibility Determination */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
            Eligibility Determination
          </h3>
          <div className="rounded-md bg-gray-50 p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Retirement Type</span>
                <p className="font-semibold text-brand-700">
                  {eligibilityLabel(eligibility.best_eligible_type)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Tier</span>
                <p className="font-medium">Tier {eligibility.tier}</p>
                <p className="text-xs text-gray-400">{eligibility.tier_source}</p>
              </div>
              <div>
                <span className="text-gray-500">Vested</span>
                <p className="font-medium">{eligibility.vested ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {/* Rule evaluations */}
            <div className="mt-4 space-y-1">
              {eligibility.evaluations.map((rule) => (
                <div key={rule.rule_id} className="flex items-center gap-2 text-xs">
                  <span className={`inline-block h-2 w-2 rounded-full ${rule.met ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="font-medium">{rule.rule_name}</span>
                  <span className="text-gray-400">{rule.details}</span>
                  <span className="ml-auto text-gray-300">{rule.source_reference}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AMS Calculation */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
            Average Monthly Salary (AMS)
          </h3>
          <div className="rounded-md bg-gray-50 p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">AMS Window</span>
                <p className="font-medium">{ams.window_months} months</p>
              </div>
              <div>
                <span className="text-gray-500">Window Period</span>
                <p className="font-medium">{ams.window_start} to {ams.window_end}</p>
              </div>
              <div>
                <span className="text-gray-500">AMS Amount</span>
                <p className="text-lg font-bold text-brand-700">{formatCurrency(ams.amount)}</p>
              </div>
            </div>
            {ams.leave_payout_included && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <span className="font-medium text-amber-800">Leave Payout Included: </span>
                <span className="text-amber-700">
                  {formatCurrency(ams.leave_payout_amount)} added to final month
                  {ams.leave_payout_ams_impact > 0 && (
                    <> (AMS impact: +{formatCurrency(ams.leave_payout_ams_impact)}/mo)</>
                  )}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Benefit Formula */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
            Benefit Formula
          </h3>
          <div className="rounded-md bg-blue-50 p-4">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">
                AMS &times; Multiplier &times; Service Years
              </p>
              <p className="text-lg font-mono">
                {formatCurrency(formula.ams)} &times; {formula.multiplier_pct} &times; {formula.service_years.toFixed(2)} yr
              </p>
              <p className="text-2xl font-bold text-brand-700 mt-1">
                = {formatCurrency(formula.gross_benefit)}/mo
                <span className="text-sm font-normal text-gray-500 ml-2">(unreduced)</span>
              </p>
            </div>
            <p className="mt-2 text-xs text-gray-500 text-center">
              Service: {formatServiceYears(formula.service_years)} ({formula.service_type})
            </p>
          </div>
        </section>

        {/* Early Retirement Reduction (conditional) */}
        {reduction.applies && (
          <section>
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
              Early Retirement Reduction
            </h3>
            <div className="rounded-md bg-orange-50 border border-orange-200 p-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Age at Retirement</span>
                  <p className="font-medium">{reduction.age_at_retirement}</p>
                </div>
                <div>
                  <span className="text-gray-500">Years Under 65</span>
                  <p className="font-medium">{reduction.years_under_65}</p>
                </div>
                <div>
                  <span className="text-gray-500">Rate Per Year</span>
                  <p className="font-medium">{formatPercent(reduction.rate_per_year)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Total Reduction</span>
                  <p className="font-semibold text-orange-700">{formatPercent(reduction.total_reduction_pct)}</p>
                </div>
              </div>
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-500">
                  {formatCurrency(formula.gross_benefit)} &times; {reduction.reduction_factor.toFixed(4)}
                </p>
                <p className="text-xl font-bold text-orange-700">
                  = {formatCurrency(reduction.reduced_benefit)}/mo
                </p>
              </div>
              <p className="mt-2 text-xs text-gray-400 text-center">
                Source: {reduction.source_reference}
              </p>
            </div>
          </section>
        )}

        {/* Maximum Monthly Benefit */}
        <section>
          <div className="rounded-md bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Maximum Monthly Benefit</p>
            <p className="text-3xl font-bold text-green-700 mt-1">
              {formatCurrency(calculation.maximum_benefit)}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
