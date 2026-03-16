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
  staff: { id: 'dev-staff-001', tenantId: 'dev-tenant-001', role: 'staff', name: 'Dev Staff User' },
  admin: { id: 'dev-admin-001', tenantId: 'dev-tenant-001', role: 'admin', name: 'Dev Admin' },
  member: {
    id: 'dev-member-001',
    tenantId: 'dev-tenant-001',
    role: 'member',
    name: 'Dev Member',
    memberId: 10001,
  },
  employer: {
    id: 'dev-employer-001',
    tenantId: 'dev-tenant-001',
    role: 'employer',
    name: 'Dev Employer',
  },
  vendor: { id: 'dev-vendor-001', tenantId: 'dev-tenant-001', role: 'vendor', name: 'Dev Vendor' },
};
