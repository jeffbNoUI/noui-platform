import { type ReactNode, useRef, useEffect } from 'react';
import type { StageDescriptor } from '@/lib/workflowComposition';

interface OrbitViewProps {
  stages: StageDescriptor[];
  activeIdx: number;
  completed: Set<number>;
  onNavigate: (idx: number) => void;
  onAdvance: () => void;
  onPrevious: () => void;
  renderStageContent: (stageId: string) => ReactNode;
}

/**
 * Orbit navigation model: Three-zone layout.
 * Left rail = completed stages (collapsed icons), Center = active stage, Right rail = upcoming previews.
 */
export default function OrbitView({
  stages,
  activeIdx,
  completed,
  onNavigate,
  onAdvance,
  onPrevious,
  renderStageContent,
}: OrbitViewProps) {
  const centerRef = useRef<HTMLDivElement>(null);
  const isLastStage = activeIdx === stages.length - 1;

  const pastStages = stages.slice(0, activeIdx);
  const futureStages = stages.slice(activeIdx + 1);
  const activeStage = stages[activeIdx];

  // Scroll center to top on stage change
  useEffect(() => {
    centerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeIdx]);

  return (
    <div className="flex gap-0 min-h-[60vh]">
      {/* Left rail — Completed stages */}
      <div
        className="flex-shrink-0 transition-all duration-500 overflow-hidden border-r border-gray-200 bg-gray-50/50"
        style={{ width: pastStages.length > 0 ? 56 : 0 }}
      >
        <div className="p-2 space-y-2">
          {pastStages.map((stage, i) => (
            <button
              key={stage.id}
              onClick={() => onNavigate(i)}
              title={stage.label}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all ${
                completed.has(i)
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {completed.has(i) ? '\u2713' : stage.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Center — Active stage */}
      <div ref={centerRef} className="flex-1 min-w-0 overflow-auto">
        <div className="p-6">
          {/* Stage header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">{activeStage.icon}</span>
              <div>
                <h2 className="text-base font-bold text-gray-900">{activeStage.label}</h2>
                <p className="text-xs text-gray-400">
                  Step {activeIdx + 1} of {stages.length} \u00b7 {activeStage.description}
                </p>
              </div>
            </div>
          </div>

          {/* Stage content */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {renderStageContent(activeStage.id)}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4">
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
        </div>
      </div>

      {/* Right rail — Upcoming stages */}
      <div
        className="flex-shrink-0 transition-all duration-500 overflow-hidden border-l border-gray-200 bg-gray-50/50"
        style={{ width: futureStages.length > 0 ? 220 : 0 }}
      >
        <div className="p-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
            Coming Up ({futureStages.length})
          </div>
          <div className="space-y-2">
            {futureStages.map((stage, i) => {
              const globalIdx = activeIdx + 1 + i;
              const opacity = Math.max(0.4, 1 - i * 0.15);
              const isNext = i === 0;

              return (
                <div
                  key={stage.id}
                  style={{ opacity }}
                  className={`p-2.5 rounded-lg border transition-all ${
                    isNext
                      ? 'border-iw-sage/30 bg-iw-sageLight/20'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{stage.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{stage.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug pl-6 italic">
                    {stage.description}
                  </p>
                  {completed.has(globalIdx) && (
                    <button
                      onClick={() => onNavigate(globalIdx)}
                      className="text-[10px] text-iw-sage font-semibold mt-1 pl-6 hover:underline"
                    >
                      Jump to stage \u2192
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
