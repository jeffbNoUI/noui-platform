import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProficiency } from '@/hooks/useProficiency';

describe('useProficiency', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to guided when localStorage is empty', () => {
    const { result } = renderHook(() => useProficiency());
    expect(result.current.level).toBe('guided');
  });

  it('setLevel persists to localStorage and updates state', () => {
    const { result } = renderHook(() => useProficiency());

    act(() => {
      result.current.setLevel('expert');
    });

    expect(result.current.level).toBe('expert');
    expect(localStorage.getItem('noui-proficiency-level')).toBe('expert');
  });

  it('reads persisted level on init', () => {
    localStorage.setItem('noui-proficiency-level', 'assisted');
    const { result } = renderHook(() => useProficiency());
    expect(result.current.level).toBe('assisted');
  });
});
