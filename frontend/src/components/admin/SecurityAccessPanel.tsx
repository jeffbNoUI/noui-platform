import { ROLE_ACCESS, type UserRole, type ViewMode } from '@/types/auth';

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

/** Capitalize first letter of each word, replace hyphens with spaces */
function formatLabel(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, badge }: { label: string; value?: string; badge?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      {badge ? (
        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">
          {badge}
        </span>
      ) : (
        <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SecurityAccessPanel() {
  const portalCount = ALL_VIEW_MODES.length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Roles Defined" value={String(ROLES.length)} />
        <StatCard label="Portals" value={String(portalCount)} />
        <StatCard label="Active Users" badge="Phase B" />
        <StatCard label="Sessions" badge="Phase B" />
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

      {/* Security Events - Phase B */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Security Events</h3>
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">
            Phase B
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Security event monitoring is planned for Phase B. Upcoming capabilities include failed
          login monitoring, role change tracking, and session management.
        </p>
      </div>
    </div>
  );
}
