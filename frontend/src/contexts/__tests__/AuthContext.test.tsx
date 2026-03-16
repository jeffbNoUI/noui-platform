import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import type { ViewMode } from '@/types/auth';

// Mock crypto.subtle for JWT generation in tests
const mockSign = vi.fn().mockResolvedValue(new ArrayBuffer(32));
const mockImportKey = vi.fn().mockResolvedValue('mock-key');

Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      importKey: mockImportKey,
      sign: mockSign,
    },
    randomUUID: () => 'test-uuid',
  },
  writable: true,
});

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSign.mockClear();
    mockImportKey.mockClear();
  });

  it('throws when useAuth is called outside AuthProvider', () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });

  it('defaults to staff role', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user.role).toBe('staff');
  });

  it('canAccess returns true for staff-allowed views', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.canAccess('staff')).toBe(true);
    expect(result.current.canAccess('workspace')).toBe(true);
    expect(result.current.canAccess('crm')).toBe(true);
    expect(result.current.canAccess('retirement-app')).toBe(true);
  });

  it('canAccess returns false for portal when role is staff', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.canAccess('portal')).toBe(false);
  });

  it('canAccess returns false for member-only views when role is employer', () => {
    localStorage.setItem('noui_dev_role', 'employer');
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user.role).toBe('employer');
    expect(result.current.canAccess('portal')).toBe(false);
    expect(result.current.canAccess('staff')).toBe(false);
    expect(result.current.canAccess('employer')).toBe(true);
  });

  it('switchRole changes the user and updates localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user.role).toBe('staff');

    act(() => {
      result.current.switchRole('member');
    });

    expect(result.current.user.role).toBe('member');
    expect(result.current.user.name).toBe('Dev Member');
    expect(localStorage.getItem('noui_dev_role')).toBe('member');
  });

  it('switchRole to admin grants access to all views', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.switchRole('admin');
    });

    const allViews: ViewMode[] = [
      'staff',
      'portal',
      'workspace',
      'crm',
      'employer',
      'vendor',
      'retirement-app',
      'member-dashboard',
    ];
    for (const view of allViews) {
      expect(result.current.canAccess(view)).toBe(true);
    }
  });

  it('restores saved role from localStorage', () => {
    localStorage.setItem('noui_dev_role', 'vendor');
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user.role).toBe('vendor');
  });
});
