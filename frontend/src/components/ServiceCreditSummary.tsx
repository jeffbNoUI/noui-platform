import type { ServiceCreditSummary as SCType } from '@/types/Member';
import { formatServiceYears } from '@/lib/formatters';

interface ServiceCreditSummaryProps {
  summary: SCType;
}

export default function ServiceCreditSummary({ summary }: ServiceCreditSummaryProps) {
  const hasPurchased = summary.purchased_years > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Service Credit</h2>
      </div>

      <div className="p-6">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Earned Service</span>
            <span className="font-medium">{formatServiceYears(summary.earned_years)}</span>
          </div>

          {hasPurchased && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Purchased Service</span>
              <span className="font-medium">{formatServiceYears(summary.purchased_years)}</span>
            </div>
          )}

          {summary.military_years > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Military Service</span>
              <span className="font-medium">{formatServiceYears(summary.military_years)}</span>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <div className="flex justify-between text-sm font-semibold">
              <span>Total Service</span>
              <span>{formatServiceYears(summary.total_years)}</span>
            </div>
          </div>
        </div>

        {hasPurchased && (
          <div className="mt-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
            <p className="font-medium text-blue-800">Purchased Service Distinction</p>
            <p className="mt-1 text-blue-700 text-xs">
              Purchased service ({formatServiceYears(summary.purchased_years)}) counts toward
              the <strong>benefit formula</strong> ({formatServiceYears(summary.benefit_years)} total)
              but is <strong>excluded from</strong> Rule of 75/85 and IPR calculations
              ({formatServiceYears(summary.eligibility_years)} earned only).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
