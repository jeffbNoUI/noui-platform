import { C, BODY } from '@/lib/designSystem';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';
import { formatCurrency } from '../MemberPortalUtils';

interface FormulaBreakdownProps {
  result: WhatIfResult;
}

export default function FormulaBreakdown({ result }: FormulaBreakdownProps) {
  return (
    <div
      data-testid="formula-breakdown"
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          fontFamily: BODY,
          fontSize: 12,
          fontWeight: 600,
          color: C.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 12,
        }}
      >
        How it&apos;s calculated
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FormulaRow
          label="Average Monthly Salary (AMS)"
          value={`${formatCurrency(result.ams)}/mo`}
        />
        <FormulaRow
          label="Multiplier"
          value={result.raw_benefit?.formula.multiplier_pct ?? '2.0%'}
        />
        <FormulaRow label="Service years" value={`${result.service_years} years`} />

        <div
          style={{
            borderTop: `1px solid ${C.borderLight}`,
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          <FormulaRow
            label="Base benefit"
            value={`${formatCurrency(result.base_benefit)}/mo`}
            bold
          />
        </div>

        {result.reduction_detail.applies && (
          <div style={{ marginTop: 4 }}>
            <FormulaRow
              label={`Early retirement reduction (${result.reduction_detail.rate_per_year * 100}% x ${result.reduction_detail.years_under_65} yrs)`}
              value={`-${result.reduction_pct}%`}
              color={C.coral}
            />
          </div>
        )}

        <div
          style={{
            borderTop: `2px solid ${C.sage}`,
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          <FormulaRow
            label="Your monthly benefit"
            value={`${formatCurrency(result.monthly_benefit)}/mo`}
            bold
            color={C.sage}
          />
        </div>
      </div>

      <div
        style={{
          fontFamily: BODY,
          fontSize: 12,
          color: C.textTertiary,
          marginTop: 12,
          fontStyle: 'italic',
        }}
      >
        {result.formula_display}
      </div>
    </div>
  );
}

function FormulaRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: BODY,
        fontSize: 14,
      }}
    >
      <span style={{ color: C.text }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color: color ?? C.navy }}>{value}</span>
    </div>
  );
}
