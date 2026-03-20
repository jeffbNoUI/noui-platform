import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useEmployerMemberSummary, useEmployerRoster } from '@/hooks/useEmployerOps';

// ── Shared styles ──────────────────────────────────────────────────────────

const sectionHeader: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: C.navy,
  margin: '0 0 12px',
};

const card: React.CSSProperties = {
  background: C.cardBg,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  padding: 20,
  marginBottom: 20,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: C.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: `1px solid ${C.border}`,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  color: C.text,
  borderBottom: `1px solid ${C.borderLight}`,
};

const summaryCard: React.CSSProperties = {
  background: C.cardBg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '12px 16px',
  minWidth: 80,
  textAlign: 'center',
};

const PAGE_SIZE = 25;

// ── Component ──────────────────────────────────────────────────────────────

interface MembersTabProps {
  orgId: string;
}

export default function MembersTab({ orgId }: MembersTabProps) {
  const [offset, setOffset] = useState(0);

  const { data: summary, isLoading: summaryLoading } = useEmployerMemberSummary(orgId);
  const { data: rosterData, isLoading: rosterLoading } = useEmployerRoster(
    orgId,
    PAGE_SIZE,
    offset,
  );

  const items = rosterData?.items ?? [];
  const pagination = rosterData?.pagination;
  const showingStart = pagination ? pagination.offset + 1 : 0;
  const showingEnd = pagination ? pagination.offset + items.length : 0;
  const total = pagination?.total ?? 0;

  return (
    <div style={{ fontFamily: BODY }}>
      {/* ── Section 1: Summary Cards ────────────────────────────── */}
      <div style={card}>
        <h3 style={sectionHeader}>Member Summary</h3>
        {summaryLoading ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>Loading summary...</div>
        ) : summary ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* Tier breakdown */}
            <div style={summaryCard}>
              <div
                style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 4 }}
              >
                Tier 1
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>
                {summary.tier1_count}
              </div>
            </div>
            <div style={summaryCard}>
              <div
                style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 4 }}
              >
                Tier 2
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>
                {summary.tier2_count}
              </div>
            </div>
            <div style={summaryCard}>
              <div
                style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 4 }}
              >
                Tier 3
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>
                {summary.tier3_count}
              </div>
            </div>
            <div style={summaryCard}>
              <div
                style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 4 }}
              >
                Total
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>
                {summary.total_members}
              </div>
            </div>

            {/* Spacer */}
            <div style={{ width: 16 }} />

            {/* Status breakdown */}
            <div style={summaryCard}>
              <div
                style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 4 }}
              >
                Active
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.sage }}>
                {summary.active_count}
              </div>
            </div>
            <div style={summaryCard}>
              <div
                style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 4 }}
              >
                Retired
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.sky }}>
                {summary.retired_count}
              </div>
            </div>
            <div style={summaryCard}>
              <div
                style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 4 }}
              >
                Terminated
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.coral }}>
                {summary.terminated_count}
              </div>
            </div>
            <div style={summaryCard}>
              <div
                style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 4 }}
              >
                Deferred
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>
                {summary.deferred_count}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.textTertiary }}>No summary data available</div>
        )}
      </div>

      {/* ── Section 2: Roster Table ─────────────────────────────── */}
      <div style={card}>
        <h3 style={sectionHeader}>Member Roster</h3>
        {rosterLoading ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>Loading roster...</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>No members found</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Member ID</th>
                    <th style={thStyle}>First Name</th>
                    <th style={thStyle}>Last Name</th>
                    <th style={thStyle}>Tier</th>
                    <th style={thStyle}>Department</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr
                      key={m.memberId}
                      style={{ transition: 'background 0.1s' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = C.pageBg;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      <td style={tdStyle}>{m.memberId}</td>
                      <td style={tdStyle}>{m.firstName}</td>
                      <td style={tdStyle}>{m.lastName}</td>
                      <td style={tdStyle}>{m.tier}</td>
                      <td style={tdStyle}>{m.dept}</td>
                      <td style={tdStyle}>
                        <span style={{ textTransform: 'capitalize' }}>{m.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <span style={{ fontSize: 12, color: C.textSecondary }}>
                  Showing {showingStart}–{showingEnd} of {total} members
                </span>
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: BODY,
                    color: offset === 0 ? C.textTertiary : C.navy,
                    background: C.cardBg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: '4px 10px',
                    cursor: offset === 0 ? 'not-allowed' : 'pointer',
                    opacity: offset === 0 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={!pagination.hasMore}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: BODY,
                    color: !pagination.hasMore ? C.textTertiary : C.navy,
                    background: C.cardBg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: '4px 10px',
                    cursor: !pagination.hasMore ? 'not-allowed' : 'pointer',
                    opacity: !pagination.hasMore ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
