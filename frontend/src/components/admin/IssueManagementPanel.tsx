import { useState } from 'react';

interface DemoIssue {
  issueId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'defect' | 'incident' | 'enhancement' | 'question';
  status: 'open' | 'triaged' | 'in-work' | 'resolved' | 'closed';
  affectedService: string;
  reportedBy: string;
  assignedTo: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

const DEMO_ISSUES: DemoIssue[] = [
  {
    issueId: 'ISS-042',
    title: 'Benefit calc rounding error for Tier 2 members',
    description:
      'Monthly benefit calculation produces values off by $0.01-$0.03 for Tier 2 members when leave payout is included in the final salary month. Root cause suspected in intermediate rounding.',
    severity: 'critical',
    category: 'defect',
    status: 'open',
    affectedService: 'Intelligence',
    reportedBy: 'mwilson',
    assignedTo: 'jsmith',
    reportedAt: '2026-03-15T09:30:00Z',
    resolvedAt: null,
    resolutionNote: null,
  },
  {
    issueId: 'ISS-041',
    title: 'Correspondence template missing merge field for employer name',
    description:
      'The retirement confirmation letter template references {{employer_name}} but the merge field mapping does not include it. Letters render with a blank employer name.',
    severity: 'high',
    category: 'defect',
    status: 'in-work',
    affectedService: 'Correspondence',
    reportedBy: 'klee',
    assignedTo: 'ajonez',
    reportedAt: '2026-03-14T14:22:00Z',
    resolvedAt: null,
    resolutionNote: null,
  },
  {
    issueId: 'ISS-040',
    title: 'DQ check false positive on salary gaps for part-time members',
    description:
      'Data quality salary-gap check flags part-time members who have legitimate zero-salary months. The check should exclude months where employment status is part-time with no scheduled hours.',
    severity: 'medium',
    category: 'defect',
    status: 'triaged',
    affectedService: 'Data Quality',
    reportedBy: 'jsmith',
    assignedTo: null,
    reportedAt: '2026-03-13T11:05:00Z',
    resolvedAt: null,
    resolutionNote: null,
  },
  {
    issueId: 'ISS-039',
    title: 'Add export button to audit trail panel',
    description:
      'Users have requested the ability to export audit trail entries to CSV for compliance reporting. Should support date range filtering in the export.',
    severity: 'low',
    category: 'enhancement',
    status: 'open',
    affectedService: 'Platform',
    reportedBy: 'ajonez',
    assignedTo: null,
    reportedAt: '2026-03-12T16:45:00Z',
    resolvedAt: null,
    resolutionNote: null,
  },
  {
    issueId: 'ISS-038',
    title: 'Case management slow query on large result sets',
    description:
      'Work queue query takes >5s when filtering by multiple stages with >1000 active cases. Missing composite index on (stage, assigned_to, updated_at).',
    severity: 'high',
    category: 'incident',
    status: 'resolved',
    affectedService: 'Case Management',
    reportedBy: 'mwilson',
    assignedTo: 'jsmith',
    reportedAt: '2026-03-10T08:15:00Z',
    resolvedAt: '2026-03-11T14:30:00Z',
    resolutionNote:
      'Added composite index on cases(stage, assigned_to, updated_at). Query time reduced from 5.2s to 45ms.',
  },
  {
    issueId: 'ISS-037',
    title: 'Member portal date picker not respecting locale',
    description:
      'Date picker component displays MM/DD/YYYY format regardless of browser locale settings. Should respect Intl.DateTimeFormat for the active locale.',
    severity: 'medium',
    category: 'defect',
    status: 'closed',
    affectedService: 'Frontend',
    reportedBy: 'klee',
    assignedTo: 'ajonez',
    reportedAt: '2026-03-08T10:00:00Z',
    resolvedAt: '2026-03-09T16:20:00Z',
    resolutionNote:
      'Replaced hardcoded date format with Intl.DateTimeFormat. Added locale-aware formatting utility.',
  },
];

const SEVERITY_STYLES: Record<DemoIssue['severity'], string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-600',
};

const STATUS_STYLES: Record<DemoIssue['status'], string> = {
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

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export default function IssueManagementPanel() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = DEMO_ISSUES.filter((issue) => {
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;
    if (assignedFilter !== 'all') {
      if (assignedFilter === 'unassigned') {
        if (issue.assignedTo !== null) return false;
      } else if (issue.assignedTo !== assignedFilter) return false;
    }
    return true;
  });

  const uniqueAssignees = Array.from(
    new Set(DEMO_ISSUES.map((i) => i.assignedTo).filter((a): a is string => a !== null)),
  ).sort();

  // Stats
  const openCount = DEMO_ISSUES.filter(
    (i) => i.status === 'open' || i.status === 'triaged' || i.status === 'in-work',
  ).length;
  const criticalCount = DEMO_ISSUES.filter((i) => i.severity === 'critical').length;
  const resolvedIssues = DEMO_ISSUES.filter(
    (i) => (i.status === 'resolved' || i.status === 'closed') && i.resolvedAt,
  );
  const avgResolution =
    resolvedIssues.length > 0
      ? Math.round(
          resolvedIssues.reduce((sum, i) => sum + daysBetween(i.reportedAt, i.resolvedAt!), 0) /
            resolvedIssues.length,
        )
      : 0;
  const resolvedCount = resolvedIssues.length;

  return (
    <div className="space-y-6">
      {/* Demo data banner */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Showing demo data. Issue management backend (Phase B) will provide live data.
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open Issues" value={openCount} />
        <StatCard label="Critical" value={criticalCount} />
        <StatCard label="Avg Resolution" value={`${avgResolution}d`} />
        <StatCard label="Resolved (30d)" value={resolvedCount} />
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
        {filtered.map((issue) => (
          <div key={issue.issueId} className="rounded-lg border border-gray-200 bg-white">
            {/* Issue row header */}
            <div
              className="flex cursor-pointer items-center gap-3 px-4 py-3"
              role="button"
              tabIndex={0}
              onClick={() => setExpandedId(expandedId === issue.issueId ? null : issue.issueId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedId(expandedId === issue.issueId ? null : issue.issueId);
                }
              }}
            >
              <span className="font-mono text-sm font-semibold text-gray-500">{issue.issueId}</span>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[issue.severity]}`}
              >
                {issue.severity}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-900">{issue.title}</span>
              <span className="text-xs text-gray-500">{formatDate(issue.reportedAt)}</span>
              {issue.assignedTo && (
                <span className="text-xs text-gray-500">{issue.assignedTo}</span>
              )}
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[issue.status]}`}
              >
                {issue.status}
              </span>
            </div>

            {/* Expanded detail */}
            {expandedId === issue.issueId && (
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
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">
            No issues match the current filters.
          </p>
        )}
      </div>
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
