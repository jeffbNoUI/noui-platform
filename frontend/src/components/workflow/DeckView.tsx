import { type ReactNode, useRef, useEffect } from 'react';
import type { StageDescriptor } from '@/lib/workflowComposition';

interface DeckViewProps {
  stages: StageDescriptor[];
  activeIdx: number;
  completed: Set<number>;
  onNavigate: (idx: number) => void;
  onAdvance: () => void;
  onPrevious: () => void;
  renderStageContent: (stageId: string) => ReactNode;
}

/**
 * Deck navigation model: Card stack with depth parallax.
 * Active card is centered; future cards peek from the right with decreasing scale/opacity.
 */
export default function DeckView({
  stages,
  activeIdx,
  completed,
  onNavigate,
  onAdvance,
  onPrevious,
  renderStageContent,
}: DeckViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isLastStage = activeIdx === stages.length - 1;

  // Scroll to top on stage change
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeIdx]);

  // Render up to 3 visible cards (active + next 2)
  const visibleRange = stages
    .map((s, i) => ({ stage: s, idx: i, offset: i - activeIdx }))
    .filter(({ offset }) => offset >= -1 && offset <= 2);

  return (
    <div className="space-y-4">
      {/* Progress segments */}
      <div className="flex gap-1">
        {stages.map((stage, i) => (
          <button
            key={stage.id}
            onClick={() => (completed.has(i) || i <= activeIdx) && onNavigate(i)}
            className={`h-2 flex-1 rounded-full transition-all ${
              completed.has(i)
                ? 'bg-iw-sage'
                : i === activeIdx
                ? 'bg-iw-sage animate-pulse'
                : 'bg-gray-200'
            } ${completed.has(i) || i <= activeIdx ? 'cursor-pointer' : 'cursor-default'}`}
          />
        ))}
      </div>

      {/* Card stack area */}
      <div ref={containerRef} className="relative min-h-[60vh]">
        {visibleRange.map(({ stage, idx, offset }) => {
          const isActive = offset === 0;
          const isPast = offset < 0;

          // Deck parallax transforms
          const translateX = isPast ? -60 : offset * 50;
          const scale = isPast ? 0.92 : Math.max(0.86, 1 - offset * 0.07);
          const opacity = isPast ? 0 : Math.max(0.4, 1 - offset * 0.3);
          const zIndex = 10 - Math.abs(offset);

          return (
            <div
              key={stage.id}
              className="absolute inset-0 transition-all duration-500"
              style={{
                transform: `translateX(${translateX}px) scale(${scale})`,
                opacity,
                zIndex,
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div
                className={`h-full rounded-xl border-2 bg-white overflow-auto ${
                  isActive
                    ? 'border-iw-sage shadow-lg shadow-iw-sage/10'
                    : 'border-gray-200 shadow-md'
                }`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{stage.icon}</span>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">{stage.label}</h2>
                      <p className="text-[10px] text-gray-400">
                        Step {idx + 1} of {stages.length}
                      </p>
                    </div>
                  </div>
                  {completed.has(idx) && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      Confirmed
                    </span>
                  )}
                </div>

                {/* Card content */}
                <div className="px-6 py-4">{renderStageContent(stage.id)}</div>

                {/* Card actions */}
                {isActive && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                      onClick={onPrevious}
                      disabled={activeIdx === 0}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        activeIdx === 0
                          ? 'border-gray-200 text-gray-300 cursor-default'
                          : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      \u2190 Previous
                    </button>
                    <button
                      onClick={onAdvance}
                      className="px-6 py-2 rounded-lg bg-iw-sage text-white font-semibold text-sm hover:bg-iw-sageDark transition-colors shadow-sm"
                    >
                      {isLastStage ? 'Complete \u2713' : 'Confirm & Continue \u2192'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
