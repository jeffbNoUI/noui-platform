import { useState } from 'react';
import { useIssues, useIssueStats } from '@/hooks/useIssues';
import type { Issue, IssueFilters } from '@/lib/issuesApi';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-600',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  triaged: 'bg-purple-100 text-purple-800',
  'in-work': 'bg-indigo-100 text-indigo-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function IssueManagementPanel() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build API filter params — 'all' means no filter for that field
  const filters: IssueFilters = {};
  if (statusFilter !== 'all') filters.status = statusFilter;
  if (severityFilter !== 'all') filters.severity = severityFilter;
  if (categoryFilter !== 'all') filters.category = categoryFilter;
  if (assignedFilter !== 'all') {
    filters.assigned_to = assignedFilter === 'unassigned' ? '' : assignedFilter;
  }

  const { data: issuesResult, isLoading: issuesLoading, isError: issuesError } = useIssues(filters);
  const { data: stats, isLoading: statsLoading, isError: statsError } = useIssueStats();

  const issues = issuesResult?.items ?? [];

  // Derive unique assignees from the current result set for the filter dropdown
  const uniqueAssignees = Array.from(
    new Set(issues.map((i) => i.assignedTo).filter((a): a is string => a !== null)),
  ).sort();

  // Service unavailable state
  if (issuesError && statsError) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Issue Management service unavailable. Ensure the issues service is running on port 8092.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsLoading || statsError ? (
          <>
            <StatCard label="Open Issues" value={statsLoading ? '...' : '--'} />
            <StatCard label="Critical" value={statsLoading ? '...' : '--'} />
            <StatCard label="Avg Resolution" value={statsLoading ? '...' : '--'} />
            <StatCard label="Resolved (30d)" value={statsLoading ? '...' : '--'} />
          </>
        ) : (
          <>
            <StatCard label="Open Issues" value={stats?.openCount ?? 0} />
            <StatCard label="Critical" value={stats?.criticalCount ?? 0} />
            <StatCard label="Avg Resolution" value={`${Math.round(stats?.avgResolution ?? 0)}d`} />
            <StatCard label="Resolved (30d)" value={stats?.resolvedCount ?? 0} />
          </>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="status-filter" className="mb-1 block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="triaged">Triaged</option>
            <option value="in-work">In Work</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label htmlFor="severity-filter" className="mb-1 block text-sm font-medium text-gray-700">
            Severity
          </label>
          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label htmlFor="category-filter" className="mb-1 block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="defect">Defect</option>
            <option value="incident">Incident</option>
            <option value="enhancement">Enhancement</option>
            <option value="question">Question</option>
          </select>
        </div>
        <div>
          <label htmlFor="assigned-filter" className="mb-1 block text-sm font-medium text-gray-700">
            Assigned
          </label>
          <select
            id="assigned-filter"
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="unassigned">Unassigned</option>
            {uniqueAssignees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Issue list */}
      <div className="space-y-3">
        {issuesLoading && (
          <p className="py-8 text-center text-sm text-gray-500">Loading issues...</p>
        )}
        {issuesError && !issuesLoading && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            Failed to load issues. The Issue Management service may be unavailable.
          </div>
        )}
        {!issuesLoading &&
          !issuesError &&
          issues.map((issue) => (
            <IssueRow
              key={issue.issueId}
              issue={issue}
              expanded={expandedId === issue.issueId}
              onToggle={() => setExpandedId(expandedId === issue.issueId ? null : issue.issueId)}
            />
          ))}
        {!issuesLoading && !issuesError && issues.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">
            No issues match the current filters.
          </p>
        )}
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  expanded,
  onToggle,
}: {
  issue: Issue;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Issue row header */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span className="font-mono text-sm font-semibold text-gray-500">{issue.issueId}</span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[issue.severity] ?? ''}`}
        >
          {issue.severity}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-900">{issue.title}</span>
        <span className="text-xs text-gray-500">{formatDate(issue.reportedAt)}</span>
        {issue.assignedTo && <span className="text-xs text-gray-500">{issue.assignedTo}</span>}
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[issue.status] ?? ''}`}
        >
          {issue.status}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">Description</h4>
            <p className="mt-1 text-sm text-gray-600">{issue.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Affected Service: </span>
              <span className="text-gray-600">{issue.affectedService}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Category: </span>
              <span className="text-gray-600">{issue.category}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Reported By: </span>
              <span className="text-gray-600">{issue.reportedBy}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Assigned To: </span>
              <span className="text-gray-600">{issue.assignedTo ?? 'Unassigned'}</span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700">Activity</h4>
            <ul className="mt-1 space-y-1 text-sm text-gray-600">
              <li>
                {formatDate(issue.reportedAt)} -- Reported by {issue.reportedBy} (status:{' '}
                {issue.status})
              </li>
              {issue.resolvedAt && (
                <li>
                  {formatDate(issue.resolvedAt)} -- Resolved by {issue.assignedTo}
                </li>
              )}
            </ul>
          </div>
          {issue.resolutionNote && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700">Resolution</h4>
              <p className="mt-1 text-sm text-gray-600">{issue.resolutionNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{String(value)}</p>
    </div>
  );
}
