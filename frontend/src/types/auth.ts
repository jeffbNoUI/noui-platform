export type UserRole = 'staff' | 'member' | 'employer' | 'vendor' | 'admin';

export type ViewMode =
  | 'staff'
  | 'portal'
  | 'workspace'
  | 'crm'
  | 'employer'
  | 'employer-ops'
  | 'vendor'
  | 'retirement-app'
  | 'member-dashboard'
  | 'rules-explorer'
  | 'demo-cases'
  | 'migration-management';

export interface AuthUser {
  id: string;
  tenantId: string;
  role: UserRole;
  name: string;
  memberId?: number;
}

// Role-to-portal access mapping
export const ROLE_ACCESS: Record<UserRole, ViewMode[]> = {
  admin: [
    'staff',
    'portal',
    'workspace',
    'crm',
    'employer',
    'employer-ops',
    'vendor',
    'retirement-app',
    'member-dashboard',
    'rules-explorer',
    'demo-cases',
    'migration-management',
  ],
  staff: [
    'staff',
    'portal',
    'workspace',
    'crm',
    'retirement-app',
    'member-dashboard',
    'employer',
    'employer-ops',
    'vendor',
    'rules-explorer',
    'demo-cases',
    'migration-management',
  ],
  member: ['portal', 'member-dashboard'],
  employer: ['employer'],
  vendor: ['vendor'],
};

// Default landing page per role
export const ROLE_DEFAULT_VIEW: Record<UserRole, ViewMode> = {
  admin: 'staff',
  staff: 'staff',
  member: 'portal',
  employer: 'employer',
  vendor: 'vendor',
};

export function hasAccess(role: UserRole, viewMode: ViewMode): boolean {
  return ROLE_ACCESS[role].includes(viewMode);
}
