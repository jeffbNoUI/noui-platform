import { useState, useRef, useCallback } from 'react';
import type { DQScore, DQIssue } from '@/types/DataQuality';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import DQIssueDetail from '@/components/detail/DQIssueDetail';

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

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

const FILTER_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

function scoreColor(score: number): string {
  if (score >= 95) return 'text-emerald-600';
  if (score >= 85) return 'text-amber-600';
  return 'text-red-600';
}

export default function DataQualityCard({ score, memberIssues, isLoading }: DataQualityCardProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const openIssues = memberIssues.filter((i) => i.status === 'open');
  const filteredIssues =
    severityFilter === 'all' ? openIssues : openIssues.filter((i) => i.severity === severityFilter);
  const hasOpenMemberIssues = openIssues.length > 0;

  const handleRowClick = useCallback((index: number) => {
    const el = rowRefs.current.get(index);
    if (el) {
      setSourceRect(el.getBoundingClientRect());
      setSelectedIdx(index);
    }
  }, []);

  const setRowRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(index, el);
    } else {
      rowRefs.current.delete(index);
    }
  }, []);

  if (isLoading && !score) {
    return (
      <CollapsibleSection title="Data Quality">
        <p className="text-xs text-gray-400">Loading...</p>
      </CollapsibleSection>
    );
  }

  if (!score && openIssues.length === 0) return null;

  const badgeText = hasOpenMemberIssues
    ? `${openIssues.length} issue${openIssues.length > 1 ? 's' : ''}`
    : score
      ? `${score.overallScore.toFixed(0)}%`
      : undefined;

  return (
    <CollapsibleSection
      title="Data Quality"
      badge={badgeText}
      className={`rounded-lg border shadow-sm overflow-hidden ${
        hasOpenMemberIssues ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-white'
      }`}
      titleClassName={`text-sm font-semibold ${hasOpenMemberIssues ? 'text-amber-800' : 'text-gray-700'}`}
      badgeClassName={
        hasOpenMemberIssues
          ? 'text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full'
          : 'rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600'
      }
    >
      {/* Score summary */}
      {score && (
        <div className="mb-3 pb-3 border-b border-gray-100">
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

      {/* Member issues */}
      {openIssues.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Issues for this member
            </span>
            {/* Severity filter */}
            <div className="flex gap-0.5" role="group" aria-label="Filter by severity">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSeverityFilter(opt.value)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    severityFilter === opt.value
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  data-testid={`severity-filter-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div
            className={`-mx-5 divide-y ${hasOpenMemberIssues ? 'divide-amber-100' : 'divide-gray-100'}`}
          >
            {filteredIssues.map((issue, idx) => (
              <div
                key={issue.issueId}
                ref={(el) => setRowRef(idx, el)}
                onClick={() => handleRowClick(idx)}
                className="px-5 py-3 cursor-pointer hover:bg-amber-50/80 transition-colors"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(idx);
                  }
                }}
              >
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
            {filteredIssues.length === 0 && (
              <div className="px-5 py-3 text-xs text-gray-400">No {severityFilter} issues</div>
            )}
          </div>
        </div>
      )}

      {/* Detail overlay */}
      {selectedIdx !== null && sourceRect && (
        <DQIssueDetail
          item={filteredIssues[selectedIdx]}
          sourceRect={sourceRect}
          onClose={() => {
            setSelectedIdx(null);
            setSourceRect(null);
          }}
          items={filteredIssues}
          currentIndex={selectedIdx}
          onNavigate={setSelectedIdx}
        />
      )}
    </CollapsibleSection>
  );
}
