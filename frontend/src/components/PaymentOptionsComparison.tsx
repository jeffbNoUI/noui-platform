import type { PaymentOptions } from '@/types/BenefitCalculation';
import { formatCurrency } from '@/lib/formatters';

interface PaymentOptionsComparisonProps {
  options: PaymentOptions;
  maritalStatus?: string;
}

export default function PaymentOptionsComparison({ options, maritalStatus }: PaymentOptionsComparisonProps) {
  const requiresSpousalConsent = maritalStatus === 'M';

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Payment Options</h2>
        <p className="text-sm text-gray-500">
          Side-by-side comparison of all four payment options with member's actual numbers.
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-4 gap-4">
          {/* Maximum Single Life */}
          <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4 text-center">
            <h3 className="text-sm font-semibold text-gray-700">Maximum</h3>
            <p className="text-xs text-gray-500">Single Life</p>
            <p className="mt-3 text-2xl font-bold text-green-700">
              {formatCurrency(options.maximum)}
            </p>
            <p className="mt-1 text-xs text-gray-500">per month</p>
            <div className="mt-3 text-xs text-gray-400">
              <p>Factor: 1.0000</p>
              <p>Survivor: $0</p>
            </div>
          </div>

          {/* 100% J&S */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <h3 className="text-sm font-semibold text-gray-700">100% J&S</h3>
            <p className="text-xs text-gray-500">Joint & Survivor</p>
            <p className="mt-3 text-2xl font-bold text-brand-700">
              {formatCurrency(options.js_100.member_amount)}
            </p>
            <p className="mt-1 text-xs text-gray-500">per month</p>
            <div className="mt-3 text-xs text-gray-400">
              <p>Factor: {options.js_100.factor.toFixed(4)}</p>
              <p>Survivor: {formatCurrency(options.js_100.survivor_amount)}</p>
            </div>
          </div>

          {/* 75% J&S */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <h3 className="text-sm font-semibold text-gray-700">75% J&S</h3>
            <p className="text-xs text-gray-500">Joint & Survivor</p>
            <p className="mt-3 text-2xl font-bold text-brand-700">
              {formatCurrency(options.js_75.member_amount)}
            </p>
            <p className="mt-1 text-xs text-gray-500">per month</p>
            <div className="mt-3 text-xs text-gray-400">
              <p>Factor: {options.js_75.factor.toFixed(4)}</p>
              <p>Survivor: {formatCurrency(options.js_75.survivor_amount)}</p>
            </div>
          </div>

          {/* 50% J&S */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <h3 className="text-sm font-semibold text-gray-700">50% J&S</h3>
            <p className="text-xs text-gray-500">Joint & Survivor</p>
            <p className="mt-3 text-2xl font-bold text-brand-700">
              {formatCurrency(options.js_50.member_amount)}
            </p>
            <p className="mt-1 text-xs text-gray-500">per month</p>
            <div className="mt-3 text-xs text-gray-400">
              <p>Factor: {options.js_50.factor.toFixed(4)}</p>
              <p>Survivor: {formatCurrency(options.js_50.survivor_amount)}</p>
            </div>
          </div>
        </div>

        {requiresSpousalConsent && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <span className="font-medium text-amber-800">Spousal Consent Required: </span>
            <span className="text-amber-700">
              Member is married. If electing Maximum (Single Life), spousal consent is required
              per RMC provisions.
            </span>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400 text-center italic">
          {options.disclaimer}
        </p>
      </div>
    </div>
  );
}
