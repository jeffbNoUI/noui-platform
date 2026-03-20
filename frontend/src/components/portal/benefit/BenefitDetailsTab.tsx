import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { formatCurrency, formatDate } from '../MemberPortalUtils';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';
import FormulaBreakdown from '../calculator/FormulaBreakdown';

// ── Props ───────────────────────────────────────────────────────────────────

interface BenefitDetailsTabProps {
  memberId: number;
  retirementDate: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BenefitDetailsTab({ memberId, retirementDate }: BenefitDetailsTabProps) {
  const { data: benefit, isLoading, error } = useBenefitCalculation(memberId, retirementDate);

  if (isLoading) {
    return (
      <div data-testid="benefit-details-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Calculating benefit details...
      </div>
    );
  }

  if (error || !benefit) {
    return (
      <div data-testid="benefit-details-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Unable to calculate benefit details. Please try again later.
      </div>
    );
  }

  const monthlyBenefit = benefit.reduction.applies
    ? benefit.reduction.reduced_benefit
    : benefit.maximum_benefit;

  // Adapt BenefitCalcResult to WhatIfResult for FormulaBreakdown reuse
  const formulaResult: WhatIfResult = {
    monthly_benefit: monthlyBenefit,
    eligibility_type: benefit.eligibility.best_eligible_type as 'EARLY' | 'NORMAL' | 'INELIGIBLE',
    reduction_pct: benefit.eligibility.reduction_pct,
    ams: benefit.ams.amount,
    base_benefit: benefit.formula.gross_benefit,
    service_years: benefit.formula.service_years,
    formula_display: benefit.formula.formula_display,
    reduction_detail: {
      applies: benefit.reduction.applies,
      years_under_65: benefit.reduction.years_under_65,
      rate_per_year: benefit.reduction.rate_per_year,
    },
    payment_options: [
      { option_id: 'maximum', member_amount: benefit.payment_options.maximum, survivor_amount: 0 },
      ...(benefit.payment_options.js_100
        ? [
            {
              option_id: 'js_100' as const,
              member_amount: benefit.payment_options.js_100.member_amount,
              survivor_amount: benefit.payment_options.js_100.survivor_amount,
            },
          ]
        : []),
      ...(benefit.payment_options.js_75
        ? [
            {
              option_id: 'js_75' as const,
              member_amount: benefit.payment_options.js_75.member_amount,
              survivor_amount: benefit.payment_options.js_75.survivor_amount,
            },
          ]
        : []),
      ...(benefit.payment_options.js_50
        ? [
            {
              option_id: 'js_50' as const,
              member_amount: benefit.payment_options.js_50.member_amount,
              survivor_amount: benefit.payment_options.js_50.survivor_amount,
            },
          ]
        : []),
    ],
    raw_benefit: benefit,
    raw_eligibility: benefit.eligibility,
  };

  return (
    <div
      data-testid="benefit-details-tab"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {/* ── Summary Card ──────────────────────────────────────────────── */}
      <div
        data-testid="benefit-summary-card"
        style={{
          background: C.cardBgWarm,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div
          style={{
            fontFamily: BODY,
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: C.textTertiary,
            marginBottom: 4,
          }}
        >
          Estimated Monthly Benefit
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 32,
            fontWeight: 700,
            color: C.navy,
            marginBottom: 16,
          }}
        >
          {formatCurrency(monthlyBenefit)}/mo
        </div>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <DetailItem label="Retirement Date" value={formatDate(benefit.retirement_date)} />
          <DetailItem label="Retirement Type" value={benefit.eligibility.best_eligible_type} />
          <DetailItem label="Tier" value={`Tier ${benefit.tier}`} />
          {benefit.reduction.applies && (
            <DetailItem
              label="Early Reduction"
              value={`${benefit.reduction.total_reduction_pct.toFixed(1)}%`}
            />
          )}
        </div>
      </div>

      {/* ── Formula Breakdown (reused from calculator) ────────────────── */}
      <div>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 12px',
          }}
        >
          Calculation Breakdown
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.textSecondary,
            margin: '0 0 16px',
          }}
        >
          This shows how your benefit is calculated based on your service, salary, and retirement
          date.
        </p>
        <FormulaBreakdown result={formulaResult} />
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: BODY,
          fontSize: 11,
          color: C.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: BODY, fontSize: 15, fontWeight: 600, color: C.text }}>{value}</div>
    </div>
  );
}
