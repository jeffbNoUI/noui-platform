import { C, BODY } from '@/lib/designSystem';
import type { ScenarioEntry } from '@/types/BenefitCalculation';
import { formatCurrency } from '../MemberPortalUtils';

interface WaitComparisonProps {
  scenarios: ScenarioEntry[];
  selectedDate?: string;
}

export default function WaitComparison({ scenarios, selectedDate }: WaitComparisonProps) {
  if (scenarios.length === 0) return null;

  return (
    <div
      data-testid="wait-comparison"
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
        What if you wait?
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {scenarios.map((s) => {
          const isSelected = s.retirement_date === selectedDate;
          const dateLabel = formatDateShort(s.retirement_date);
          return (
            <div
              key={s.retirement_date}
              data-testid={`wait-row-${s.retirement_date}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 8,
                background: isSelected ? C.sageLight : 'transparent',
                fontFamily: BODY,
                fontSize: 14,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: isSelected ? 700 : 400, color: C.text }}>
                  {dateLabel}
                  {isSelected && (
                    <span style={{ fontSize: 11, color: C.sage, marginLeft: 6 }}>Selected</span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: C.textTertiary }}>
                  Age {s.age} &middot; {s.total_service} yrs service &middot;{' '}
                  {s.eligibility_type === 'NORMAL'
                    ? 'Normal'
                    : s.eligibility_type === 'EARLY'
                      ? `Early (−${s.reduction_pct}%)`
                      : 'Ineligible'}
                </span>
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: s.eligibility_type === 'INELIGIBLE' ? C.textTertiary : C.navy,
                  fontSize: 15,
                }}
              >
                {s.eligibility_type === 'INELIGIBLE'
                  ? '—'
                  : `${formatCurrency(s.monthly_benefit)}/mo`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  const d = new Date(normalized);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
