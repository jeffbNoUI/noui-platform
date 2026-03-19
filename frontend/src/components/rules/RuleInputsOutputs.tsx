import type { RuleParam, RuleOutput } from '@/types/Rules';

interface RuleInputsOutputsProps {
  inputs: RuleParam[];
  output: RuleOutput[];
}

export default function RuleInputsOutputs({ inputs, output }: RuleInputsOutputsProps) {
  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Inputs</h3>
        {inputs.length === 0 ? (
          <p className="text-sm text-gray-500">No inputs defined.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-700 font-medium">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Constraints</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map((input) => (
                  <tr key={input.name} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-gray-800">{input.name}</td>
                    <td className="px-3 py-2 text-gray-600">
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                        {input.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{input.description}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{input.constraints || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Outputs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Outputs</h3>
        {output.length === 0 ? (
          <p className="text-sm text-gray-500">No outputs defined.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-700 font-medium">
                  <th className="px-3 py-2 text-left">Field</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                {output.map((out) => (
                  <tr key={out.field} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-gray-800">{out.field}</td>
                    <td className="px-3 py-2 text-gray-600">
                      <span className="inline-block px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                        {out.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{out.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
