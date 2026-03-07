import type { DROCalcResult } from '@/types/BenefitCalculation';
import { formatCurrency, formatPercent, formatServiceYears, formatDate } from '@/lib/formatters';

interface DROImpactPanelProps {
  dro: DROCalcResult;
}

export default function DROImpactPanel({ dro }: DROImpactPanelProps) {
  if (!dro.has_dro) return null;

  return (
    <div className="rounded-lg border border-purple-200 bg-white shadow-sm">
      <div className="border-b border-purple-200 bg-purple-50 px-6 py-4">
        <h2 className="text-lg font-semibold text-purple-900">Domestic Relations Order (DRO) Impact</h2>
        <p className="text-sm text-purple-600">
          DRO split applied before payment option selection per RULE-DRO-SEQUENCE.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Marriage Date</span>
            <p className="font-medium">{formatDate(dro.marriage_date)}</p>
          </div>
          <div>
            <span className="text-gray-500">Divorce Date</span>
            <p className="font-medium">{formatDate(dro.divorce_date)}</p>
          </div>
        </div>

        <div className="rounded-md bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Marital Share Calculation</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Service During Marriage</span>
              <span className="font-medium">{formatServiceYears(dro.marital_service_years)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Service</span>
              <span className="font-medium">{formatServiceYears(dro.total_service_years)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="text-gray-600">Marital Fraction</span>
              <span className="font-bold">{(dro.marital_fraction * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-md bg-purple-50 p-4">
          <h3 className="text-sm font-medium text-purple-800 mb-3">Benefit Division</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Member's Gross Benefit</span>
              <span className="font-medium">{formatCurrency(dro.gross_benefit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Marital Share</span>
              <span className="font-medium">{formatCurrency(dro.marital_share)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Alternate Payee Percentage</span>
              <span className="font-medium">{formatPercent(dro.alt_payee_pct, 0)}</span>
            </div>
            <div className="flex justify-between border-t border-purple-200 pt-2">
              <span className="text-purple-700">Alternate Payee Amount</span>
              <span className="font-bold text-purple-700">{formatCurrency(dro.alt_payee_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700 font-medium">Member's Benefit After DRO</span>
              <span className="font-bold text-green-700">{formatCurrency(dro.member_benefit_after_dro)}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Division method: {dro.division_method}. DRO split is applied before payment option selection
          and does not affect IPR eligibility.
        </p>
      </div>
    </div>
  );
}
