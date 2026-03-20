import type { RuleTestCase, TestStatus } from '@/types/Rules';

interface RuleTestCasesProps {
  testCases: RuleTestCase[];
  testStatus?: TestStatus;
  onNavigateToDemoCase?: (caseId: string) => void;
}

export default function RuleTestCases({
  testCases,
  testStatus,
  onNavigateToDemoCase,
}: RuleTestCasesProps) {
  if (testCases.length === 0) {
    return <p className="text-sm text-gray-500">No test cases defined for this rule.</p>;
  }

  return (
    <div className="space-y-4">
      {testStatus && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600 font-medium">{testStatus.passing} passing</span>
          {testStatus.failing > 0 && (
            <span className="text-red-600 font-medium">{testStatus.failing} failing</span>
          )}
          {testStatus.skipped > 0 && (
            <span className="text-gray-500">{testStatus.skipped} skipped</span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {testCases.map((tc, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900">{tc.name}</span>
                {tc.demoCaseRef && (
                  <button
                    onClick={() => onNavigateToDemoCase?.(tc.demoCaseRef!)}
                    className="text-xs text-iw-sage hover:underline font-mono"
                  >
                    {tc.demoCaseRef}
                  </button>
                )}
              </div>
              {tc.description && <span className="text-xs text-gray-500">{tc.description}</span>}
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Inputs
                </h4>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {Object.entries(tc.inputs).map(([key, value]) => (
                    <div key={key} className="contents">
                      <span className="font-mono text-gray-500">{key}</span>
                      <span className="text-gray-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Expected
                </h4>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {Object.entries(tc.expected).map(([key, value]) => (
                    <div key={key} className="contents">
                      <span className="font-mono text-gray-500">{key}</span>
                      <span className="text-gray-900 font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
