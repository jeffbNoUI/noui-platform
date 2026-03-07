import { useEffect, useState } from 'react';
import { dqAPI } from '@/lib/dqApi';
import type { DQIssue, DQScore, DQCheckDefinition } from '@/types/DataQuality';

/**
 * Data Quality detail panel — shows DQ score, check definitions, and open issues.
 * Accessible from the executive dashboard or staff admin area.
 */
export default function DataQualityPanel() {
  const [score, setScore] = useState<DQScore | null>(null);
  const [issues, setIssues] = useState<DQIssue[]>([]);
  const [checks, setChecks] = useState<DQCheckDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        const [scoreData, issueData, checkData] = await Promise.all([
          dqAPI.getScore(),
          dqAPI.listIssues({ status: 'open', severity: severityFilter || undefined }),
          dqAPI.listChecks(),
        ]);
        setScore(scoreData);
        setIssues(issueData || []);
        setChecks(checkData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load DQ data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [severityFilter]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading data quality metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        {error}
      </div>
    );
  }

  const severityColor = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      {score && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">Overall Score</div>
            <div className="text-2xl font-bold text-gray-900">
              {score.overallScore.toFixed(1)}%
            </div>
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

      {/* Check Definitions */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Check Definitions ({checks.length})</h3>
        <div className="space-y-2">
          {checks.map((check) => (
            <div key={check.checkId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor[check.severity]}`}>
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
            </div>
          ))}
        </div>
      </div>

      {/* Open Issues */}
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
        <div className="space-y-2">
          {issues.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">No open issues</div>
          ) : (
            issues.map((issue) => (
              <div key={issue.issueId} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor[issue.severity]}`}>
                      {issue.severity}
                    </span>
                    <span className="text-xs text-gray-700 ml-2">{issue.description}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                  <span>Table: {issue.recordTable}</span>
                  <span>Record: {issue.recordId}</span>
                  {issue.fieldName && <span>Field: {issue.fieldName}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
