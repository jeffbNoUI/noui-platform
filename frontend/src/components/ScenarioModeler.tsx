import { useState } from 'react';
import type { ScenarioEntry } from '@/types/BenefitCalculation';
import { formatCurrency, formatPercent, formatServiceYears, eligibilityLabel } from '@/lib/formatters';

interface ScenarioModelerProps {
  scenarios: ScenarioEntry[];
  currentRetirementDate: string;
}

export default function ScenarioModeler({ scenarios, currentRetirementDate }: ScenarioModelerProps) {
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);

  if (scenarios.length === 0) return null;

  const currentScenario = scenarios.find(s => s.retirement_date === currentRetirementDate);
  const bestScenario = scenarios.reduce((best, s) =>
    s.monthly_benefit > best.monthly_benefit ? s : best, scenarios[0]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Scenario Modeler</h2>
        <p className="text-sm text-gray-500">
          Interactive retirement date comparison — the system identifies and presents
          threshold proximity for member review.
        </p>
      </div>

      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="pb-2 pr-4">Retirement Date</th>
                <th className="pb-2 pr-4">Age</th>
                <th className="pb-2 pr-4">Total Service</th>
                <th className="pb-2 pr-4">Eligibility</th>
                <th className="pb-2 pr-4">Rule of N</th>
                <th className="pb-2 pr-4">Reduction</th>
                <th className="pb-2 text-right">Monthly Benefit</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario, idx) => {
                const isCurrent = scenario.retirement_date === currentRetirementDate;
                const isBest = scenario === bestScenario;
                const isHighlighted = highlightIdx === idx;

                return (
                  <tr
                    key={scenario.retirement_date}
                    className={`border-b border-gray-100 cursor-pointer transition-colors
                      ${isCurrent ? 'bg-blue-50' : ''}
                      ${isBest && !isCurrent ? 'bg-green-50' : ''}
                      ${isHighlighted ? 'bg-yellow-50' : ''}
                    `}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onMouseLeave={() => setHighlightIdx(null)}
                  >
                    <td className="py-2 pr-4 font-medium">
                      {scenario.retirement_date}
                      {isCurrent && <span className="ml-1 text-xs text-blue-600">(current)</span>}
                    </td>
                    <td className="py-2 pr-4">{scenario.age}</td>
                    <td className="py-2 pr-4">{formatServiceYears(scenario.total_service)}</td>
                    <td className="py-2 pr-4">
                      <span className={scenario.rule_of_n_met ? 'text-green-700 font-medium' : 'text-gray-600'}>
                        {eligibilityLabel(scenario.eligibility_type)}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={scenario.rule_of_n_met ? 'text-green-600' : 'text-orange-600'}>
                        {scenario.rule_of_n_sum.toFixed(2)}
                      </span>
                      {scenario.rule_of_n_met ? ' \u2713' : ''}
                    </td>
                    <td className="py-2 pr-4">
                      {scenario.reduction_pct > 0 ? (
                        <span className="text-orange-600">{formatPercent(scenario.reduction_pct)}</span>
                      ) : (
                        <span className="text-green-600">None</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-bold">
                      <span className={isBest ? 'text-green-700' : ''}>
                        {formatCurrency(scenario.monthly_benefit)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {currentScenario && bestScenario && currentScenario !== bestScenario && (
          <div className="mt-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm">
            <p className="font-medium text-green-800">
              Waiting increases benefit by {formatCurrency(bestScenario.monthly_benefit - currentScenario.monthly_benefit)}/mo
            </p>
            <p className="mt-1 text-green-700 text-xs">
              Retiring on {bestScenario.retirement_date} instead of {currentScenario.retirement_date} results
              in {formatCurrency(bestScenario.monthly_benefit)}/mo vs. {formatCurrency(currentScenario.monthly_benefit)}/mo
              {bestScenario.reduction_pct === 0 && currentScenario.reduction_pct > 0 &&
                ` — the early retirement reduction is eliminated entirely.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
