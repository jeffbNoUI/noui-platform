import { useState, useMemo, useCallback } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import { useAuditLog, useAuditExportCount, useExportAuditUrl } from '@/hooks/useMigrationApi';
import type { AuditLogEntry, AuditLogFilters, AuditExportFilters } from '@/types/Migration';

const MAX_EXPORT_ROWS = 50_000;
const PER_PAGE = 25;

const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
  CREATE: { color: '#16a34a', bg: '#f0fdf4' },
  UPDATE: { color: '#2563eb', bg: '#eff6ff' },
  DELETE: { color: '#dc2626', bg: '#fef2f2' },
  phase_transition: { color: '#7c3aed', bg: '#f5f3ff' },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Compute structural diff between before_state and after_state */
function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): {
  key: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  before?: unknown;
  after?: unknown;
}[] {
  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const result: {
    key: string;
    type: 'added' | 'removed' | 'changed' | 'unchanged';
    before?: unknown;
    after?: unknown;
  }[] = [];
  for (const key of Array.from(allKeys).sort()) {
    const bVal = before?.[key];
    const aVal = after?.[key];
    const bHas = before != null && key in before;
    const aHas = after != null && key in after;
    if (!bHas && aHas) {
      result.push({ key, type: 'added', after: aVal });
    } else if (bHas && !aHas) {
      result.push({ key, type: 'removed', before: bVal });
    } else if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      result.push({ key, type: 'changed', before: bVal, after: aVal });
    } else {
      result.push({ key, type: 'unchanged', before: bVal, after: aVal });
    }
  }
  return result;
}

function DiffRow({ entry }: { entry: ReturnType<typeof computeDiff>[number] }) {
  const colors = {
    added: { bg: '#f0fdf4', color: '#16a34a' },
    removed: { bg: '#fef2f2', color: '#dc2626' },
    changed: { bg: '#eff6ff', color: '#2563eb' },
    unchanged: { bg: 'transparent', color: C.textTertiary },
  };
  const style = colors[entry.type];
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '4px 8px',
        fontFamily: MONO,
        fontSize: 12,
        background: style.bg,
        borderRadius: 4,
      }}
    >
      <span style={{ color: style.color, fontWeight: 600, minWidth: 12 }}>
        {entry.type === 'added'
          ? '+'
          : entry.type === 'removed'
            ? '-'
            : entry.type === 'changed'
              ? '~'
              : ' '}
      </span>
      <span style={{ color: C.navy, fontWeight: 500, minWidth: 120 }}>{entry.key}</span>
      {entry.type === 'changed' && (
        <>
          <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>
            {JSON.stringify(entry.before)}
          </span>
          <span style={{ color: C.textTertiary }}>{'→'}</span>
          <span style={{ color: '#16a34a' }}>{JSON.stringify(entry.after)}</span>
        </>
      )}
      {entry.type === 'added' && (
        <span style={{ color: '#16a34a' }}>{JSON.stringify(entry.after)}</span>
      )}
      {entry.type === 'removed' && (
        <span style={{ color: '#dc2626' }}>{JSON.stringify(entry.before)}</span>
      )}
    </div>
  );
}

function ExpandableRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const actionStyle = ACTION_COLORS[entry.action] ?? { color: C.textSecondary, bg: C.borderLight };
  const diff = useMemo(() => computeDiff(entry.before_state, entry.after_state), [entry]);
  const changedDiff = diff.filter((d) => d.type !== 'unchanged');
  const unchangedDiff = diff.filter((d) => d.type === 'unchanged');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const hasDiff = entry.before_state != null || entry.after_state != null;

  return (
    <>
      <tr
        onClick={() => hasDiff && setExpanded(!expanded)}
        style={{
          cursor: hasDiff ? 'pointer' : 'default',
          borderBottom: `1px solid ${C.borderLight}`,
        }}
        data-testid={`audit-row-${entry.log_id}`}
      >
        <td
          style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: C.textSecondary }}
        >
          {entry.log_id.slice(0, 8)}...
        </td>
        <td style={{ padding: '10px 12px', fontSize: 13 }}>{entry.actor}</td>
        <td style={{ padding: '10px 12px' }}>
          <span
            data-testid={`action-badge-${entry.action}`}
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              color: actionStyle.color,
              background: actionStyle.bg,
            }}
          >
            {entry.action}
          </span>
        </td>
        <td style={{ padding: '10px 12px', fontSize: 13 }}>{entry.entity_type}</td>
        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 12, color: C.navyLight }}>
          {entry.entity_id.slice(0, 8)}...
        </td>
        <td
          style={{ padding: '10px 12px', fontSize: 12, color: C.textSecondary }}
          title={new Date(entry.created_at).toLocaleString()}
        >
          {formatRelativeTime(entry.created_at)}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 14, color: C.textTertiary }}>
          {hasDiff ? (expanded ? '\u25B2' : '\u25BC') : ''}
        </td>
      </tr>
      {expanded && hasDiff && (
        <tr data-testid={`audit-diff-${entry.log_id}`}>
          <td colSpan={7} style={{ padding: '8px 24px 16px', background: C.pageBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {changedDiff.map((d) => (
                <DiffRow key={d.key} entry={d} />
              ))}
              {unchangedDiff.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUnchanged(!showUnchanged);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 11,
                    color: C.textTertiary,
                    cursor: 'pointer',
                    fontFamily: BODY,
                    padding: '4px 8px',
                    textAlign: 'left',
                  }}
                >
                  {showUnchanged ? 'Hide' : 'Show'} {unchangedDiff.length} unchanged field
                  {unchangedDiff.length !== 1 ? 's' : ''}
                </button>
              )}
              {showUnchanged && unchangedDiff.map((d) => <DiffRow key={d.key} entry={d} />)}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ExportDialog({
  engagementId,
  filters,
  onClose,
}: {
  engagementId: string;
  filters: AuditExportFilters;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const { data: countData, isLoading: countLoading } = useAuditExportCount(engagementId, filters);
  const count = countData?.count ?? 0;
  const exportUrl = useExportAuditUrl(engagementId, filters, format);
  const exceedsMax = count > MAX_EXPORT_ROWS;

  return (
    <div
      data-testid="export-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 24,
          width: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ fontFamily: DISPLAY, fontSize: 18, color: C.navy, margin: '0 0 16px' }}>
          Export Audit Log
        </h3>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: C.navy,
              marginBottom: 6,
            }}
          >
            Format
          </label>
          <select
            data-testid="export-format-select"
            value={format}
            onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              fontFamily: BODY,
              fontSize: 13,
            }}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>

        <div style={{ marginBottom: 16, fontSize: 13, color: C.textSecondary }}>
          {countLoading ? (
            'Counting records...'
          ) : (
            <span data-testid="export-count">Will export {count.toLocaleString()} records</span>
          )}
        </div>

        {count > 10_000 && !exceedsMax && (
          <div
            data-testid="export-warning"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: C.goldLight,
              border: `1px solid ${C.gold}`,
              fontSize: 12,
              color: C.navy,
              marginBottom: 16,
            }}
          >
            Large export. This may take a moment.
          </div>
        )}

        {exceedsMax && (
          <div
            data-testid="export-blocked"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: C.coralLight,
              border: `1px solid ${C.coral}`,
              fontSize: 12,
              color: C.navy,
              marginBottom: 16,
            }}
          >
            Export exceeds {MAX_EXPORT_ROWS.toLocaleString()} row limit. Please narrow your filters.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'white',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Cancel
          </button>
          <a
            href={exportUrl}
            download
            onClick={exceedsMax ? (e) => e.preventDefault() : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: exceedsMax ? C.border : C.sage,
              color: exceedsMax ? C.textTertiary : 'white',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: BODY,
              cursor: exceedsMax ? 'not-allowed' : 'pointer',
              textDecoration: 'none',
              pointerEvents: exceedsMax ? 'none' : 'auto',
            }}
            data-testid="export-download-btn"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

