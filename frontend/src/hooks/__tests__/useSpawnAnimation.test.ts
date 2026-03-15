import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpawnAnimation } from '@/hooks/useSpawnAnimation';

function makeDOMRect(x = 100, y = 200, w = 300, h = 50): DOMRect {
  return {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('useSpawnAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom defaults innerWidth/innerHeight to 0; set realistic values
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle phase with isVisible=false', () => {
    const { result } = renderHook(() => useSpawnAnimation());
    expect(result.current.phase).toBe('idle');
    expect(result.current.isVisible).toBe(false);
  });

  it('open() transitions through measuring → animating → open', () => {
    const { result } = renderHook(() => useSpawnAnimation());
    const rect = makeDOMRect();

    act(() => {
      result.current.open(rect);
    });
    expect(result.current.phase).toBe('measuring');
    expect(result.current.isVisible).toBe(true);

    // Advance past both timers at once (20ms + 350ms = 370ms)
    // Must be a single act() call — otherwise effect cleanup kills t2 when t1 fires
    act(() => {
      vi.advanceTimersByTime(370);
    });
    expect(result.current.phase).toBe('open');
  });

  it('close() transitions through closing → idle', () => {
    const { result } = renderHook(() => useSpawnAnimation());

    // First open fully — advance past both timers at once
    act(() => {
      result.current.open(makeDOMRect());
    });
    act(() => {
      vi.advanceTimersByTime(370);
    });
    expect(result.current.phase).toBe('open');

    // Now close
    act(() => {
      result.current.close();
    });
    expect(result.current.phase).toBe('closing');

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.isVisible).toBe(false);
  });

  it('style includes transform from source rect in measuring phase', () => {
    const { result } = renderHook(() => useSpawnAnimation());

    act(() => {
      result.current.open(makeDOMRect(100, 200, 300, 50));
    });

    // In measuring phase: collapsed transform, no transition
    expect(result.current.style.transform).toContain('translate(');
    expect(result.current.style.transform).toContain('scale(');
    expect(result.current.style.transition).toBe('none');
  });

  it('style expands to identity transform in animating/open phase', () => {
    const { result } = renderHook(() => useSpawnAnimation());

    act(() => {
      result.current.open(makeDOMRect());
    });
    act(() => {
      vi.advanceTimersByTime(20);
    });

    // In animating phase: expanded, with transition
    expect(result.current.phase).toBe('animating');
    expect(result.current.style.transform).toBe('translate(0, 0) scale(1)');
    expect(result.current.style.opacity).toBe(1);
    expect(result.current.style.transition).toContain('350ms');
  });
});
