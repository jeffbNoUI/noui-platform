import { useKBRules } from '@/hooks/useKBRules';
import type { KBRuleReference } from '@/types/KnowledgeBase';
import FeatureBurndown from './FeatureBurndown';

/** Format domain slug to title case: "benefit-calc" → "Benefit Calc" */
function formatDomain(domain: string): string {
  return domain
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Group rules by domain field. Rules without a domain go under "General". */
function groupByDomain(rules: KBRuleReference[]): Map<string, KBRuleReference[]> {
  const map = new Map<string, KBRuleReference[]>();
  for (const rule of rules) {
    const key = rule.domain || 'general';
    const group = map.get(key);
    if (group) {
      group.push(rule);
    } else {
      map.set(key, [rule]);
    }
  }
  return map;
}

const SYSTEM_PARAMETERS = [
  { parameter: 'SLA Targets', value: '30 / 60 / 90 days', notes: 'Standard / Complex / DRO' },
  { parameter: 'DQ Target Score', value: '95%', notes: 'Data quality threshold' },
  {
    parameter: 'Health Poll Interval',
    value: '10 seconds',
    notes: 'Service health check frequency',
  },
  { parameter: 'Employee Contribution', value: '8.45%', notes: 'DERP plan provision' },
  { parameter: 'Employer Contribution', value: '17.95%', notes: 'DERP plan provision' },
  { parameter: 'Vesting Period', value: '5 years', notes: 'All tiers' },
  { parameter: 'Normal Retirement Age', value: '65', notes: 'All tiers, with 5 years service' },
];

export default function ConfigRulesPanel() {
  const { data: rules, isLoading, isError } = useKBRules();

  const grouped = rules ? groupByDomain(rules) : new Map<string, KBRuleReference[]>();

  return (
    <div className="space-y-6">
      {/* Plan Provisions */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-700">Plan Provisions</h3>
        </div>
        <div className="p-4">
          {isLoading ? (
            <p className="text-xs text-gray-400">Loading rules...</p>
          ) : isError || grouped.size === 0 ? (
            <p className="text-xs text-gray-500">No rules available</p>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([domain, domainRules]) => (
                <div key={domain}>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    {formatDomain(domain)}
                  </h4>
                  <div className="space-y-1">
                    {domainRules.map((rule) => (
                      <div
                        key={rule.referenceId}
                        className="flex items-start gap-2 text-xs text-gray-700 py-1 px-2 rounded hover:bg-gray-50"
                      >
                        <span className="font-mono text-gray-400 shrink-0">{rule.code}</span>
                        <span>{rule.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Parameters */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-700">System Parameters</h3>
        </div>
        <div className="p-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="pb-2 font-semibold">Parameter</th>
                <th className="pb-2 font-semibold">Value</th>
                <th className="pb-2 font-semibold">Notes / Source</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_PARAMETERS.map((row) => (
                <tr key={row.parameter} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-gray-700">{row.parameter}</td>
                  <td className="py-2 text-gray-900 font-mono">{row.value}</td>
                  <td className="py-2 text-gray-500">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service Catalog */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-700">Service Catalog</h3>
        </div>
        <FeatureBurndown />
      </div>
    </div>
  );
}
