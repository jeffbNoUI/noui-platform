import type { DeathBenefitDetail } from '@/types/BenefitCalculation';
import { formatCurrency } from '@/lib/formatters';

interface DeathBenefitPanelProps {
  deathBenefit: DeathBenefitDetail;
}

export default function DeathBenefitPanel({ deathBenefit }: DeathBenefitPanelProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Lump-Sum Death Benefit</h2>
      </div>

      <div className="p-6">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-500">Lump-Sum Amount</p>
          <p className="text-2xl font-bold text-brand-700">
            {formatCurrency(deathBenefit.amount)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md bg-gray-50 p-3 text-center">
            <p className="text-gray-500">50 Monthly Installments</p>
            <p className="font-semibold">{formatCurrency(deathBenefit.installment_50)}/mo</p>
          </div>
          <div className="rounded-md bg-gray-50 p-3 text-center">
            <p className="text-gray-500">100 Monthly Installments</p>
            <p className="font-semibold">{formatCurrency(deathBenefit.installment_100)}/mo</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Retirement type: {deathBenefit.retirement_type}. Source: {deathBenefit.source_reference}.
          Election is irrevocable.
        </p>
      </div>
    </div>
  );
}
