import { useState, useRef, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';

export type AnimationPhase = 'closed' | 'measuring' | 'spawning' | 'open' | 'closing';

interface SpawnAnimationConfig {
  panelWidth?: number;
  panelMaxHeightVh?: number;
  durationMs?: number;
}

interface SpawnAnimationResult {
  phase: AnimationPhase;
  panelStyle: CSSProperties;
  backdropStyle: CSSProperties;
  open: (rect: DOMRect) => void;
  close: () => void;
  isVisible: boolean;
}

/** Compute the CSS transform that maps the panel center to the source rect center */
function computeSourceTransform(
  rect: DOMRect | null,
  panelWidth: number,
  panelMaxHeightVh: number,
): CSSProperties {
  if (!rect) return {};

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targetW = Math.min(panelWidth, vw - 48);
  const targetH = vh * panelMaxHeightVh;
  const targetX = (vw - targetW) / 2;
  const targetY = (vh - targetH) / 2;

  const dx = rect.left + rect.width / 2 - (targetX + targetW / 2);
  const dy = rect.top + rect.height / 2 - (targetY + targetH / 2);
  const sx = Math.max(rect.width / targetW, 0.01);
  const sy = Math.max(rect.height / targetH, 0.01);

  return {
    transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
    opacity: 0,
  };
}

export function useSpawnAnimation(config?: SpawnAnimationConfig): SpawnAnimationResult {
  const { panelWidth = 640, panelMaxHeightVh = 0.85, durationMs = 350 } = config ?? {};

  const [phase, setPhase] = useState<AnimationPhase>('closed');
  // sourceRect stored as state (not ref) so panelStyle can read it during render
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const open = useCallback(
    (rect: DOMRect) => {
      setSourceRect(rect);
      setPhase('measuring');

      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);

      rafRef.current = requestAnimationFrame(() => {
        setPhase('spawning');
        timerRef.current = setTimeout(() => setPhase('open'), durationMs);
      });
    },
    [durationMs],
  );

  const close = useCallback(() => {
    setPhase('closing');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPhase('closed'), durationMs);
  }, [durationMs]);

  const transition = `transform ${durationMs}ms cubic-bezier(0.32, 0.72, 0, 1), opacity ${durationMs}ms ease`;

  const panelStyle = useMemo((): CSSProperties => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetW = Math.min(panelWidth, vw - 48);
    const targetH = vh * panelMaxHeightVh;

    const base: CSSProperties = {
      position: 'fixed',
      left: (vw - targetW) / 2,
      top: (vh - targetH) / 2,
      width: targetW,
      maxHeight: targetH,
      transition,
      transformOrigin: 'center center',
      zIndex: 51,
    };

    if (phase === 'measuring' || phase === 'closing') {
      return { ...base, ...computeSourceTransform(sourceRect, panelWidth, panelMaxHeightVh) };
    }
    if (phase === 'spawning' || phase === 'open') {
      return { ...base, transform: 'translate(0, 0) scale(1)', opacity: 1 };
    }
    return base;
  }, [phase, sourceRect, panelWidth, panelMaxHeightVh, transition]);

  const backdropStyle = useMemo(
    (): CSSProperties => ({
      transition: `opacity ${durationMs}ms ease`,
      opacity: phase === 'spawning' || phase === 'open' ? 1 : 0,
    }),
    [phase, durationMs],
  );

  return {
    phase,
    panelStyle,
    backdropStyle,
    open,
    close,
    isVisible: phase !== 'closed',
  };
}
