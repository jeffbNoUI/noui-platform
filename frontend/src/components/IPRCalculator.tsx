import type { IPRDetail } from '@/types/BenefitCalculation';
import { formatCurrency, formatServiceYears } from '@/lib/formatters';

interface IPRCalculatorProps {
  ipr: IPRDetail;
  medicareFlag?: string;
}

export default function IPRCalculator({ ipr, medicareFlag }: IPRCalculatorProps) {
  const isMedicare = medicareFlag === 'Y';

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Insurance Premium Reimbursement (IPR)</h2>
      </div>

      <div className="p-6">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Earned Service (for IPR)</span>
            <span className="font-medium">{formatServiceYears(ipr.earned_service_years)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Non-Medicare Rate</span>
            <span className="font-medium">$12.50/yr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Medicare Rate</span>
            <span className="font-medium">$6.25/yr</span>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Non-Medicare Monthly</span>
              <span className={`font-bold ${!isMedicare ? 'text-brand-700' : ''}`}>
                {formatCurrency(ipr.non_medicare_monthly)}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-600">Medicare Monthly</span>
              <span className={`font-bold ${isMedicare ? 'text-brand-700' : ''}`}>
                {formatCurrency(ipr.medicare_monthly)}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          {ipr.source_reference}
        </p>
      </div>
    </div>
  );
}
