interface StageCorrespondencePromptProps {
  stageName: string;
  templateCategory: string;
  onGenerate: () => void;
  onSkip: () => void;
}

/**
 * Banner that appears after a workflow stage completes, prompting the user
 * to generate the corresponding letter template for that stage.
 */
export default function StageCorrespondencePrompt({
  stageName,
  templateCategory,
  onGenerate,
  onSkip,
}: StageCorrespondencePromptProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 mb-4">
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-teal-200 bg-teal-50">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-teal-800">
            Stage &ldquo;{stageName}&rdquo; complete. Generate correspondence?
          </div>
          <div className="text-[10px] text-teal-600 mt-0.5">
            A <span className="font-medium">{templateCategory}</span> letter template is available
            for this stage.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onGenerate}
            className="px-3 py-1.5 text-xs font-medium rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Generate Letter
          </button>
          <button
            onClick={onSkip}
            className="px-3 py-1.5 text-xs font-medium rounded border border-teal-300 text-teal-700 hover:bg-teal-100 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
