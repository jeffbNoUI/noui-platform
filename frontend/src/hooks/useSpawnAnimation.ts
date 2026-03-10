import { useState, useCallback, useRef, useEffect } from 'react';

export type SpawnPhase = 'idle' | 'measuring' | 'animating' | 'open' | 'closing';

const DURATION_MS = 350;

/**
 * Manages a spawn animation from a source rect to a centered panel.
 *
 * Uses a 4-phase state machine:
 *   idle → measuring → animating → open
 *
 * The panel should use `position: fixed` and reference `panelRef`.
 */
export function useSpawnAnimation() {
  const [phase, setPhase] = useState<SpawnPhase>('idle');
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const open = useCallback(
    (rect: DOMRect) => {
      clearTimers();
      setSourceRect(rect);
      setPhase('measuring');
    },
    [clearTimers],
  );

  // When phase changes to 'measuring', schedule the transition.
  // Use a short delay to ensure the browser paints the initial position.
  useEffect(() => {
    if (phase !== 'measuring') return;

    const t1 = window.setTimeout(() => {
      setPhase('animating');
    }, 20);

    const t2 = window.setTimeout(() => {
      setPhase('open');
    }, 20 + DURATION_MS);

    timersRef.current.push(t1, t2);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  const close = useCallback(() => {
    clearTimers();
    setPhase('closing');

    const t = window.setTimeout(() => {
      setPhase('idle');
      setSourceRect(null);
    }, DURATION_MS);
    timersRef.current.push(t);
  }, [clearTimers]);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  const isVisible = phase !== 'idle';

  // In 'measuring' phase, show collapsed at source. Otherwise, expand to center.
  const isExpanded = phase === 'animating' || phase === 'open';
  const collapsedTransform = sourceRect ? computeTransform(sourceRect) : 'scale(0.8)';

  const transform = isExpanded ? 'translate(0, 0) scale(1)' : collapsedTransform;
  const opacity = isExpanded ? 1 : 0;
  const useTransition = phase !== 'measuring';

  return {
    panelRef,
    isVisible,
    phase,
    open,
    close,
    style: {
      transform,
      opacity,
      transition: useTransition
        ? `transform ${DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${DURATION_MS}ms ease`
        : 'none',
    } as React.CSSProperties,
    DURATION_MS,
  };
}

function computeTransform(sourceRect: DOMRect): string {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const panelCenterX = vw / 2;
  const panelCenterY = vh / 2;
  const sourceCenterX = sourceRect.left + sourceRect.width / 2;
  const sourceCenterY = sourceRect.top + sourceRect.height / 2;

  const dx = sourceCenterX - panelCenterX;
  const dy = sourceCenterY - panelCenterY;

  const scaleX = Math.min(sourceRect.width / (vw * 0.55), 0.95);
  const scaleY = Math.min(sourceRect.height / (vh * 0.7), 0.95);
  const scale = Math.max(scaleX, scaleY, 0.05);

  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}
