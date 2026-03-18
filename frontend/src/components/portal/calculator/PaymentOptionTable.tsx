import { C, BODY } from '@/lib/designSystem';
import type { PaymentOptionResult } from '@/types/MemberPortal';
import { formatCurrency } from '../MemberPortalUtils';

interface PaymentOptionTableProps {
  options: PaymentOptionResult[];
  selectedOption?: string;
  onSelect?: (optionId: string) => void;
}

const OPTION_LABELS: Record<string, { label: string; description: string }> = {
  maximum: {
    label: 'Maximum (Single Life)',
    description: 'Highest monthly amount, no survivor benefit',
  },
  js_100: { label: 'Joint & 100% Survivor', description: 'Survivor receives 100% of your benefit' },
  js_75: { label: 'Joint & 75% Survivor', description: 'Survivor receives 75% of your benefit' },
  js_50: { label: 'Joint & 50% Survivor', description: 'Survivor receives 50% of your benefit' },
};

export default function PaymentOptionTable({
  options,
  selectedOption,
  onSelect,
}: PaymentOptionTableProps) {
  if (options.length === 0) return null;

  return (
    <div
      data-testid="payment-option-table"
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 10,
        overflow: 'hidden',
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
          padding: '12px 16px 8px',
        }}
      >
        Payment options comparison
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
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: C.textTertiary,
                borderBottom: `1px solid ${C.borderLight}`,
              }}
            >
              Option
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: C.textTertiary,
                borderBottom: `1px solid ${C.borderLight}`,
              }}
            >
              Your Monthly
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: C.textTertiary,
                borderBottom: `1px solid ${C.borderLight}`,
              }}
            >
              Survivor Monthly
            </th>
          </tr>
        </thead>
        <tbody>
          {options.map((opt) => {
            const isSelected = selectedOption === opt.option_id;
            const meta = OPTION_LABELS[opt.option_id];
            return (
              <tr
                key={opt.option_id}
                data-testid={`payment-row-${opt.option_id}`}
                onClick={() => onSelect?.(opt.option_id)}
                style={{
                  background: isSelected ? C.sageLight : 'transparent',
                  cursor: onSelect ? 'pointer' : 'default',
                }}
              >
                <td
                  style={{
                    padding: '10px 16px',
                    borderBottom: `1px solid ${C.borderLight}`,
                  }}
                >
                  <div style={{ fontWeight: isSelected ? 700 : 500, color: C.text }}>
                    {meta?.label ?? opt.option_id}
                  </div>
                  {meta?.description && (
                    <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                      {meta.description}
                    </div>
                  )}
                </td>
                <td
                  style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    fontWeight: 600,
                    color: C.navy,
                    borderBottom: `1px solid ${C.borderLight}`,
                  }}
                >
                  {formatCurrency(opt.member_amount)}
                </td>
                <td
                  style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    fontWeight: 500,
                    color: opt.survivor_amount > 0 ? C.text : C.textTertiary,
                    borderBottom: `1px solid ${C.borderLight}`,
                  }}
                >
                  {opt.survivor_amount > 0 ? formatCurrency(opt.survivor_amount) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
