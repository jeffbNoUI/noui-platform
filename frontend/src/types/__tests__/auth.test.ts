import { describe, it, expect } from 'vitest';
import { hasAccess, ROLE_ACCESS, ROLE_DEFAULT_VIEW } from '@/types/auth';
import type { UserRole, ViewMode } from '@/types/auth';

const ALL_ROLES: UserRole[] = ['staff', 'member', 'employer', 'vendor', 'admin'];
const ALL_VIEWS: ViewMode[] = [
  'staff',
  'portal',
  'workspace',
  'crm',
  'employer',
  'vendor',
  'retirement-app',
  'member-dashboard',
];

describe('auth types', () => {
  describe('hasAccess', () => {
    it('admin has access to all views', () => {
      for (const view of ALL_VIEWS) {
        expect(hasAccess('admin', view)).toBe(true);
      }
    });

    it('staff has access to staff, workspace, crm, retirement-app, member-dashboard, employer, vendor', () => {
      expect(hasAccess('staff', 'staff')).toBe(true);
      expect(hasAccess('staff', 'workspace')).toBe(true);
      expect(hasAccess('staff', 'crm')).toBe(true);
      expect(hasAccess('staff', 'retirement-app')).toBe(true);
      expect(hasAccess('staff', 'member-dashboard')).toBe(true);
      expect(hasAccess('staff', 'employer')).toBe(true);
      expect(hasAccess('staff', 'vendor')).toBe(true);
      expect(hasAccess('staff', 'portal')).toBe(true);
    });

    it('member can access portal and member-dashboard only', () => {
      expect(hasAccess('member', 'portal')).toBe(true);
      expect(hasAccess('member', 'member-dashboard')).toBe(true);
      expect(hasAccess('member', 'staff')).toBe(false);
      expect(hasAccess('member', 'workspace')).toBe(false);
      expect(hasAccess('member', 'crm')).toBe(false);
    });

    it('employer can only access employer portal', () => {
      expect(hasAccess('employer', 'employer')).toBe(true);
      expect(hasAccess('employer', 'staff')).toBe(false);
      expect(hasAccess('employer', 'portal')).toBe(false);
    });

    it('vendor can only access vendor portal', () => {
      expect(hasAccess('vendor', 'vendor')).toBe(true);
      expect(hasAccess('vendor', 'staff')).toBe(false);
      expect(hasAccess('vendor', 'portal')).toBe(false);
    });
  });

  describe('ROLE_ACCESS coverage', () => {
    it('every ViewMode is accessible by at least one role', () => {
      for (const view of ALL_VIEWS) {
        const anyRoleHasAccess = ALL_ROLES.some((role) => ROLE_ACCESS[role].includes(view));
        expect(anyRoleHasAccess).toBe(true);
      }
    });

    it('ROLE_ACCESS covers all defined roles', () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_ACCESS[role]).toBeDefined();
        expect(ROLE_ACCESS[role].length).toBeGreaterThan(0);
      }
    });
  });

  describe('ROLE_DEFAULT_VIEW', () => {
    it('maps all roles to a valid ViewMode', () => {
      for (const role of ALL_ROLES) {
        const defaultView = ROLE_DEFAULT_VIEW[role];
        expect(defaultView).toBeDefined();
        expect(ALL_VIEWS).toContain(defaultView);
      }
    });

    it('default view is accessible by that role', () => {
      for (const role of ALL_ROLES) {
        const defaultView = ROLE_DEFAULT_VIEW[role];
        expect(hasAccess(role, defaultView)).toBe(true);
      }
    });
  });
});
