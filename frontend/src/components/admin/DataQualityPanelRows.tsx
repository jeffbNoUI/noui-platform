import type { DQIssue, DQCheckDefinition } from '@/types/DataQuality';

// ── Check Definition Row (expandable) ──────────────────────────────────────

export function CheckRow({
  check,
  expanded,
  onToggle,
  severityColor,
}: {
  check: DQCheckDefinition;
  expanded: boolean;
  onToggle: () => void;
  severityColor: Record<string, string>;
}) {
  return (
    <div className="border border-gray-100 rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 px-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-[10px]">{expanded ? '\u25BC' : '\u25B6'}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor[check.severity]}`}
          >
            {check.severity}
          </span>
          <span className="text-xs text-gray-700">{check.checkName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400 capitalize">{check.category}</span>
          {check.latestResult && (
            <span className="text-xs font-medium text-gray-600">
              {check.latestResult.passRate.toFixed(1)}%
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50">
          {check.description && <p className="text-xs text-gray-600 mt-2">{check.description}</p>}
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] text-gray-500">
            <span>
              Target table: <span className="font-medium text-gray-700">{check.targetTable}</span>
            </span>
            <span>
              Schedule: <span className="font-medium text-gray-700">{check.schedule}</span>
            </span>
            {check.latestResult && (
              <>
                <span>
                  Records checked:{' '}
                  <span className="font-medium text-gray-700">
                    {check.latestResult.recordsChecked}
                  </span>
                </span>
                <span>
                  Records failed:{' '}
                  <span className="font-medium text-gray-700">
                    {check.latestResult.recordsFailed}
                  </span>
                </span>
                <span>
                  Last run:{' '}
                  <span className="font-medium text-gray-700">
                    {new Date(check.latestResult.runAt).toLocaleString()}
                  </span>
                </span>
                {check.latestResult.durationMs != null && (
                  <span>
                    Duration:{' '}
                    <span className="font-medium text-gray-700">
                      {check.latestResult.durationMs}ms
                    </span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Issue Row (expandable with actions) ────────────────────────────────────

export function IssueRow({
  issue,
  expanded,
  onToggle,
  severityColor,
  resolveNote,
  onResolveNoteChange,
  onResolve,
  onAcknowledge,
  onDismiss,
  isMutating,
}: {
  issue: DQIssue;
  expanded: boolean;
  onToggle: () => void;
  severityColor: Record<string, string>;
  resolveNote: string;
  onResolveNoteChange: (val: string) => void;
  onResolve: () => void;
  onAcknowledge: () => void;
  onDismiss: () => void;
  isMutating: boolean;
}) {
  return (
    <div className="border border-gray-100 rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 text-[10px] mt-0.5">
              {expanded ? '\u25BC' : '\u25B6'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor[issue.severity]}`}
                >
                  {issue.severity}
                </span>
                <span className="text-xs text-gray-700">{issue.description}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                <span>Table: {issue.recordTable}</span>
                <span>Record: {issue.recordId}</span>
                {issue.fieldName && <span>Field: {issue.fieldName}</span>}
              </div>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50">
          <div className="mt-2 space-y-1.5 text-[10px]">
            {issue.currentValue && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Current value:</span>
                <code className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                  {issue.currentValue}
                </code>
              </div>
            )}
            {issue.expectedPattern && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Expected:</span>
                <code className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                  {issue.expectedPattern}
                </code>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-500 w-20 shrink-0">Detected:</span>
              <span className="text-gray-700">{new Date(issue.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-2">
            {issue.status === 'open' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge();
                }}
                disabled={isMutating}
                className="text-[10px] px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              disabled={isMutating}
              className="text-[10px] px-2.5 py-1 rounded bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              False Positive
            </button>
          </div>

          {/* Resolve with note */}
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={resolveNote}
              onChange={(e) => onResolveNoteChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Resolution note..."
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-teal-400"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResolve();
              }}
              disabled={isMutating}
              className="text-[10px] px-2.5 py-1 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
