import type { RuleGovernance as RuleGovernanceType } from '@/types/Rules';

interface RuleGovernanceProps {
  governance: RuleGovernanceType;
  sourceReference: { document: string; section: string; lastVerified: string };
  dependencies: string[];
  onNavigateToRule?: (ruleId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  certified: 'bg-green-100 text-green-800',
  draft: 'bg-yellow-100 text-yellow-800',
  review: 'bg-blue-100 text-blue-800',
  deprecated: 'bg-red-100 text-red-800',
};

export default function RuleGovernance({
  governance,
  sourceReference,
  dependencies,
  onNavigateToRule,
}: RuleGovernanceProps) {
  const statusStyle = STATUS_STYLES[governance.status.toLowerCase()] || 'bg-gray-100 text-gray-800';

  return (
    <div className="space-y-6">
      {/* Governance Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Status
          </h4>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusStyle}`}>
            {governance.status}
          </span>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Effective Date
          </h4>
          <span className="text-sm text-gray-900">{governance.effectiveDate}</span>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Last Reviewed
          </h4>
          <span className="text-sm text-gray-900">{governance.lastReviewed}</span>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Reviewed By
          </h4>
          <span className="text-sm text-gray-900">{governance.reviewedBy}</span>
        </div>
      </div>

      {/* Source Reference */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Source Reference</h3>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-gray-500 font-medium">Document</span>
            <span className="text-gray-900">{sourceReference.document}</span>
            <span className="text-gray-500 font-medium">Section</span>
            <span className="text-gray-900">{sourceReference.section}</span>
            <span className="text-gray-500 font-medium">Last Verified</span>
            <span className="text-gray-900">{sourceReference.lastVerified}</span>
          </div>
        </div>
      </div>

      {/* Dependencies */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Dependencies</h3>
        {dependencies.length === 0 ? (
          <p className="text-sm text-gray-500">No dependencies.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dependencies.map((dep) => (
              <button
                key={dep}
                onClick={() => onNavigateToRule?.(dep)}
                className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-gray-100 text-iw-sage hover:bg-gray-200 transition-colors"
              >
                {dep}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
