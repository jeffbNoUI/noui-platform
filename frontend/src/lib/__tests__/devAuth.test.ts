import { describe, it, expect } from 'vitest';
import { generateDevToken, DEV_USERS } from '@/lib/devAuth';

describe('devAuth', () => {
  describe('generateDevToken', () => {
    it('produces a 3-part dot-separated JWT string', async () => {
      const token = await generateDevToken(DEV_USERS.staff);
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
      // Each part should be non-empty base64url
      for (const part of parts) {
        expect(part.length).toBeGreaterThan(0);
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('contains correct claims in the payload', async () => {
      const user = DEV_USERS.admin;
      const token = await generateDevToken(user);
      const payloadPart = token.split('.')[1];
      // base64url decode
      const padded = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(padded));

      expect(decoded.sub).toBe(user.id);
      expect(decoded.tenant_id).toBe(user.tenantId);
      expect(decoded.role).toBe(user.role);
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('includes member_id for member users', async () => {
      const user = DEV_USERS.member;
      const token = await generateDevToken(user);
      const payloadPart = token.split('.')[1];
      const padded = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(padded));

      expect(decoded.member_id).toBe(String(user.memberId));
    });

    it('sets empty member_id for non-member users', async () => {
      const user = DEV_USERS.staff;
      const token = await generateDevToken(user);
      const payloadPart = token.split('.')[1];
      const padded = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(padded));

      expect(decoded.member_id).toBe('');
    });
  });

  describe('DEV_USERS', () => {
    it('has entries for all 5 roles', () => {
      const expectedRoles = ['staff', 'admin', 'member', 'employer', 'vendor'];
      for (const role of expectedRoles) {
        expect(DEV_USERS[role]).toBeDefined();
        expect(DEV_USERS[role].role).toBe(role);
        expect(DEV_USERS[role].id).toBeTruthy();
        expect(DEV_USERS[role].tenantId).toBeTruthy();
        expect(DEV_USERS[role].name).toBeTruthy();
      }
    });

    it('member user has a memberId', () => {
      expect(DEV_USERS.member.memberId).toBeDefined();
      expect(typeof DEV_USERS.member.memberId).toBe('number');
    });
  });
});
