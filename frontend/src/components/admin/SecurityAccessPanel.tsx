import { useState } from 'react';
import { ROLE_ACCESS, type UserRole, type ViewMode } from '@/types/auth';
import {
  useSecurityEventStats,
  useSecurityEvents,
  type SecurityEventFilters,
} from '@/hooks/useSecurityEvents';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = Object.keys(ROLE_ACCESS) as UserRole[];

const ALL_VIEW_MODES: ViewMode[] = [
  'staff',
  'portal',
  'workspace',
  'crm',
  'employer',
  'vendor',
  'retirement-app',
  'member-dashboard',
];

const ROLE_DESCRIPTIONS: Record<UserRole, { permissions: string }> = {
  admin: { permissions: 'Full access' },
  staff: { permissions: 'Cases, calculations, CRM' },
  member: { permissions: 'Read-only self-service' },
  employer: { permissions: 'Employer submissions' },
  vendor: { permissions: 'Queue management' },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  login_success: 'Login Success',
  login_failure: 'Login Failure',
  role_change: 'Role Change',
  session_start: 'Session Start',
  session_end: 'Session End',
  password_reset: 'Password Reset',
};

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Events' },
  { value: 'login_success', label: 'Login Success' },
  { value: 'login_failure', label: 'Login Failure' },
  { value: 'role_change', label: 'Role Change' },
  { value: 'session_start', label: 'Session Start' },
  { value: 'session_end', label: 'Session End' },
  { value: 'password_reset', label: 'Password Reset' },
];

/** Capitalize first letter of each word, replace hyphens with spaces */
function formatLabel(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatEventType(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] || eventType;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  badge,
  loading,
}: {
  label: string;
  value?: string;
  badge?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      {badge ? (
        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">
          {badge}
        </span>
      ) : loading ? (
        <div className="h-8 mt-1 w-16 bg-gray-100 animate-pulse rounded" />
      ) : (
        <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SecurityAccessPanel() {
  const portalCount = ALL_VIEW_MODES.length;

  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const filters: SecurityEventFilters = {
    ...(eventTypeFilter ? { event_type: eventTypeFilter } : {}),
    limit: 20,
  };

  const statsQuery = useSecurityEventStats();
  const eventsQuery = useSecurityEvents(filters);

  const stats = statsQuery.data;
  const events = eventsQuery.data?.items ?? [];
  const statsUnavailable = statsQuery.isError;
  const eventsUnavailable = eventsQuery.isError;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Roles Defined" value={String(ROLES.length)} />
        <StatCard label="Portals" value={String(portalCount)} />
        <StatCard
          label="Active Users"
          value={statsUnavailable ? '--' : String(stats?.activeUsers ?? 0)}
          loading={statsQuery.isLoading}
        />
        <StatCard
          label="Sessions"
          value={statsUnavailable ? '--' : String(stats?.activeSessions ?? 0)}
          loading={statsQuery.isLoading}
        />
      </div>

      {/* Role Definitions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Role Definitions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Portals
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Portal List
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Key Permissions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ROLES.map((role) => {
                const portals = ROLE_ACCESS[role];
                const portalList =
                  portals.length === ALL_VIEW_MODES.length
                    ? 'All'
                    : portals.map(formatLabel).join(', ');
                return (
                  <tr key={role}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{role}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{portals.length}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{portalList}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {ROLE_DESCRIPTIONS[role].permissions}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access Matrix */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Access Matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                {ALL_VIEW_MODES.map((mode) => (
                  <th
                    key={mode}
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500"
                  >
                    {formatLabel(mode)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ROLES.map((role) => (
                <tr key={role}>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    {formatLabel(role)}
                  </td>
                  {ALL_VIEW_MODES.map((mode) => {
                    const hasAccess = ROLE_ACCESS[role].includes(mode);
                    return (
                      <td key={mode} className="px-3 py-2 text-center text-sm">
                        {hasAccess ? (
                          <span
                            className="text-green-600 font-medium"
                            aria-label={`${role} has ${mode} access`}
                          >
                            &#x2713;
                          </span>
                        ) : (
                          <span className="text-gray-300" aria-label={`${role} no ${mode} access`}>
                            &#x2717;
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Events */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Security Events</h3>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-700"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {eventsUnavailable ? (
          <div className="p-4">
            <p className="text-sm text-gray-500">
              Security event data is currently unavailable. The security service may be offline.
            </p>
          </div>
        ) : eventsQuery.isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="p-4">
            <p className="text-sm text-gray-500">No security events recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Event
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    IP Address
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {formatEventType(event.eventType)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{event.actorEmail}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 font-mono text-xs">
                      {event.ipAddress}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {formatTimestamp(event.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
