import { useServiceCredit } from '@/hooks/useMember';
import { C, BODY, DISPLAY } from '@/lib/designSystem';

// ── Props ───────────────────────────────────────────────────────────────────

interface ServiceCreditTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ServiceCreditTab({ memberId }: ServiceCreditTabProps) {
  const { data, isLoading } = useServiceCredit(memberId);

  if (isLoading) {
    return (
      <div data-testid="service-credit-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading service credit...
      </div>
    );
  }

  const summary = data?.summary;
  if (!summary) {
    return (
      <div data-testid="service-credit-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Service credit data not available.
      </div>
    );
  }

  return (
    <div data-testid="service-credit-tab">
      {/* Key totals: Eligibility vs Benefit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div
          data-testid="eligibility-years"
          style={{
            background: C.cardBg,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 10,
            padding: '20px 24px',
            borderTop: `3px solid ${C.sage}`,
          }}
        >
          <div style={labelSmall}>Eligibility Service</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: C.navy, fontFamily: DISPLAY }}>
            {summary.eligibility_years.toFixed(1)}
          </div>
          <div style={{ fontSize: 13, color: C.textSecondary, fontFamily: BODY, marginTop: 4 }}>
            Years (earned only)
          </div>
        </div>
        <div
          data-testid="benefit-years"
          style={{
            background: C.cardBg,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 10,
            padding: '20px 24px',
            borderTop: `3px solid ${C.sky}`,
          }}
        >
          <div style={labelSmall}>Benefit Service</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: C.navy, fontFamily: DISPLAY }}>
            {summary.benefit_years.toFixed(1)}
          </div>
          <div style={{ fontSize: 13, color: C.textSecondary, fontFamily: BODY, marginTop: 4 }}>
            Years (earned + purchased)
          </div>
        </div>
      </div>

      {/* Distinction explanation */}
      <div
        data-testid="service-credit-help"
        style={{
          background: C.goldLight,
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: 13,
          color: C.text,
          fontFamily: BODY,
          marginBottom: 20,
          lineHeight: 1.6,
        }}
      >
        <strong>Important:</strong> Eligibility service determines when you qualify for retirement
        (Rule of 75/85). Benefit service determines how much your monthly benefit will be. Purchased
        service credit increases your benefit but does not count toward eligibility.
      </div>

      {/* Breakdown table */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <table
          data-testid="service-credit-table"
          style={{ width: '100%', borderCollapse: 'collapse', fontFamily: BODY, fontSize: 14 }}
        >
          <thead>
            <tr style={{ background: C.cardBgWarm }}>
              <th style={thStyle}>Credit Type</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Years</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Counts for Eligibility</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Counts for Benefit</th>
            </tr>
          </thead>
          <tbody>
            <CreditRow label="Earned Service" years={summary.earned_years} eligibility benefit />
            {summary.purchased_years > 0 && (
              <CreditRow label="Purchased Service" years={summary.purchased_years} benefit />
            )}
            {summary.military_years > 0 && (
              <CreditRow
                label="Military Service"
                years={summary.military_years}
                eligibility
                benefit
              />
            )}
            {summary.leave_years > 0 && (
              <CreditRow label="Leave Service" years={summary.leave_years} benefit />
            )}
            <tr style={{ fontWeight: 600 }}>
              <td style={{ ...tdStyle, borderTop: `2px solid ${C.border}` }}>Total</td>
              <td style={{ ...tdStyle, textAlign: 'right', borderTop: `2px solid ${C.border}` }}>
                {summary.total_years.toFixed(1)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', borderTop: `2px solid ${C.border}` }}>
                {summary.eligibility_years.toFixed(1)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', borderTop: `2px solid ${C.border}` }}>
                {summary.benefit_years.toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CreditRow ───────────────────────────────────────────────────────────────

function CreditRow({
  label,
  years,
  eligibility = false,
  benefit = false,
}: {
  label: string;
  years: number;
  eligibility?: boolean;
  benefit?: boolean;
}) {
  return (
    <tr>
      <td style={tdStyle}>{label}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{years.toFixed(1)}</td>
      <td style={{ ...tdStyle, textAlign: 'center', color: eligibility ? C.sage : C.textTertiary }}>
        {eligibility ? 'Yes' : 'No'}
      </td>
      <td style={{ ...tdStyle, textAlign: 'center', color: benefit ? C.sage : C.textTertiary }}>
        {benefit ? 'Yes' : 'No'}
      </td>
    </tr>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const labelSmall: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: C.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontFamily: BODY,
  marginBottom: 8,
};

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
