import { useState } from 'react';
import {
  useDQScore,
  useDQScoreTrend,
  useDQChecks,
  useDQIssues,
  useUpdateDQIssue,
} from '@/hooks/useDataQuality';
import DQScoreTrendChart from './DQScoreTrendChart';
import DQCategoryChart from './DQCategoryChart';
import { CheckRow, IssueRow } from './DataQualityPanelRows';

/**
 * Data Quality detail panel — shows DQ score, check definitions, and open issues.
 * Accessible from the executive dashboard or staff admin area.
 */
export default function DataQualityPanel() {
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState<Record<string, string>>({});

  const { data: score, isLoading: scoreLoading, refetch: refetchScore } = useDQScore();
  const { data: checks = [], isLoading: checksLoading, refetch: refetchChecks } = useDQChecks();
  const {
    data: issues = [],
    isLoading: issuesLoading,
    refetch: refetchIssues,
  } = useDQIssues({ status: 'open', severity: severityFilter || undefined });
  const updateIssue = useUpdateDQIssue();
  const { data: trendData = [] } = useDQScoreTrend();

  const loading = scoreLoading || checksLoading || issuesLoading;

  const handleRefresh = () => {
    refetchScore();
    refetchChecks();
    refetchIssues();
  };

  if (loading && !score) {
    return <div className="p-6 text-center text-gray-500">Loading data quality metrics...</div>;
  }

  const severityColor: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  // Severity summary counts
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      {score && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Overall Score</div>
            <div className="text-2xl font-bold text-gray-900">{score.overallScore.toFixed(1)}%</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Active Checks</div>
            <div className="text-2xl font-bold text-gray-900">{score.totalChecks}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Open Issues</div>
            <div className="text-2xl font-bold text-amber-600">{score.openIssues}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Critical Issues</div>
            <div className="text-2xl font-bold text-red-600">{score.criticalIssues}</div>
          </div>
        </div>
      )}

      {/* Score Trend */}
      {trendData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <DQScoreTrendChart data={trendData} />
        </div>
      )}

      {/* Category Scores */}
      {score && Object.keys(score.categoryScores).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Scores by Category</h3>
          <DQCategoryChart categoryScores={score.categoryScores} />
        </div>
      )}

      {/* Check Definitions — expandable */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">Check Definitions ({checks.length})</h3>
          <button
            onClick={handleRefresh}
            className="text-xs text-teal-600 hover:text-teal-800 font-medium"
          >
            Refresh
          </button>
        </div>
        <div className="space-y-1">
          {checks.map((check) => (
            <CheckRow
              key={check.checkId}
              check={check}
              expanded={expandedCheck === check.checkId}
              onToggle={() =>
                setExpandedCheck(expandedCheck === check.checkId ? null : check.checkId)
              }
              severityColor={severityColor}
            />
          ))}
        </div>
      </div>

      {/* Open Issues — with severity summary + expandable + actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700">Open Issues ({issues.length})</h3>
          <select
            className="text-xs border border-gray-200 rounded px-2 py-1"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        {/* Severity summary pills */}
        {issues.length > 0 && !severityFilter && (
          <div className="flex gap-2 mb-3">
            {criticalCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                {warningCount} Warning
              </span>
            )}
            {infoCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {infoCount} Info
              </span>
            )}
          </div>
        )}

        <div className="space-y-2">
          {issues.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">No open issues</div>
          ) : (
            issues.map((issue) => (
              <IssueRow
                key={issue.issueId}
                issue={issue}
                expanded={expandedIssue === issue.issueId}
                onToggle={() =>
                  setExpandedIssue(expandedIssue === issue.issueId ? null : issue.issueId)
                }
                severityColor={severityColor}
                resolveNote={resolveNote[issue.issueId] ?? ''}
                onResolveNoteChange={(val) =>
                  setResolveNote((prev) => ({ ...prev, [issue.issueId]: val }))
                }
                onResolve={() => {
                  updateIssue.mutate({
                    issueId: issue.issueId,
                    req: {
                      status: 'resolved',
                      resolutionNote: resolveNote[issue.issueId]?.trim() || undefined,
                    },
                  });
                  setExpandedIssue(null);
                }}
                onAcknowledge={() => {
                  updateIssue.mutate({ issueId: issue.issueId, req: { status: 'acknowledged' } });
                }}
                onDismiss={() => {
                  updateIssue.mutate({ issueId: issue.issueId, req: { status: 'false_positive' } });
                  setExpandedIssue(null);
                }}
                isMutating={updateIssue.isPending}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
