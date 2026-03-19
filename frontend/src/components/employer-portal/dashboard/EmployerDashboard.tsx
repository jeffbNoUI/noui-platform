import { C, BODY } from '@/lib/designSystem';
import { useEmployerDashboard, useCurrentRate } from '@/hooks/useEmployerPortal';

interface EmployerDashboardProps {
  orgId: string;
  divisionCode?: string;
}

interface SummaryCardProps {
  label: string;
  value: number;
  color: string;
}

function SummaryCard({ label, value, color }: SummaryCardProps) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '20px 24px',
        flex: '1 1 0',
        minWidth: 180,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: C.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color, marginTop: 8 }}>{value}</div>
    </div>
  );
}

export default function EmployerDashboard({ orgId, divisionCode }: EmployerDashboardProps) {
  const { data: dashboard, isLoading } = useEmployerDashboard(orgId);
  const { data: currentRate } = useCurrentRate(divisionCode ?? '', false);

  if (isLoading) {
    return (
      <div style={{ fontFamily: BODY, color: C.textSecondary, padding: 24 }}>
        Loading dashboard...
      </div>
    );
  }

  const summary = dashboard ?? {
    pendingExceptions: 0,
    unresolvedTasks: 0,
    recentSubmissions: 0,
    activeAlerts: 0,
  };

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <SummaryCard label="Pending Exceptions" value={summary.pendingExceptions} color={C.coral} />
        <SummaryCard label="Unresolved Tasks" value={summary.unresolvedTasks} color={C.gold} />
        <SummaryCard label="Recent Submissions" value={summary.recentSubmissions} color={C.sage} />
        <SummaryCard label="Active Alerts" value={summary.activeAlerts} color={C.sky} />
      </div>

      {/* Rate Table Section */}
      {currentRate && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 12px' }}>
            Current Contribution Rates
          </h3>
          <div
            style={{
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 20,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={thStyle}>Rate Type</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                <RateRow label="Member Rate" value={currentRate.memberRate} />
                <RateRow label="Employer Base Rate" value={currentRate.employerBaseRate} />
                <RateRow label="AED Rate" value={currentRate.aedRate} />
                <RateRow label="SAED Rate" value={currentRate.saedRate} />
                <RateRow label="AAP Rate" value={currentRate.aapRate} />
                <RateRow label="DC Supplement Rate" value={currentRate.dcSupplementRate} />
                <RateRow label="Employer Total Rate" value={currentRate.employerTotalRate} bold />
                <RateRow label="Health Care Trust Rate" value={currentRate.healthCareTrustRate} />
              </tbody>
            </table>
            <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 12 }}>
              Effective from {currentRate.effectiveFrom}
              {currentRate.boardResolutionRef &&
                ` | Board Resolution: ${currentRate.boardResolutionRef}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 12,
  color: C.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 500,
};

function RateRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const pct = (parseFloat(value) * 100).toFixed(2) + '%';
  return (
    <tr style={{ borderBottom: `1px solid ${C.borderLight}` }}>
      <td style={{ padding: '8px 12px', fontWeight: bold ? 600 : 400, color: C.text }}>{label}</td>
      <td
        style={{
          padding: '8px 12px',
          textAlign: 'right',
          fontWeight: bold ? 600 : 400,
          color: C.navy,
        }}
      >
        {pct}
      </td>
    </tr>
  );
}
