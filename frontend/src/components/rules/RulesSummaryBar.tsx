interface RulesSummaryBarProps {
  totalRules: number;
  passingRules: number;
  failingRules: number;
  lastRun?: string;
  label?: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (isNaN(diffMs) || diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RulesSummaryBar({
  totalRules,
  passingRules,
  failingRules,
  lastRun,
  label,
}: RulesSummaryBarProps) {
  const allPassing = failingRules === 0;

  return (
    <div
      className={`rounded-lg p-4 ${allPassing ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-bold ${allPassing ? 'text-green-700' : 'text-gray-900'}`}
            >
              {passingRules}/{totalRules}
            </span>
            <span className="text-sm text-gray-600">passing</span>
            {label && <span className="text-sm text-gray-600">{label}</span>}
          </div>
          {failingRules > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-red-600">{failingRules}</span>
              <span className="text-sm text-red-600">failing</span>
            </div>
          )}
        </div>
        {lastRun && (
          <span className="text-sm text-gray-500">Last tested {relativeTime(lastRun)}</span>
        )}
      </div>
    </div>
  );
}
