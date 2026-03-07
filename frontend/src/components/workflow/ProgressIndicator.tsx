import type { StageDescriptor } from '@/lib/workflowComposition';

interface ProgressIndicatorProps {
  stages: StageDescriptor[];
  activeIdx: number;
  completed: Set<number>;
  onNavigate: (idx: number) => void;
}

export default function ProgressIndicator({
  stages,
  activeIdx,
  completed,
  onNavigate,
}: ProgressIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => {
        const isDone = completed.has(i);
        const isActive = i === activeIdx;
        const canNavigate = isDone || i <= activeIdx;

        return (
          <div key={stage.id} className="flex items-center flex-1 min-w-0">
            {/* Stage dot + label */}
            <button
              onClick={() => canNavigate && onNavigate(i)}
              className={`group flex items-center gap-1.5 relative ${canNavigate ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {/* Dot */}
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
                  isDone
                    ? 'bg-iw-sage'
                    : isActive
                    ? 'bg-iw-sage ring-4 ring-iw-sage/20'
                    : 'bg-gray-200'
                }`}
              />
              {/* Label (visible on hover or when active) */}
              <span
                className={`text-[10px] whitespace-nowrap transition-all hidden lg:block ${
                  isActive
                    ? 'text-iw-sage font-semibold'
                    : isDone
                    ? 'text-gray-500'
                    : 'text-gray-300'
                }`}
              >
                {stage.label}
              </span>
              {/* Tooltip on small screens */}
              <div className="absolute bottom-full mb-2 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none lg:hidden z-20">
                <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                  {stage.icon} {stage.label}
                </div>
              </div>
            </button>

            {/* Connector line */}
            {i < stages.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                  isDone ? 'bg-iw-sage' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
