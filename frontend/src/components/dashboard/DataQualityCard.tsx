import type { DQScore, DQIssue } from '@/types/DataQuality';

interface DataQualityCardProps {
  score?: DQScore;
  memberIssues: DQIssue[];
  isLoading: boolean;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-600 border-blue-200',
};

function scoreColor(score: number): string {
  if (score >= 95) return 'text-emerald-600';
  if (score >= 85) return 'text-amber-600';
  return 'text-red-600';
}

export default function DataQualityCard({ score, memberIssues, isLoading }: DataQualityCardProps) {
  const openIssues = memberIssues.filter((i) => i.status === 'open');
  const hasOpenMemberIssues = openIssues.length > 0;

  if (isLoading && !score) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Data Quality</h3>
        <p className="text-xs text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!score && openIssues.length === 0) return null;

  const cardBorder = hasOpenMemberIssues
    ? 'border-amber-200 bg-amber-50/50'
    : 'border-gray-200 bg-white';

  return (
    <div className={`rounded-lg border shadow-sm ${cardBorder}`}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className={`border-b px-5 py-3 flex items-center justify-between ${hasOpenMemberIssues ? 'border-amber-200' : 'border-gray-200'}`}
      >
        <h3
          className={`text-sm font-semibold ${hasOpenMemberIssues ? 'text-amber-800' : 'text-gray-700'}`}
        >
          Data Quality
        </h3>
        {hasOpenMemberIssues && (
          <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            {openIssues.length} issue{openIssues.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Score summary ────────────────────────────────────────────── */}
      {score && (
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-2xl font-bold tabular-nums ${scoreColor(score.overallScore)}`}>
              {score.overallScore.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500">overall score</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
            <span>{score.totalChecks} checks</span>
            <span>
              {score.openIssues} open issue{score.openIssues !== 1 ? 's' : ''}
            </span>
            {score.criticalIssues > 0 && (
              <span className="text-red-600 font-medium">{score.criticalIssues} critical</span>
            )}
          </div>
        </div>
      )}

      {/* ── Member issues ────────────────────────────────────────────── */}
      {openIssues.length > 0 && (
        <div>
          <div className="px-5 pt-2 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Issues for this member
            </span>
          </div>
          <div
            className={`divide-y ${hasOpenMemberIssues ? 'divide-amber-100' : 'divide-gray-100'}`}
          >
            {openIssues.map((issue) => (
              <div key={issue.issueId} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${SEVERITY_STYLES[issue.severity]}`}
                  >
                    {issue.severity}
                  </span>
                  {issue.fieldName && (
                    <span className="text-xs font-mono text-gray-500">{issue.fieldName}</span>
                  )}
                </div>
                <p className="text-xs text-gray-700">{issue.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
