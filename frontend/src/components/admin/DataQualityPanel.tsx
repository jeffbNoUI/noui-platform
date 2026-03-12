import { useState } from 'react';
import { useDQScore, useDQChecks, useDQIssues, useUpdateDQIssue } from '@/hooks/useDataQuality';
import type { DQIssue, DQCheckDefinition } from '@/types/DataQuality';

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

      {/* Category Scores */}
      {score && Object.keys(score.categoryScores).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Scores by Category</h3>
          <div className="space-y-2">
            {Object.entries(score.categoryScores).map(([cat, catScore]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 capitalize">{cat}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-teal-500 rounded-full h-2"
                    style={{ width: `${Math.min(catScore, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-14 text-right">
                  {catScore.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
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

// ── Check Definition Row (expandable) ──────────────────────────────────────

function CheckRow({
  check,
  expanded,
  onToggle,
  severityColor,
}: {
  check: DQCheckDefinition;
  expanded: boolean;
  onToggle: () => void;
  severityColor: Record<string, string>;
}) {
  return (
    <div className="border border-gray-100 rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 px-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-[10px]">{expanded ? '▼' : '▶'}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor[check.severity]}`}
          >
            {check.severity}
          </span>
          <span className="text-xs text-gray-700">{check.checkName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 capitalize">{check.category}</span>
          {check.latestResult && (
            <span className="text-xs font-medium text-gray-600">
              {check.latestResult.passRate.toFixed(1)}%
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50">
          {check.description && <p className="text-xs text-gray-600 mt-2">{check.description}</p>}
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] text-gray-500">
            <span>
              Target table: <span className="font-medium text-gray-700">{check.targetTable}</span>
            </span>
            <span>
              Schedule: <span className="font-medium text-gray-700">{check.schedule}</span>
            </span>
            {check.latestResult && (
              <>
                <span>
                  Records checked:{' '}
                  <span className="font-medium text-gray-700">
                    {check.latestResult.recordsChecked}
                  </span>
                </span>
                <span>
                  Records failed:{' '}
                  <span className="font-medium text-gray-700">
                    {check.latestResult.recordsFailed}
                  </span>
                </span>
                <span>
                  Last run:{' '}
                  <span className="font-medium text-gray-700">
                    {new Date(check.latestResult.runAt).toLocaleString()}
                  </span>
                </span>
                {check.latestResult.durationMs != null && (
                  <span>
                    Duration:{' '}
                    <span className="font-medium text-gray-700">
                      {check.latestResult.durationMs}ms
                    </span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Issue Row (expandable with actions) ────────────────────────────────────

function IssueRow({
  issue,
  expanded,
  onToggle,
  severityColor,
  resolveNote,
  onResolveNoteChange,
  onResolve,
  onAcknowledge,
  onDismiss,
  isMutating,
}: {
  issue: DQIssue;
  expanded: boolean;
  onToggle: () => void;
  severityColor: Record<string, string>;
  resolveNote: string;
  onResolveNoteChange: (val: string) => void;
  onResolve: () => void;
  onAcknowledge: () => void;
  onDismiss: () => void;
  isMutating: boolean;
}) {
  return (
    <div className="border border-gray-100 rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 text-[10px] mt-0.5">{expanded ? '▼' : '▶'}</span>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor[issue.severity]}`}
                >
                  {issue.severity}
                </span>
                <span className="text-xs text-gray-700">{issue.description}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                <span>Table: {issue.recordTable}</span>
                <span>Record: {issue.recordId}</span>
                {issue.fieldName && <span>Field: {issue.fieldName}</span>}
              </div>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50">
          <div className="mt-2 space-y-1.5 text-[10px]">
            {issue.currentValue && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Current value:</span>
                <code className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                  {issue.currentValue}
                </code>
              </div>
            )}
            {issue.expectedPattern && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Expected:</span>
                <code className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                  {issue.expectedPattern}
                </code>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-500 w-20 shrink-0">Detected:</span>
              <span className="text-gray-700">{new Date(issue.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-2">
            {issue.status === 'open' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge();
                }}
                disabled={isMutating}
                className="text-[10px] px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              disabled={isMutating}
              className="text-[10px] px-2.5 py-1 rounded bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              False Positive
            </button>
          </div>

          {/* Resolve with note */}
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={resolveNote}
              onChange={(e) => onResolveNoteChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Resolution note..."
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-teal-400"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResolve();
              }}
              disabled={isMutating}
              className="text-[10px] px-2.5 py-1 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
