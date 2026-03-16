import type { RetirementCase } from '@/types/Case';

interface StaffPortalWorkQueueProps {
  cases: RetirementCase[];
  stageCount: number;
  onOpenCase: (
    caseId: string,
    memberId: number,
    retDate: string,
    flags?: string[],
    droId?: number,
  ) => void;
}

const PRIORITY_STYLES = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  standard: 'bg-gray-50 text-gray-600 border-gray-200',
  low: 'bg-blue-50 text-blue-600 border-blue-200',
};

const SLA_STYLES = {
  'on-track': { label: 'On Track', className: 'bg-emerald-50 text-emerald-700' },
  'at-risk': { label: 'At Risk', className: 'bg-amber-50 text-amber-700' },
  urgent: { label: 'Urgent', className: 'bg-red-50 text-red-700' },
};

const TIER_STYLES: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function displayName(c: { name: string; caseType: string }) {
  return c.caseType === 'DRO' ? `${c.name} (DRO)` : c.name;
}

export default function StaffPortalWorkQueue({
  cases,
  stageCount,
  onOpenCase,
}: StaffPortalWorkQueueProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <div className="col-span-1">Priority</div>
        <div className="col-span-2">Case ID</div>
        <div className="col-span-3">Member</div>
        <div className="col-span-2">Current Stage</div>
        <div className="col-span-1">SLA</div>
        <div className="col-span-1">Days</div>
        <div className="col-span-2">Flags</div>
      </div>

      {cases.map((item) => (
        <div
          key={item.caseId}
          onClick={() =>
            onOpenCase(item.caseId, item.memberId, item.retDate, item.flags, item.droId)
          }
          className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 hover:bg-iw-sageLight/30 cursor-pointer transition-colors items-center"
        >
          <div className="col-span-1">
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[item.priority]}`}
            >
              {item.priority}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-sm font-mono font-semibold text-iw-navy">{item.caseId}</span>
          </div>
          <div className="col-span-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TIER_STYLES[item.tier]}`}
              >
                T{item.tier}
              </span>
              <div>
                <div className="text-sm font-medium text-gray-900">{displayName(item)}</div>
                <div className="text-xs text-gray-500">{item.dept}</div>
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-sm text-gray-700">{item.stage}</div>
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: stageCount }, (_, idx) => (
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
          </div>
          <div className="col-span-1">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SLA_STYLES[item.sla].className}`}
            >
              {SLA_STYLES[item.sla].label}
            </span>
          </div>
          <div className="col-span-1">
            <span className="text-sm text-gray-600">{item.daysOpen}d</span>
          </div>
          <div className="col-span-2">
            <div className="flex flex-wrap gap-1">
              {(item.flags ?? []).map((flag) => (
                <span
                  key={flag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200"
                >
                  {flag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}

      {cases.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          No cases match your search.
        </div>
      )}
    </div>
  );
}
