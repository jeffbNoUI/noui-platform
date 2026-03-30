import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useEmployerCaseSummary, useEmployerCases } from '@/hooks/useEmployerOps';
import CreateCaseDialog from '../actions/CreateCaseDialog';

// ── Shared styles ──────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: C.cardBg,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  padding: 20,
  marginBottom: 20,
};

const sectionHeader: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: C.navy,
  margin: '0 0 12px',
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

// ── Helpers ────────────────────────────────────────────────────────────────

const SLA_COLORS: Record<string, string> = {
  'on-track': C.sage,
  'at-risk': C.gold,
  breached: C.coral,
};

function slaBadgeStyle(sla: string): React.CSSProperties {
  const color = SLA_COLORS[sla] ?? C.textSecondary;
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color,
    background:
      sla === 'on-track'
        ? C.sageLight
        : sla === 'at-risk'
          ? C.goldLight
          : sla === 'breached'
            ? C.coralLight
            : 'transparent',
    textTransform: 'capitalize',
  };
}

// ── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  count,
  highlight,
}: {
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 120,
        background: C.cardBg,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        padding: '16px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: highlight && count > 0 ? C.coral : C.navy,
          lineHeight: 1.2,
        }}
      >
        {count}
      </div>
      <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface CasesTabProps {
  orgId: string;
}

export default function CasesTab({ orgId }: CasesTabProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { data: summary, isLoading: summaryLoading } = useEmployerCaseSummary(orgId);
  const { data: casesData, isLoading: casesLoading } = useEmployerCases(orgId);

  return (
    <div style={{ fontFamily: BODY }}>
      {/* ── Section 1: Summary Cards ────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        {summaryLoading ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>Loading summary...</div>
        ) : summary ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <SummaryCard label="Total Cases" count={summary.totalCases} />
            <SummaryCard label="Active" count={summary.activeCases} />
            <SummaryCard label="Completed" count={summary.completedCases} />
            <SummaryCard label="At-Risk" count={summary.atRiskCases} highlight />
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.textTertiary }}>No summary data</div>
        )}
      </div>

      {/* ── Section 2: Case Table ───────────────────────────────── */}
      <div style={card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h3 style={{ ...sectionHeader, margin: 0 }}>Cases</h3>
          <button
            onClick={() => setShowCreateDialog(true)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontFamily: BODY,
              color: '#fff',
              background: C.sage,
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            New Case
          </button>
        </div>

        {casesLoading ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>Loading cases...</div>
        ) : (casesData?.items?.length ?? 0) === 0 ? (
          <div style={{ fontSize: 13, color: C.textTertiary }}>No cases found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>SLA</th>
                  <th style={thStyle}>Stage</th>
                  <th style={thStyle}>Assigned To</th>
                  <th style={thStyle}>Days Open</th>
                </tr>
              </thead>
              <tbody>
                {(casesData?.items ?? []).map((c) => (
                  <tr
                    key={c.caseId}
                    style={{ transition: 'background 0.1s' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = C.pageBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                    }}
                  >
                    <td style={tdStyle}>{c.caseType}</td>
                    <td style={tdStyle}>
                      <span style={{ textTransform: 'capitalize' }}>{c.status}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ textTransform: 'capitalize' }}>{c.priority}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={slaBadgeStyle(c.sla)}>{c.sla}</span>
                    </td>
                    <td style={tdStyle}>{c.stage}</td>
                    <td style={tdStyle}>{c.assignedTo || '—'}</td>
                    <td style={tdStyle}>{c.daysOpen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Case Dialog ──────────────────────────────────── */}
      {showCreateDialog && (
        <CreateCaseDialog orgId={orgId} onClose={() => setShowCreateDialog(false)} />
      )}
    </div>
  );
}
