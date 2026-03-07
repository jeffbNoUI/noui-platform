import { useRef, useEffect, type ReactNode } from 'react';
import type { StageDescriptor } from '@/lib/workflowComposition';
import StageCard from './StageCard';

interface ExpertViewProps {
  stages: StageDescriptor[];
  activeIdx: number;
  completed: Set<number>;
  onNavigate: (idx: number) => void;
  onAdvance: () => void;
  onPrevious: () => void;
  renderStageContent: (stageId: string) => ReactNode;
}

/**
 * Expert mode: All stages visible as a scrollable list with timeline.
 * Active stage is expanded, completed stages are collapsed but clickable.
 */
export default function ExpertView({
  stages,
  activeIdx,
  completed,
  onNavigate,
  onAdvance,
  onPrevious,
  renderStageContent,
}: ExpertViewProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const isLastStage = activeIdx === stages.length - 1;

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeIdx]);

  return (
    <div className="relative pl-10">
      {/* Timeline line */}
      <div
        className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"
        style={{
          background: `linear-gradient(180deg, rgb(var(--color-iw-sage)) ${
            ((activeIdx + 1) / stages.length) * 100
          }%, #e5e7eb ${((activeIdx + 1) / stages.length) * 100}%)`,
        }}
      />

      {stages.map((stage, i) => {
        const isActive = i === activeIdx;
        const isDone = completed.has(i);
        const isFuture = i > activeIdx && !isDone;

        return (
          <div
            key={stage.id}
            ref={isActive ? activeRef : null}
            className={`relative mb-3 transition-all duration-500 ${isFuture ? 'opacity-40' : ''}`}
          >
            {/* Timeline dot */}
            <div
              className={`absolute -left-6 w-3 h-3 rounded-full border-2 transition-all z-10 ${
                isDone
                  ? 'bg-iw-sage border-iw-sage'
                  : isActive
                  ? 'bg-iw-sage border-iw-sage shadow-[0_0_8px_rgba(var(--color-iw-sage),0.4)]'
                  : 'bg-gray-200 border-gray-200'
              }`}
              style={{ top: isActive ? '20px' : '10px' }}
            />

            <StageCard
              stage={stage}
              index={i}
              isActive={isActive}
              isDone={isDone}
              onNavigate={() => onNavigate(i)}
              actions={
                isActive ? (
                  <>
                    <button
                      onClick={onPrevious}
                      disabled={activeIdx === 0}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        activeIdx === 0
                          ? 'border-gray-200 text-gray-300 cursor-default'
                          : 'border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={onAdvance}
                      className="px-6 py-2 rounded-lg bg-iw-sage text-white font-semibold text-sm hover:bg-iw-sageDark transition-colors shadow-sm"
                    >
                      {isLastStage ? 'Complete ✓' : 'Confirm & Continue ↓'}
                    </button>
                  </>
                ) : undefined
              }
            >
              {isActive ? renderStageContent(stage.id) : null}
            </StageCard>
          </div>
        );
      })}
    </div>
  );
}
