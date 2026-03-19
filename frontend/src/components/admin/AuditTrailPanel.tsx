import { useState, useMemo, useCallback } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useSecurityEvents } from '@/hooks/useSecurityEvents';
import type { AuditEntry, AuditEntityType, AuditEventType } from '@/types/Audit';
import type { SecurityEvent } from '@/lib/securityApi';

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

type DateRange = '24h' | '7d' | '30d' | '90d' | 'all';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7d' },
  { value: '30d', label: 'Last 30d' },
  { value: '90d', label: 'Last 90d' },
];

const PAGE_SIZE = 50;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getDateCutoff(range: DateRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  const ms: Record<Exclude<DateRange, 'all'>, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  };
  return new Date(now.getTime() - ms[range]);
}

interface UnifiedAuditEntry {
  id: string;
  source: 'CRM' | 'Security';
  eventType: string;
  entityOrActor: string;
  agentId: string;
  summary: string;
  eventTime: string;
  crmEntry?: AuditEntry;
  securityEntry?: SecurityEvent;
}

function adaptCRMEntry(e: AuditEntry): UnifiedAuditEntry {
  return {
    id: `crm-${e.auditId}`,
    source: 'CRM',
    eventType: e.eventType,
    entityOrActor: e.entityType,
    agentId: e.agentId,
    summary: e.summary,
    eventTime: e.eventTime,
    crmEntry: e,
  };
}

function adaptSecurityEntry(e: SecurityEvent): UnifiedAuditEntry {
  return {
    id: `sec-${e.id}`,
    source: 'Security',
    eventType: e.eventType,
    entityOrActor: e.actorEmail || e.actorId,
    agentId: e.actorId,
    summary: `${e.eventType} — ${e.actorEmail || e.actorId}${e.ipAddress ? ` from ${e.ipAddress}` : ''}`,
    eventTime: e.createdAt,
    securityEntry: e,
  };
}

