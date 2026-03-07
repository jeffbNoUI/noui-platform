import type { StageDescriptor, ConfidenceSignal } from '@/lib/workflowComposition';

const CONFIDENCE_STYLES: Record<ConfidenceSignal, { label: string; className: string; dot: string }> = {
  'pre-verified': {
    label: 'Pre-verified',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-400',
  },
  'needs-review': {
    label: 'Needs Review',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
  },
  'issue-found': {
    label: 'Issue Found',
    className: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-400',
  },
  pending: {
    label: 'Pending',
    className: 'bg-gray-50 text-gray-500 border-gray-200',
    dot: 'bg-gray-300',
  },
};

interface PreviewStackProps {
  stages: StageDescriptor[];
  activeIdx: number;
  completedSet: Set<number>;
  onNavigate: (idx: number) => void;
}

export default function PreviewStack({
  stages,
  activeIdx,
  completedSet,
  onNavigate,
}: PreviewStackProps) {
  // Show upcoming stages (after active)
  const upcomingStages = stages
    .map((s, i) => ({ ...s, originalIdx: i }))
    .filter((_, i) => i > activeIdx);

  if (upcomingStages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-2xl mb-2">✅</div>
          <div className="text-sm text-gray-500 font-medium">All stages reviewed</div>
          <div className="text-xs text-gray-400 mt-1">Ready for certification</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
        Coming Up ({upcomingStages.length})
      </div>

      {upcomingStages.map((stage, stackIdx) => {
        const conf = CONFIDENCE_STYLES[stage.confidence];
        const isDone = completedSet.has(stage.originalIdx);
        // Progressive opacity for depth effect
        const opacity = Math.max(0.4, 1 - stackIdx * 0.15);

        return (
          <div
            key={stage.id}
            onClick={() => isDone && onNavigate(stage.originalIdx)}
            style={{ opacity }}
            className={`p-3 rounded-lg border transition-all ${
              isDone
                ? 'border-emerald-200 bg-emerald-50/30 cursor-pointer hover:shadow-sm'
                : stackIdx === 0
                ? 'border-iw-sage/30 bg-white shadow-sm'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">{stage.icon}</span>
                <span className="text-xs font-medium text-gray-700">{stage.label}</span>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${conf.className}`}>
                {conf.label}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 leading-snug pl-6">
              {stage.description}
            </div>
            {/* Confidence dot indicator */}
            <div className="flex items-center gap-1.5 mt-2 pl-6">
              <div className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
              <span className="text-[10px] text-gray-400">{conf.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
