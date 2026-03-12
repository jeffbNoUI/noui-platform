import type { RetirementCase } from '@/types/Case';
import type { Commitment } from '@/types/CRM';

const STAGE_COUNT = 7; // 7 workflow stages

interface ActiveWorkCardProps {
  activeCases: RetirementCase[];
  commitments: Commitment[];
  onOpenCase: (
    caseId: string,
    memberId: number,
    retDate: string,
    flags?: string[],
    droId?: number,
  ) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  standard: 'bg-gray-50 text-gray-600 border-gray-200',
  low: 'bg-blue-50 text-blue-600 border-blue-200',
};

const SLA_STYLES: Record<string, { label: string; className: string }> = {
  'on-track': { label: 'On Track', className: 'bg-emerald-50 text-emerald-700' },
  'at-risk': { label: 'At Risk', className: 'bg-amber-50 text-amber-700' },
  urgent: { label: 'Urgent', className: 'bg-red-50 text-red-700' },
};

const COMMITMENT_STYLES: Record<string, string> = {
  pending: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
};

export default function ActiveWorkCard({
  activeCases,
  commitments,
  onOpenCase,
}: ActiveWorkCardProps) {
  const openCommitments = commitments.filter(
    (c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'overdue',
  );

  const totalItems = activeCases.length + openCommitments.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">In-Process Work</h3>
        {totalItems > 0 && (
          <span className="text-xs font-bold text-iw-navy bg-iw-sageLight px-2 py-0.5 rounded-full">
            {totalItems}
          </span>
        )}
      </div>

      {totalItems === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No active work items</div>
      ) : (
        <div>
          {/* Cases */}
          {activeCases.length > 0 && (
            <div>
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Cases
                </span>
              </div>
              {activeCases.map((item) => (
                <div
                  key={item.caseId}
                  onClick={() =>
                    onOpenCase(item.caseId, item.memberId, item.retDate, item.flags, item.droId)
                  }
                  className="px-5 py-3 border-b border-gray-100 hover:bg-iw-sageLight/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-iw-navy">
                        {item.caseId}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLES[item.priority]}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SLA_STYLES[item.sla]?.className || ''}`}
                    >
                      {SLA_STYLES[item.sla]?.label || item.sla}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{item.stage}</span>
                    <span className="text-xs text-gray-400">{item.daysOpen}d open</span>
                  </div>
                  {/* Stage progress */}
                  <div className="flex gap-0.5 mt-1.5">
                    {Array.from({ length: STAGE_COUNT }, (_, idx) => (
                      <div
                        key={idx}
                        className={`h-1 flex-1 rounded-full ${
                          idx < item.stageIdx
                            ? 'bg-iw-sage'
                            : idx === item.stageIdx
                              ? 'bg-iw-sage animate-pulse'
                              : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  {/* Flags */}
                  {(item.flags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(item.flags ?? []).map((flag) => (
                        <span
                          key={flag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Commitments */}
          {openCommitments.length > 0 && (
            <div>
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Commitments
                </span>
              </div>
              {openCommitments.map((c) => (
                <div key={c.commitmentId} className="px-5 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{c.description}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${COMMITMENT_STYLES[c.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Due:{' '}
                    {new Date(c.targetDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {c.ownerAgent && <> &middot; {c.ownerAgent}</>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
