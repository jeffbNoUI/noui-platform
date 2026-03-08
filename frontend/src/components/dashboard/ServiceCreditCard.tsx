import type { ServiceCreditSummary } from '@/types/Member';
import { formatServiceYears } from '@/lib/formatters';

interface ServiceCreditCardProps {
  summary?: ServiceCreditSummary;
  isLoading: boolean;
}

export default function ServiceCreditCard({ summary, isLoading }: ServiceCreditCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Service Credit</h3>
      </div>

      {isLoading && <div className="px-5 py-6 text-center text-sm text-gray-400">Loading...</div>}

      {!isLoading && !summary && (
        <div className="px-5 py-6 text-center text-sm text-gray-400">No data available</div>
      )}

      {summary && (
        <div className="px-5 py-4 space-y-2.5">
          <CreditRow label="Earned" years={summary.earned_years} accent />
          {summary.purchased_years > 0 && (
            <CreditRow label="Purchased" years={summary.purchased_years} />
          )}
          {summary.military_years > 0 && (
            <CreditRow label="Military" years={summary.military_years} />
          )}
          {summary.leave_years > 0 && <CreditRow label="Leave" years={summary.leave_years} />}

          <div className="border-t border-gray-100 pt-2.5">
            <CreditRow
              label="Eligibility Years"
              years={summary.eligibility_years}
              hint="earned only"
            />
            <CreditRow
              label="Benefit Years"
              years={summary.benefit_years}
              hint="earned + purchased"
            />
          </div>

          <div className="border-t border-gray-100 pt-2.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-semibold text-gray-700">Total</span>
              <span className="text-sm font-bold text-iw-navy">
                {formatServiceYears(summary.total_years)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreditRow({
  label,
  years,
  hint,
  accent,
}: {
  label: string;
  years: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <div>
        <span className="text-xs text-gray-500">{label}</span>
        {hint && <span className="text-[10px] text-gray-400 ml-1">({hint})</span>}
      </div>
      <span className={`text-sm font-medium ${accent ? 'text-iw-sage' : 'text-gray-900'}`}>
        {formatServiceYears(years)}
      </span>
    </div>
  );
}
