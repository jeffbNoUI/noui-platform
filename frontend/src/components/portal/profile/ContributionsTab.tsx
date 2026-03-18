import { useContributions } from '@/hooks/useMember';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { formatCurrency } from '../MemberPortalUtils';

// ── Props ───────────────────────────────────────────────────────────────────

interface ContributionsTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ContributionsTab({ memberId }: ContributionsTabProps) {
  const { data: contributions, isLoading } = useContributions(memberId);

  if (isLoading) {
    return (
      <div data-testid="contributions-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading contributions...
      </div>
    );
  }

  if (!contributions) {
    return (
      <div data-testid="contributions-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Contribution data not available.
      </div>
    );
  }

  const totalBalance = contributions.current_ee_balance + contributions.current_er_balance;
  const employeeRate = 8.45;
  const employerRate = 17.95;

  return (
    <div data-testid="contributions-tab">
      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <SummaryCard
          testId="summary-employee"
          label="Your Contributions"
          amount={contributions.current_ee_balance}
          subtitle={`${employeeRate}% of salary`}
          color={C.sage}
        />
        <SummaryCard
          testId="summary-employer"
          label="Employer Contributions"
          amount={contributions.current_er_balance}
          subtitle={`${employerRate}% of salary`}
          color={C.sky}
        />
        <SummaryCard
          testId="summary-total"
          label="Total Balance"
          amount={totalBalance}
          subtitle={`${contributions.period_count} pay periods`}
          color={C.navy}
        />
      </div>

      {/* Contribution detail table */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <table
          data-testid="contributions-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: BODY,
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ background: C.cardBgWarm }}>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total Contributions</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Current Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Employee (you)</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                {formatCurrency(contributions.total_ee_contributions)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                {formatCurrency(contributions.current_ee_balance)}
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>Employer</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                {formatCurrency(contributions.total_er_contributions)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                {formatCurrency(contributions.current_er_balance)}
              </td>
            </tr>
            {contributions.total_interest > 0 && (
              <tr>
                <td style={tdStyle}>Interest Earned</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {formatCurrency(contributions.total_interest)}
                </td>
              </tr>
            )}
            <tr style={{ fontWeight: 600 }}>
              <td style={{ ...tdStyle, borderTop: `2px solid ${C.border}` }}>Total</td>
              <td style={{ ...tdStyle, textAlign: 'right', borderTop: `2px solid ${C.border}` }}>
                {formatCurrency(
                  contributions.total_ee_contributions + contributions.total_er_contributions,
                )}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', borderTop: `2px solid ${C.border}` }}>
                {formatCurrency(totalBalance + contributions.total_interest)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: '12px 16px',
          background: C.goldLight,
          borderRadius: 8,
          fontSize: 13,
          color: C.text,
          fontFamily: BODY,
        }}
      >
        Contribution rates are set by state law. Employee: {employeeRate}%, Employer: {employerRate}
        %.
      </div>
    </div>
  );
}

// ── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({
  testId,
  label,
  amount,
  subtitle,
  color,
}: {
  testId: string;
  label: string;
  amount: number;
  subtitle: string;
  color: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 10,
        padding: '20px 24px',
        borderTop: `3px solid ${color}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: C.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: BODY,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, fontFamily: DISPLAY }}>
        {formatCurrency(amount)}
      </div>
      <div style={{ fontSize: 13, color: C.textSecondary, fontFamily: BODY, marginTop: 4 }}>
        {subtitle}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: C.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'left',
  fontFamily: BODY,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: `1px solid ${C.borderLight}`,
  color: C.text,
  fontFamily: BODY,
};
