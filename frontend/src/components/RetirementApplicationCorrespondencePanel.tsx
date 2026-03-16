import CorrespondencePanel from '@/components/workflow/CorrespondencePanel';
import type { MergeFieldContext } from '@/lib/mergeFieldResolver';

interface RetirementApplicationCorrespondencePanelProps {
  memberId: number;
  caseId: string;
  caseContext: MergeFieldContext;
  onClose: () => void;
}

export default function RetirementApplicationCorrespondencePanel({
  memberId,
  caseId,
  caseContext,
  onClose,
}: RetirementApplicationCorrespondencePanelProps) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="flex-1 bg-black bg-opacity-20" onClick={onClose} />
      <div className="w-[420px] bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">Correspondence</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
            Close
          </button>
        </div>
        <div className="p-4">
          <CorrespondencePanel memberId={memberId} caseId={caseId} caseContext={caseContext} />
        </div>
      </div>
    </div>
  );
}
