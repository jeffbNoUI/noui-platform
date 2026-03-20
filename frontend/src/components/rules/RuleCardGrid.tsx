import type { RuleDefinition } from '@/types/Rules';
import RuleCard from './RuleCard';

interface RuleCardGridProps {
  rules: RuleDefinition[];
  onSelectRule: (ruleId: string) => void;
}

export default function RuleCardGrid({ rules, onSelectRule }: RuleCardGridProps) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">No rules in this domain.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onClick={() => onSelectRule(rule.id)} />
      ))}
    </div>
  );
}
