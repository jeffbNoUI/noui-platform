import type { RuleDefinition } from '@/types/Rules';

interface RuleCardProps {
  rule: RuleDefinition;
  onClick: () => void;
}

export default function RuleCard({ rule, onClick }: RuleCardProps) {
  const status = rule.testStatus;
  const allPassing = status && status.failing === 0 && status.total > 0;
  const hasFailing = status && status.failing > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
    >
      {/* Status icon */}
      <span className="shrink-0 text-base">
        {allPassing ? (
          <span className="text-green-600" aria-label="Passing">
            &#10003;
          </span>
        ) : hasFailing ? (
          <span className="text-red-600" aria-label="Failing">
            &#10007;
          </span>
        ) : (
          <span className="text-gray-400" aria-label="No tests">
            &#8212;
          </span>
        )}
      </span>

      {/* Rule ID */}
      <span className="shrink-0 font-mono text-xs text-gray-500 w-32 truncate">{rule.id}</span>

      {/* Rule name */}
      <span className="shrink-0 font-medium text-sm text-gray-900 w-48 truncate">{rule.name}</span>

      {/* Description */}
      <span className="flex-1 text-sm text-gray-500 truncate">{rule.description}</span>

      {/* Test count badge */}
      {status && (
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            hasFailing ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {status.passing}/{status.total}
        </span>
      )}
    </button>
  );
}