interface Props {
  engagementId: string;
}

export default function AuditPanel({ engagementId }: Props) {
  const [entityType, setEntityType] = useState('');
  const [actor, setActor] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [showExport, setShowExport] = useState(false);

  const filters: AuditLogFilters = useMemo(
    () => ({
      ...(entityType ? { entity_type: entityType } : {}),
      ...(actor ? { actor } : {}),
      from: fromDate,
      to: toDate,
      page,
      per_page: PER_PAGE,
    }),
    [entityType, actor, fromDate, toDate, page],
  );

  const exportFilters: AuditExportFilters = useMemo(
    () => ({
      ...(entityType ? { entity_type: entityType } : {}),
      ...(actor ? { actor } : {}),
      from: fromDate,
      to: toDate,
    }),
    [entityType, actor, fromDate, toDate],
  );

  const { data, isLoading } = useAuditLog(engagementId, filters);
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Collect distinct entity types from current page for dropdown
  const entityTypes = useMemo(() => {
    const types = new Set(entries.map((e) => e.entity_type));
    return Array.from(types).sort();
  }, [entries]);

  const handleFilterChange = useCallback(() => {
    setPage(1);
  }, []);

  return (
    <div style={{ fontFamily: BODY }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h2
          style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}
        >
          Audit Trail
        </h2>
        <button
          onClick={() => setShowExport(true)}
          data-testid="export-btn"
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: `1px solid ${C.sage}`,
            background: C.sageLight,
            color: C.sage,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BODY,
          }}
        >
          Export
        </button>
      </div>

      {/* Filter bar */}
      <div
        data-testid="filter-bar"
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: 4,
            }}
          >
            Entity Type
          </label>
          <select
            data-testid="entity-type-filter"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              handleFilterChange();
            }}
            style={{
              padding: '7px 12px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              fontFamily: BODY,
              fontSize: 13,
              minWidth: 140,
            }}
          >
            <option value="">All types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: 4,
            }}
          >
            Actor
          </label>
          <input
            data-testid="actor-filter"
            type="text"
            placeholder="Search actor..."
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              handleFilterChange();
            }}
            style={{
              padding: '7px 12px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              fontFamily: BODY,
              fontSize: 13,
              width: 160,
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: 4,
            }}
          >
            From
          </label>
          <input
            data-testid="from-date-filter"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              handleFilterChange();
            }}
            style={{
              padding: '7px 12px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              fontFamily: BODY,
              fontSize: 13,
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              color: C.textSecondary,
              marginBottom: 4,
            }}
          >
            To
          </label>
          <input
            data-testid="to-date-filter"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              handleFilterChange();
            }}
            style={{
              padding: '7px 12px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              fontFamily: BODY,
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* Results table */}
      {isLoading ? (
        <div style={{ padding: 32, textAlign: 'center', color: C.textSecondary }}>
          Loading audit log...
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: C.textSecondary, fontSize: 14 }}>
          No audit entries found for the selected filters.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    ID
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Actor
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Action
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Entity Type
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Entity ID
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Time
                  </th>
                  <th style={{ padding: '10px 12px', width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <ExpandableRow key={entry.log_id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            data-testid="pagination"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              fontSize: 13,
              color: C.textSecondary,
            }}
          >
            <span>
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: 'white',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                  fontFamily: BODY,
                  fontSize: 13,
                }}
              >
                Prev
              </button>
              <span style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500 }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: 'white',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                  fontFamily: BODY,
                  fontSize: 13,
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showExport && (
        <ExportDialog
          engagementId={engagementId}
          filters={exportFilters}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
