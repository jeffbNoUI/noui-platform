interface ProceduralRendererProps {
  steps?: string[];
  notes?: string[];
}

export default function ProceduralRenderer({ steps, notes }: ProceduralRendererProps) {
  if (!steps || steps.length === 0) {
    return <p className="text-sm text-gray-500">No procedural steps defined.</p>;
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-iw-sage text-white text-xs font-bold">
              {i + 1}
            </span>
            <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-800 flex-1 border border-gray-200">
              {step}
            </div>
          </li>
        ))}
      </ol>
      {notes && notes.length > 0 && (
        <div className="space-y-1">
          {notes.map((note, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1"
            >
              <span className="shrink-0">&#9888;</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
