import type { RuleCondition } from '@/types/Rules';

interface ConditionalRendererProps {
  conditions: RuleCondition[];
  notes?: string[];
}

export default function ConditionalRenderer({ conditions, notes }: ConditionalRendererProps) {
  return (
    <div className="space-y-4">
      {conditions.map((cond, i) => (
        <div key={i} className="border-l-4 border-iw-sage bg-gray-50 rounded-r-md p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">
            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold mr-2">
              IF
            </span>
            {cond.condition}
          </div>
          <div className="ml-4">
            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-bold mr-2 mb-1">
              THEN
            </span>
            <div className="inline-grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {Object.entries(cond.result).map(([key, value]) => (
                <div key={key} className="contents">
                  <span className="font-mono text-gray-500">{key}:</span>
                  <span className="text-gray-900">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
          {cond.notes && cond.notes.length > 0 && (
            <div className="mt-2 space-y-1">
              {cond.notes.map((note, j) => (
                <div
                  key={j}
                  className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1"
                >
                  <span className="shrink-0">&#9888;</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
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
