import { C, BODY } from '@/lib/designSystem';
import type { TourStep } from './tourSteps';

export interface TourTooltipProps {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export default function TourTooltip({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: TourTooltipProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;

  return (
    <div
      data-testid="tour-tooltip"
      role="dialog"
      aria-label={step.title}
      style={{
        background: C.cardBg,
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        padding: '20px 24px',
        maxWidth: 320,
        fontFamily: BODY,
        zIndex: 10001,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 8 }}>
        {step.title}
      </div>
      <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginBottom: 16 }}>
        {step.description}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: C.textTertiary }}>
          {currentIndex + 1} of {totalSteps}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onSkip}
            data-testid="tour-skip"
            style={{
              background: 'none',
              border: 'none',
              color: C.textTertiary,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: BODY,
              padding: '6px 12px',
            }}
          >
            Skip
          </button>
          {!isFirst && (
            <button
              onClick={onPrev}
              data-testid="tour-prev"
              style={{
                background: C.cardBgWarm,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.navy,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: BODY,
                padding: '6px 16px',
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={onNext}
            data-testid="tour-next"
            style={{
              background: C.sage,
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
              padding: '6px 16px',
            }}
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
