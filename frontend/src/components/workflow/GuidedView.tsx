import type { ReactNode } from 'react';
import type { StageDescriptor } from '@/lib/workflowComposition';
import StageCard from './StageCard';
import PreviewStack from './PreviewStack';

interface GuidedViewProps {
  stages: StageDescriptor[];
  activeIdx: number;
  completed: Set<number>;
  onNavigate: (idx: number) => void;
  onAdvance: () => void;
  onPrevious: () => void;
  renderStageContent: (stageId: string) => ReactNode;
  /** Optional contextual help panel rendered in the right column */
  helpPanel?: ReactNode;
}

/**
 * Guided mode: 70/30 card-stack layout.
 * Active stage takes 70% left, preview stack takes 30% right.
 */
export default function GuidedView({
  stages,
  activeIdx,
  completed,
  onNavigate,
  onAdvance,
  onPrevious,
  renderStageContent,
  helpPanel,
}: GuidedViewProps) {
  const activeStage = stages[activeIdx];
  const isLastStage = activeIdx === stages.length - 1;

  return (
    <div className="flex gap-6 min-h-[60vh]">
      {/* Left panel — Active stage (70%) */}
      <div className="flex-[7] min-w-0">
        <StageCard
          stage={activeStage}
          index={activeIdx}
          isActive={true}
          isDone={false}
          actions={
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
                {isLastStage ? 'Complete ✓' : 'Confirm & Continue →'}
              </button>
            </>
          }
        >
          {renderStageContent(activeStage.id)}
        </StageCard>

        {/* Completed stages summary (collapsed) */}
        {activeIdx > 0 && (
          <div className="mt-4 space-y-1">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
              Completed ({completed.size})
            </div>
            {stages.slice(0, activeIdx).map((stage, i) => (
              <StageCard
                key={stage.id}
                stage={stage}
                index={i}
                isActive={false}
                isDone={completed.has(i)}
                onNavigate={() => onNavigate(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right panel — Help + Preview stack (30%) */}
      <div className="flex-[3] min-w-[240px] max-w-[320px]">
        <div className="sticky top-6 space-y-4">
          {helpPanel}
          <PreviewStack
            stages={stages}
            activeIdx={activeIdx}
            completedSet={completed}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}
