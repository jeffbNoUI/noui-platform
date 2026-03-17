import { useState, useMemo } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { AuditEntry, AuditEntityType, AuditEventType } from '@/types/Audit';

const ENTITY_TYPES: AuditEntityType[] = [
  'Contact',
  'Conversation',
  'Interaction',
  'Commitment',
  'Outreach',
  'Organization',
];

const EVENT_TYPE_COLORS: Record<AuditEventType, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  TRANSITION: 'bg-purple-100 text-purple-800',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function EntryDetail({ entry }: { entry: AuditEntry }) {
  return (
    <div className="mt-2 pl-4 border-l-2 border-gray-200 text-sm text-gray-600 space-y-1">
      {entry.fieldChanges &&
        Object.entries(entry.fieldChanges).map(([field, change]) => (
          <div key={field}>
            <span className="font-medium">{field}:</span>{' '}
            <span className="line-through text-red-600">{String(change.old)}</span>
            {' \u2192 '}
            <span className="text-green-700">{String(change.new)}</span>
          </div>
        ))}
      {entry.agentIp && (
        <div>
          <span className="font-medium">IP:</span> {entry.agentIp}
        </div>
      )}
      {entry.agentDevice && (
        <div>
          <span className="font-medium">Device:</span> {entry.agentDevice}
        </div>
      )}
      {entry.recordHash && (
        <div>
          <span className="font-medium">Hash:</span>{' '}
          <code className="text-xs">{entry.recordHash}</code>
        </div>
      )}
      {entry.prevAuditHash && (
        <div>
          <span className="font-medium">Prev hash:</span>{' '}
          <code className="text-xs">{entry.prevAuditHash}</code>
        </div>
      )}
    </div>
  );
}

export default function AuditTrailPanel() {
  const [entityType, setEntityType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params = useMemo(
    () => ({
      entity_type: entityType || undefined,
      limit: 50,
    }),
    [entityType],
  );

  const { data, isLoading, isError } = useAuditLog(params);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm) return data.items;
    const term = searchTerm.toLowerCase();
    return data.items.filter((e) => e.summary.toLowerCase().includes(term));
  }, [data, searchTerm]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-lg font-semibold mb-4">Audit Trail</h2>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4">
        <div>
          <label htmlFor="audit-entity-type" className="block text-sm font-medium text-gray-700">
            Entity Type
          </label>
          <select
            id="audit-entity-type"
            className="mt-1 block w-full rounded border-gray-300 text-sm"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="audit-search" className="sr-only">
            Search
          </label>
          <input
            id="audit-search"
            type="text"
            placeholder="Search..."
            className="mt-6 block w-full rounded border-gray-300 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && <p className="text-gray-500 text-sm">Loading audit entries...</p>}

      {/* Error */}
      {isError && (
        <div className="rounded bg-amber-50 border border-amber-300 p-3 text-amber-800 text-sm">
          Audit trail unavailable
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filteredItems.length === 0 && (
        <p className="text-gray-500 text-sm">No audit entries found</p>
      )}

      {/* Entry list */}
      {!isLoading && !isError && filteredItems.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {filteredItems.map((entry) => (
            <li
              key={entry.auditId}
              className="py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(expandedId === entry.auditId ? null : entry.auditId)}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">{formatTime(entry.eventTime)}</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[entry.eventType]}`}
                >
                  {entry.eventType}
                </span>
                <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                  {entry.entityType}
                </span>
                <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-medium">
                  {entry.agentId}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-800">{entry.summary}</p>
              {expandedId === entry.auditId && <EntryDetail entry={entry} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