function exportToCSV(entries: UnifiedAuditEntry[]) {
  const headers = ['Source', 'Event Time', 'Event Type', 'Entity/Actor', 'Agent', 'Summary'];
  const rows = entries.map((e) => [
    e.source,
    e.eventTime,
    e.eventType,
    e.entityOrActor,
    e.agentId,
    `"${e.summary.replace(/"/g, '""')}"`,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EntryDetail({ entry }: { entry: UnifiedAuditEntry }) {
  if (entry.crmEntry) {
    const crm = entry.crmEntry;
    return (
      <div className="mt-2 pl-4 border-l-2 border-gray-200 text-sm text-gray-600 space-y-1">
        {crm.fieldChanges &&
          Object.entries(crm.fieldChanges).map(([field, change]) => (
            <div key={field}>
              <span className="font-medium">{field}:</span>{' '}
              <span className="line-through text-red-600">{String(change.old)}</span>
              {' \u2192 '}
              <span className="text-green-700">{String(change.new)}</span>
            </div>
          ))}
        {crm.agentIp && (
          <div>
            <span className="font-medium">IP:</span> {crm.agentIp}
          </div>
        )}
        {crm.agentDevice && (
          <div>
            <span className="font-medium">Device:</span> {crm.agentDevice}
          </div>
        )}
        {crm.recordHash && (
          <div>
            <span className="font-medium">Hash:</span>{' '}
            <code className="text-xs">{crm.recordHash}</code>
          </div>
        )}
        {crm.prevAuditHash && (
          <div>
            <span className="font-medium">Prev hash:</span>{' '}
            <code className="text-xs">{crm.prevAuditHash}</code>
          </div>
        )}
      </div>
    );
  }
  if (entry.securityEntry) {
    const sec = entry.securityEntry;
    return (
      <div className="mt-2 pl-4 border-l-2 border-violet-200 text-sm text-gray-600 space-y-1">
        {sec.ipAddress && (
          <div>
            <span className="font-medium">IP:</span> {sec.ipAddress}
          </div>
        )}
        {sec.userAgent && (
          <div>
            <span className="font-medium">User Agent:</span> {sec.userAgent}
          </div>
        )}
        {sec.actorEmail && (
          <div>
            <span className="font-medium">Email:</span> {sec.actorEmail}
          </div>
        )}
      </div>
    );
  }
  return null;
}

export default function AuditTrailPanel() {
  const [entityType, setEntityType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [agentFilter, setAgentFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const params = useMemo(
    () => ({
      entity_type: entityType || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [entityType, offset],
  );

  const { data, isLoading, isError } = useAuditLog(params);
  const {
    data: secData,
    isLoading: secLoading,
    isError: secError,
  } = useSecurityEvents({ limit: PAGE_SIZE });

  const anyLoading = isLoading || secLoading;
  const bothFailed = isError && secError;

  const mergedItems = useMemo(() => {
    const crmItems = data?.items?.map(adaptCRMEntry) ?? [];
    const secItems = secData?.items?.map(adaptSecurityEntry) ?? [];
    const all = [...crmItems, ...secItems];
    all.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
    return all;
  }, [data, secData]);

  const filteredItems = useMemo(() => {
    let items = mergedItems;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter((e) => e.summary.toLowerCase().includes(term));
    }

    const cutoff = getDateCutoff(dateRange);
    if (cutoff) {
      items = items.filter((e) => new Date(e.eventTime) >= cutoff);
    }

    if (agentFilter) {
      const agent = agentFilter.toLowerCase();
      items = items.filter((e) => e.agentId.toLowerCase().includes(agent));
    }

    return items;
  }, [mergedItems, searchTerm, dateRange, agentFilter]);

  const hasMore =
    (data?.items ? data.items.length >= PAGE_SIZE : false) ||
    (secData?.items ? secData.items.length >= PAGE_SIZE : false);

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  const handleExportCSV = useCallback(() => {
    exportToCSV(filteredItems);
  }, [filteredItems]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-lg font-semibold mb-4">Audit Trail</h2>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div>
          <label htmlFor="audit-entity-type" className="block text-sm font-medium text-gray-700">
            Entity Type
          </label>
          <select
            id="audit-entity-type"
            className="mt-1 block w-full rounded border-gray-300 text-sm"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-date-range" className="block text-sm font-medium text-gray-700">
            Date Range
          </label>
          <select
            id="audit-date-range"
            className="mt-1 block w-full rounded border-gray-300 text-sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-agent-filter" className="sr-only">
            Agent Filter
          </label>
          <input
            id="audit-agent-filter"
            type="text"
            placeholder="Filter by agent..."
            className="mt-6 block w-full rounded border-gray-300 text-sm"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          />
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
        <div className="flex items-end">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={handleExportCSV}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Loading */}
      {anyLoading && <p className="text-gray-500 text-sm">Loading audit entries...</p>}

      {/* Error */}
      {bothFailed && (
        <div className="rounded bg-amber-50 border border-amber-300 p-3 text-amber-800 text-sm">
          Audit trail unavailable
        </div>
      )}

      {/* Empty */}
      {!anyLoading && !bothFailed && filteredItems.length === 0 && (
        <p className="text-gray-500 text-sm">No audit entries found</p>
      )}

      {/* Entry list */}
      {!anyLoading && !bothFailed && filteredItems.length > 0 && (
        <>
          <ul className="divide-y divide-gray-100">
            {filteredItems.map((entry) => (
              <li
                key={entry.id}
                className="py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">{formatTime(entry.eventTime)}</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[entry.eventType as AuditEventType] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {entry.eventType}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      entry.source === 'CRM'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-violet-100 text-violet-700'
                    }`}
                  >
                    {entry.source}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                    {entry.entityOrActor}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-medium">
                    {entry.agentId}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-800">{entry.summary}</p>
                {expandedId === entry.id && <EntryDetail entry={entry} />}
              </li>
            ))}
          </ul>

          {/* Load More */}
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="px-4 py-2 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={handleLoadMore}
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
