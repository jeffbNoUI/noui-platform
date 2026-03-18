import { useQuery } from '@tanstack/react-query';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { formatCurrency, formatDate } from '../MemberPortalUtils';
import { fetchAPI } from '@/lib/apiClient';
import type { WhatIfResult } from '@/hooks/useWhatIfCalculator';
import FormulaBreakdown from '../calculator/FormulaBreakdown';

// ── Types ───────────────────────────────────────────────────────────────────

interface FinalizedBenefit {
  effective_date: string;
  retirement_type: 'EARLY' | 'NORMAL';
  monthly_benefit: number;
  payment_option: string;
  payment_option_label: string;
  survivor_amount?: number;
  ams: number;
  base_benefit: number;
  service_years: number;
  multiplier_pct: string;
  reduction_pct: number;
  reduction_applies: boolean;
  reduction_years_under_65: number;
  reduction_rate_per_year: number;
  formula_display: string;
  finalized_at: string;
}

// ── Hook ────────────────────────────────────────────────────────────────────

function useFinalizedBenefit(memberId: number) {
  return useQuery<FinalizedBenefit>({
    queryKey: ['finalized-benefit', memberId],
    queryFn: () => fetchAPI<FinalizedBenefit>(`/api/v1/members/${memberId}/finalized-benefit`),
    enabled: !!memberId,
  });
}

// ── Props ───────────────────────────────────────────────────────────────────

interface BenefitDetailsTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BenefitDetailsTab({ memberId }: BenefitDetailsTabProps) {
  const { data: benefit, isLoading, error } = useFinalizedBenefit(memberId);

  if (isLoading) {
    return (
      <div data-testid="benefit-details-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading benefit details…
      </div>
    );
  }

  if (error || !benefit) {
    return (
      <div data-testid="benefit-details-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Benefit details are not yet available. They will appear here once your retirement has been
        finalized.
      </div>
    );
  }

  // Adapt finalized benefit to WhatIfResult for FormulaBreakdown reuse
  const formulaResult: WhatIfResult = {
    monthly_benefit: benefit.monthly_benefit,
    eligibility_type: benefit.retirement_type,
    reduction_pct: benefit.reduction_pct,
    ams: benefit.ams,
    base_benefit: benefit.base_benefit,
    service_years: benefit.service_years,
    formula_display: benefit.formula_display,
    reduction_detail: {
      applies: benefit.reduction_applies,
      years_under_65: benefit.reduction_years_under_65,
      rate_per_year: benefit.reduction_rate_per_year,
    },
    payment_options: [],
    raw_benefit: {
      formula: {
        multiplier_pct: benefit.multiplier_pct,
        gross_benefit: benefit.base_benefit,
        service_years: benefit.service_years,
        formula_display: benefit.formula_display,
      },
      ams: { amount: benefit.ams },
      reduction: {
        applies: benefit.reduction_applies,
        years_under_65: benefit.reduction_years_under_65,
        rate_per_year: benefit.reduction_rate_per_year,
        reduction_factor: benefit.reduction_applies ? 1 - benefit.reduction_pct / 100 : 1,
      },
    } as WhatIfResult['raw_benefit'],
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
          Your Monthly Benefit
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
          {formatCurrency(benefit.monthly_benefit)}/mo
        </div>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <DetailItem label="Effective Date" value={formatDate(benefit.effective_date)} />
          <DetailItem label="Retirement Type" value={benefit.retirement_type} />
          <DetailItem label="Payment Option" value={benefit.payment_option_label} />
          {benefit.survivor_amount != null && benefit.survivor_amount > 0 && (
            <DetailItem
              label="Survivor Benefit"
              value={`${formatCurrency(benefit.survivor_amount)}/mo`}
            />
          )}
          <DetailItem label="Finalized" value={formatDate(benefit.finalized_at)} />
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
          Calculation Record
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.textSecondary,
            margin: '0 0 16px',
          }}
        >
          This is the permanent record of how your benefit was calculated at retirement.
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
