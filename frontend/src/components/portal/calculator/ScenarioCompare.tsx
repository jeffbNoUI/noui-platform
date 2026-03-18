import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { SavedScenario } from '@/types/MemberPortal';
import { formatCurrency } from '../MemberPortalUtils';

interface ScenarioCompareProps {
  scenarios: SavedScenario[];
  onClose: () => void;
}

interface CompareRow {
  label: string;
  getValue: (s: SavedScenario) => string;
}

const COMPARE_ROWS: CompareRow[] = [
  {
    label: 'Retirement Date',
    getValue: (s) => {
      const d = new Date(
        s.inputs.retirement_date.includes('T')
          ? s.inputs.retirement_date
          : s.inputs.retirement_date + 'T00:00:00',
      );
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    },
  },
  {
    label: 'Monthly Benefit',
    getValue: (s) => formatCurrency(s.results.monthly_benefit),
  },
  {
    label: 'Eligibility',
    getValue: (s) =>
      s.results.eligibility_type === 'EARLY'
        ? 'Early'
        : s.results.eligibility_type === 'NORMAL'
          ? 'Normal'
          : 'Ineligible',
  },
  {
    label: 'Reduction',
    getValue: (s) => (s.results.reduction_pct > 0 ? `${s.results.reduction_pct}%` : 'None'),
  },
  {
    label: 'AMS',
    getValue: (s) => formatCurrency(s.results.ams),
  },
  {
    label: 'Service Years',
    getValue: (s) => `${s.results.service_years} yrs`,
  },
  {
    label: 'Payment Option',
    getValue: (s) => formatPaymentOption(s.inputs.payment_option),
  },
];

export default function ScenarioCompare({ scenarios, onClose }: ScenarioCompareProps) {
  // Find best monthly benefit for highlighting
  const maxBenefit = Math.max(...scenarios.map((s) => s.results.monthly_benefit));

  return (
    <div data-testid="scenario-compare">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Compare Scenarios
        </h3>
        <button
          data-testid="compare-close"
          onClick={onClose}
          style={{
            fontFamily: BODY,
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.text,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: BODY,
          fontSize: 14,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: C.textTertiary,
                borderBottom: `2px solid ${C.borderLight}`,
                width: 140,
              }}
            />
            {scenarios.map((s) => (
              <th
                key={s.id}
                style={{
                  textAlign: 'center',
                  padding: '10px 12px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.navy,
                  borderBottom: `2px solid ${C.borderLight}`,
                }}
              >
                {s.label}
                {s.is_stale && (
                  <span
                    style={{
                      fontSize: 10,
                      color: C.gold,
                      background: C.goldLight,
                      padding: '1px 6px',
                      borderRadius: 3,
                      marginLeft: 6,
                    }}
                  >
                    Stale
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  padding: '10px 12px',
                  fontWeight: 600,
                  color: C.text,
                  borderBottom: `1px solid ${C.borderLight}`,
                }}
              >
                {row.label}
              </td>
              {scenarios.map((s) => {
                const value = row.getValue(s);
                const isBest =
                  row.label === 'Monthly Benefit' &&
                  s.results.monthly_benefit === maxBenefit &&
                  scenarios.length > 1;
                return (
                  <td
                    key={s.id}
                    data-testid={`compare-cell-${s.id}-${row.label.toLowerCase().replace(/\s+/g, '-')}`}
                    style={{
                      textAlign: 'center',
                      padding: '10px 12px',
                      color: isBest ? C.sage : C.navy,
                      fontWeight: isBest || row.label === 'Monthly Benefit' ? 700 : 400,
                      borderBottom: `1px solid ${C.borderLight}`,
                      background: isBest ? C.sageLight : 'transparent',
                    }}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatPaymentOption(id: string): string {
  switch (id) {
    case 'maximum':
      return 'Maximum';
    case 'js_100':
      return 'J&S 100%';
    case 'js_75':
      return 'J&S 75%';
    case 'js_50':
      return 'J&S 50%';
    default:
      return id;
  }
}
