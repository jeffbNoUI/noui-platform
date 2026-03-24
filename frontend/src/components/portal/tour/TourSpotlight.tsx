import { useMemo } from 'react';
import type { TourStep } from './tourSteps';

export interface TourSpotlightProps {
  step: TourStep | null;
  children: React.ReactNode;
}

export default function TourSpotlight({ step, children }: TourSpotlightProps) {
  const targetRect = useMemo(() => {
    if (!step) return null;
    const el = document.querySelector(`[data-tour-id="${step.targetId}"]`);
    return el ? el.getBoundingClientRect() : null;
  }, [step]);

  if (!step) return null;

  return (
    <div data-testid="tour-spotlight">
      {/* Overlay backdrop */}
      <div
        data-testid="tour-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 10000,
          pointerEvents: 'none',
        }}
      />

      {/* Spotlight cutout + tooltip container */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip positioned relative to target */}
      <div
        style={{
          position: 'fixed',
          zIndex: 10001,
          ...(targetRect
            ? getTooltipPosition(targetRect, step.position)
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function getTooltipPosition(rect: DOMRect, position: string): React.CSSProperties {
  const gap = 16;
  switch (position) {
    case 'bottom':
      return { top: rect.bottom + gap, left: rect.left };
    case 'top':
      return { top: rect.top - gap, left: rect.left, transform: 'translateY(-100%)' };
    case 'right':
      return { top: rect.top, left: rect.right + gap };
    case 'left':
      return { top: rect.top, left: rect.left - gap, transform: 'translateX(-100%)' };
    default:
      return { top: rect.bottom + gap, left: rect.left };
  }
}
