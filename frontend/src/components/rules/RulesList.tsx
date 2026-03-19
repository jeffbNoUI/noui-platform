import type { RuleDefinition } from '@/types/Rules';
import RuleCard from './RuleCard';

interface RulesListProps {
  rules: RuleDefinition[];
  searchQuery: string;
  onSelectRule: (ruleId: string) => void;
}

function formatDomain(domain: string): string {
  return domain
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function RulesList({ rules, searchQuery, onSelectRule }: RulesListProps) {
  // Client-side search filter
  const filtered = searchQuery
    ? rules.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        );
      })
    : rules;

  // Group by domain
  const grouped = filtered.reduce<Record<string, RuleDefinition[]>>((acc, rule) => {
    const key = rule.domain || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule);
    return acc;
  }, {});

  const domainKeys = Object.keys(grouped).sort();

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        {searchQuery ? 'No rules match your search.' : 'No rules found.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {domainKeys.map((domain) => {
        const domainRules = grouped[domain];
        const passing = domainRules.reduce((sum, r) => sum + (r.testStatus?.passing ?? 0), 0);
        const total = domainRules.reduce((sum, r) => sum + (r.testStatus?.total ?? 0), 0);
        const failing = domainRules.reduce((sum, r) => sum + (r.testStatus?.failing ?? 0), 0);

        return (
          <div
            key={domain}
            className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{formatDomain(domain)}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600 font-medium">{passing} passing</span>
                {failing > 0 && <span className="text-red-600 font-medium">{failing} failing</span>}
                <span className="text-gray-400">/ {total} tests</span>
              </div>
            </div>
            <div>
              {domainRules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} onClick={() => onSelectRule(rule.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
