import { useState } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { useReconExecutionMismatches } from '@/hooks/useMigrationApi';
import type { ReconExecution, RiskSeverity } from '@/types/Migration';

// ─── Priority constants (used only by execution components) ──────────────────

const EXEC_PRIORITY_COLOR: Record<RiskSeverity, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: '#F59E0B',
};

const EXEC_PRIORITY_BG: Record<RiskSeverity, string> = {
  P1: C.coralLight,
  P2: C.goldLight,
  P3: '#FEF3C7',
};

// ─── PriorityPill (private) ─────────────────────────────────────────────────

function PriorityPill({ priority, count }: { priority: RiskSeverity; count: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 700,
        color: EXEC_PRIORITY_COLOR[priority],
        background: count > 0 ? EXEC_PRIORITY_BG[priority] : 'transparent',
      }}
    >
      {count}
    </span>
  );
}

// ─── ExecutionRow ────────────────────────────────────────────────────────────

export interface ExecutionRowProps {
  exec: ReconExecution;
  engagementId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function ExecutionRow({
  exec,
  engagementId,
  isExpanded,
  onToggle,
}: ExecutionRowProps) {
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: mismatchPage } = useReconExecutionMismatches(
    engagementId,
    isExpanded ? exec.execution_id : '',
    {
      ...(priorityFilter ? { priority: priorityFilter } : {}),
      ...(entityFilter ? { entity: entityFilter } : {}),
      page,
    },
  );

  const statusColor =
    exec.status === 'COMPLETED'
      ? C.sage
      : exec.status === 'RUNNING'
        ? C.sky
        : exec.status === 'FAILED'
          ? C.coral
          : C.textSecondary;

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: `1px solid ${C.borderLight}`,
          cursor: 'pointer',
          background: isExpanded ? C.pageBg : 'transparent',
        }}
      >
        <td style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 11 }}>
          {exec.execution_id.slice(0, 8)}
        </td>
        <td style={{ padding: '8px 12px', fontFamily: MONO }}>v{exec.ruleset_version}</td>
        <td style={{ padding: '8px 12px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{exec.status}</span>
        </td>
        <td style={{ padding: '8px 12px', fontFamily: MONO, color: C.sage }}>{exec.match_count}</td>
        <td style={{ padding: '8px 12px', fontFamily: MONO, color: C.coral }}>
          {exec.mismatch_count}
        </td>
        <td style={{ padding: '8px 12px' }}>
          <PriorityPill priority="P1" count={exec.p1_count} />
        </td>
        <td style={{ padding: '8px 12px' }}>
          <PriorityPill priority="P2" count={exec.p2_count} />
        </td>
        <td style={{ padding: '8px 12px' }}>
          <PriorityPill priority="P3" count={exec.p3_count} />
        </td>
        <td style={{ padding: '8px 12px', fontSize: 11, color: C.textSecondary }}>
          {new Date(exec.started_at).toLocaleString()}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0 }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${C.border}`,
                background: C.pageBg,
              }}
            >
              {/* Mismatch filters */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                    fontSize: 12,
                    fontFamily: BODY,
                  }}
                  aria-label="Filter by priority"
                >
                  <option value="">All Priorities</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by entity..."
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                    fontSize: 12,
                    fontFamily: MONO,
                    width: 160,
                  }}
                  aria-label="Filter by entity"
                />
                {mismatchPage && (
                  <span style={{ fontSize: 11, color: C.textTertiary, marginLeft: 'auto' }}>
                    {mismatchPage.total} mismatches
                  </span>
                )}
              </div>

              {/* Mismatch table */}
              {mismatchPage && mismatchPage.mismatches.length > 0 ? (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {[
                          'Priority',
                          'Member',
                          'Entity',
                          'Field',
                          'Legacy',
                          'New',
                          'Variance',
                          'Comparison',
                          'Tolerance',
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '6px 8px',
                              textAlign:
                                h === 'Legacy' || h === 'New' || h === 'Variance'
                                  ? 'right'
                                  : 'left',
                              fontWeight: 600,
                              color: C.textSecondary,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mismatchPage.mismatches.map((m) => (
                        <tr
                          key={m.mismatch_id}
                          style={{ borderBottom: `1px solid ${C.borderLight}` }}
                        >
                          <td style={{ padding: '6px 8px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 700,
                                color: EXEC_PRIORITY_COLOR[m.priority],
                                background: EXEC_PRIORITY_BG[m.priority],
                              }}
                            >
                              {m.priority}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', fontFamily: MONO, color: C.text }}>
                            {m.member_id}
                          </td>
                          <td style={{ padding: '6px 8px', color: C.text }}>
                            {m.canonical_entity}
                          </td>
                          <td style={{ padding: '6px 8px', fontFamily: MONO, color: C.text }}>
                            {m.field_name}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontFamily: MONO,
                              color: C.textSecondary,
                            }}
                          >
                            {m.legacy_value}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontFamily: MONO,
                              color: C.text,
                            }}
                          >
                            {m.new_value}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontFamily: MONO,
                              fontWeight: 600,
                              color: C.coral,
                            }}
                          >
                            {m.variance_amount ?? '--'}
                          </td>
                          <td style={{ padding: '6px 8px', fontSize: 10, color: C.textSecondary }}>
                            {m.comparison_type}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              fontFamily: MONO,
                              color: C.textSecondary,
                            }}
                          >
                            {m.tolerance_value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  {mismatchPage.total > mismatchPage.page_size && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '8px 0',
                      }}
                    >
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: `1px solid ${C.border}`,
                          background: C.cardBg,
                          fontSize: 11,
                          cursor: page <= 1 ? 'default' : 'pointer',
                          opacity: page <= 1 ? 0.5 : 1,
                          fontFamily: BODY,
                        }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: 11, color: C.textSecondary, lineHeight: '28px' }}>
                        Page {page} of {Math.ceil(mismatchPage.total / mismatchPage.page_size)}
                      </span>
                      <button
                        onClick={() =>
                          setPage(
                            Math.min(
                              Math.ceil(mismatchPage.total / mismatchPage.page_size),
                              page + 1,
                            ),
                          )
                        }
                        disabled={page >= Math.ceil(mismatchPage.total / mismatchPage.page_size)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: `1px solid ${C.border}`,
                          background: C.cardBg,
                          fontSize: 11,
                          cursor:
                            page >= Math.ceil(mismatchPage.total / mismatchPage.page_size)
                              ? 'default'
                              : 'pointer',
                          opacity:
                            page >= Math.ceil(mismatchPage.total / mismatchPage.page_size)
                              ? 0.5
                              : 1,
                          fontFamily: BODY,
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    padding: '16px 0',
                    textAlign: 'center',
                    color: C.textSecondary,
                    fontSize: 12,
                  }}
                >
                  {exec.mismatch_count === 0
                    ? 'No mismatches — all rules passed.'
                    : 'Loading mismatches...'}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
