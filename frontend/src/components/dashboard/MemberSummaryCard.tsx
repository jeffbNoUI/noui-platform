import type { MemberSummaryResult, AttentionSeverity } from '@/lib/memberSummary';

interface MemberSummaryCardProps {
  summary: MemberSummaryResult | null;
  isLoading: boolean;
}

const severityDot: Record<AttentionSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-500',
  info: 'bg-gray-300',
};

const severityText: Record<AttentionSeverity, string> = {
  critical: 'text-red-700',
  high: 'text-amber-700',
  medium: 'text-blue-600',
  info: 'text-gray-500',
};

export default function MemberSummaryCard({ summary, isLoading }: MemberSummaryCardProps) {
  const actionItems =
    summary?.attentionItems.filter(
      (i) => i.severity === 'critical' || i.severity === 'high' || i.severity === 'medium',
    ) ?? [];

  const infoItems = summary?.attentionItems.filter((i) => i.severity === 'info') ?? [];

  return (
    <div className="rounded-lg border border-iw-sage/20 bg-gradient-to-r from-iw-sageLight/30 to-white shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-iw-sage">Member Summary</h3>
          <span className="text-[10px] font-medium text-iw-sage/60 bg-iw-sage/10 px-2 py-0.5 rounded-full">
            AI-generated
          </span>
        </div>

        {isLoading ? (
          <div className="h-12 flex items-center text-sm text-gray-400">Generating summary...</div>
        ) : summary ? (
          <div className="space-y-3">
            {/* Context line */}
            <p className="text-sm text-gray-700 leading-relaxed">{summary.context}</p>

            {/* Action items */}
            {actionItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Needs attention
                </p>
                <ul className="space-y-1">
                  {actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span
                        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${severityDot[item.severity]}`}
                      />
                      <span className={severityText[item.severity]}>
                        <span className="font-medium">{item.label}:</span> {item.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info items */}
            {infoItems.length > 0 && (
              <p className="text-xs text-gray-500">
                {infoItems.map((i) => i.detail).join(' \u00b7 ')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No member data available to summarize.</p>
        )}
      </div>
    </div>
  );
}
