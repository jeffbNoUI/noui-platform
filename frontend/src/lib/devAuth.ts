// Dev-mode auth utilities — generates JWTs using the backend's default dev secret.
// In production, this would be replaced by Clerk token management.

import type { AuthUser } from '@/types/auth';

const DEV_SECRET = 'dev-secret-do-not-use-in-production';

// Simple base64url encoding (no padding)
function base64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generate an HS256 JWT for dev mode
export async function generateDevToken(user: AuthUser): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
      member_id: user.memberId ? String(user.memberId) : '',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    }),
  );

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(DEV_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${header}.${payload}.${sig}`;
}

// Default dev users for each role
export const DEV_USERS: Record<string, AuthUser> = {
  staff: {
    id: 'dev-staff-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    role: 'staff',
    name: 'Dev Staff User',
  },
  admin: {
    id: 'dev-admin-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    role: 'admin',
    name: 'Dev Admin',
  },
  member: {
    id: 'dev-member-active-near',
    tenantId: '00000000-0000-0000-0000-000000000001',
    role: 'member',
    name: 'Robert Martinez',
    memberId: 10001,
  },
  employer: {
    id: 'dev-employer-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    role: 'employer',
    name: 'Dev Employer',
  },
  vendor: {
    id: 'dev-vendor-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    role: 'vendor',
    name: 'Dev Vendor',
  },
};

// Member persona accounts for dev mode — each maps to a different member ID
export interface DevMemberAccount {
  id: string;
  role: 'member';
  label: string;
  memberId: number;
  name: string;
}

export const DEV_MEMBER_ACCOUNTS: DevMemberAccount[] = [
  {
    id: 'dev-member-active-near',
    role: 'member',
    label: 'Active (near retirement)',
    memberId: 10001,
    name: 'Robert Martinez',
  },
  {
    id: 'dev-member-active-early',
    role: 'member',
    label: 'Active (early career)',
    memberId: 10002,
    name: 'Jennifer Kim',
  },
  {
    id: 'dev-member-inactive-vested',
    role: 'member',
    label: 'Inactive (vested)',
    memberId: 10003,
    name: 'David Washington',
  },
  {
    id: 'dev-member-inactive-novest',
    role: 'member',
    label: 'Inactive (not vested)',
    memberId: 10009,
    name: "Thomas O'Brien",
  },
  {
    id: 'dev-member-retiree',
    role: 'member',
    label: 'Retiree',
    memberId: 10006,
    name: 'Maria Santos',
  },
  {
    id: 'dev-member-survivor',
    role: 'member',
    label: 'Survivor beneficiary',
    memberId: 10011,
    name: 'Richard Chen',
  },
  {
    id: 'dev-member-deathben',
    role: 'member',
    label: 'Death benefit recipient',
    memberId: 10012,
    name: 'Patricia Moore',
  },
  {
    id: 'dev-member-dual',
    role: 'member',
    label: 'Dual role (member + beneficiary)',
    memberId: 10010,
    name: 'Angela Davis',
  },
];

// Convert a DEV_MEMBER_ACCOUNT to an AuthUser
export function memberAccountToAuthUser(account: DevMemberAccount): AuthUser {
  return {
    id: account.id,
    tenantId: '00000000-0000-0000-0000-000000000001',
    role: account.role,
    name: account.name,
    memberId: account.memberId,
  };
}
