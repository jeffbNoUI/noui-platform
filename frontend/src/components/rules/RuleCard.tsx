// frontend/src/components/rules/RuleCard.tsx
import type { RuleDefinition } from '@/types/Rules';

interface RuleCardProps {
  rule: RuleDefinition;
  onClick: () => void;
}

export default function RuleCard({ rule, onClick }: RuleCardProps) {
  const status = rule.testStatus;
  const allPassing = status && status.failing === 0 && status.total > 0;
  const hasFailing = status && status.failing > 0;

  const borderColor = allPassing
    ? 'border-l-green-500'
    : hasFailing
      ? 'border-l-red-500'
      : 'border-l-gray-300';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border border-gray-200 border-l-4 ${borderColor} bg-white shadow-sm p-5 hover:shadow-md hover:border-iw-sage hover:-translate-y-0.5 transition-all cursor-pointer`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold text-gray-900">{rule.name}</h3>
        {status && (
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
              hasFailing ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {status.passing}/{status.total}
          </span>
        )}
      </div>
      <span className="font-mono text-xs text-gray-400 mb-2 block">{rule.id}</span>
      <p className="text-sm text-gray-600">{rule.description}</p>
    </button>
  );
}
