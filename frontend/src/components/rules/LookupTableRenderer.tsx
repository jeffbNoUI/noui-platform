import type { RuleTableRow } from '@/types/Rules';

interface LookupTableRendererProps {
  table?: RuleTableRow[];
  notes?: string[];
}

export default function LookupTableRenderer({ table, notes }: LookupTableRendererProps) {
  if (!table || table.length === 0) {
    return <p className="text-sm text-gray-500">No lookup table defined.</p>;
  }

  // Derive column headers from the values keys of the first row
  const valueKeys = Object.keys(table[0].values);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-700 font-medium">
              <th className="px-3 py-2 text-left">Key</th>
              {valueKeys.map((key) => (
                <th key={key} className="px-3 py-2 text-left">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row, i) => (
              <tr key={i} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : ''}`}>
                <td className="px-3 py-2 font-mono text-gray-700">{row.key}</td>
                {valueKeys.map((key) => (
                  <td key={key} className="px-3 py-2 text-gray-900">
                    {String(row.values[key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
