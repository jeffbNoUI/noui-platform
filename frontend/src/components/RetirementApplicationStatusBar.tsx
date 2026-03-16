import type { StageDescriptor } from '@/lib/workflowComposition';

interface RetirementApplicationStatusBarProps {
  caseId: string;
  stages: StageDescriptor[];
  activeIdx: number;
  completed: Set<number>;
  isAdvancing: boolean;
  assignedTo: string;
}

export default function RetirementApplicationStatusBar({
  caseId,
  stages,
  activeIdx,
  completed,
  isAdvancing,
  assignedTo,
}: RetirementApplicationStatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
      <div className="mx-auto max-w-7xl px-6 py-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span className="font-mono">{caseId}</span>
          <span>{'\u00b7'}</span>
          <span>{stages[activeIdx]?.label}</span>
        </div>
        <div className="flex items-center gap-4">
          {isAdvancing && <span className="text-iw-sage animate-pulse font-medium">Saving...</span>}
          <span>Assigned: {assignedTo}</span>
          <span>{'\u00b7'}</span>
          <span className="font-mono">
            {completed.size}/{stages.length} confirmed
          </span>
          <span>{'\u00b7'}</span>
          <span className="text-[10px] text-gray-300">
            {'\u2190\u2192'} navigate {'\u00b7'} 1-{stages.length} jump {'\u00b7'} Esc back
          </span>
        </div>
      </div>
    </div>
  );
}
