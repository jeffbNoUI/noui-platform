interface FormulaRendererProps {
  formula?: string;
  notes?: string[];
}

export default function FormulaRenderer({ formula, notes }: FormulaRendererProps) {
  return (
    <div className="space-y-4">
      {formula && (
        <div className="bg-gray-50 rounded-md p-3 font-mono text-sm text-gray-800 whitespace-pre-wrap border border-gray-200">
          {formula}
        </div>
      )}
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
