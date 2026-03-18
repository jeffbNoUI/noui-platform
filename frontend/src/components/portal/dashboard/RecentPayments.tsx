import { C, BODY } from '@/lib/designSystem';
import { formatCurrency, formatDate } from '../MemberPortalUtils';
import type { PaymentRecord } from '@/types/MemberPortal';

export interface RecentPaymentsProps {
  payments: PaymentRecord[];
  isLoading?: boolean;
}

export default function RecentPayments({ payments, isLoading }: RecentPaymentsProps) {
  const recent = payments.slice(0, 3);

  return (
    <div
      data-testid="recent-payments"
      style={{
        background: C.cardBg,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: '24px 28px',
      }}
    >
      <h3
        style={{
          fontFamily: BODY,
          fontSize: 15,
          fontWeight: 600,
          color: C.navy,
          margin: '0 0 16px',
        }}
      >
        Recent Payments
      </h3>

      {isLoading ? (
        <div style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>Loading...</div>
      ) : recent.length === 0 ? (
        <div style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary }}>
          No payment history available.
        </div>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: BODY,
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${C.borderLight}`,
                textAlign: 'left',
                color: C.textSecondary,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              <th style={{ padding: '8px 0', fontWeight: 500 }}>Date</th>
              <th style={{ padding: '8px 0', fontWeight: 500 }}>Gross</th>
              <th style={{ padding: '8px 0', fontWeight: 500 }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: '10px 0', color: C.text }}>{formatDate(p.payment_date)}</td>
                <td style={{ padding: '10px 0', color: C.textSecondary }}>
                  {formatCurrency(p.gross_amount)}
                </td>
                <td style={{ padding: '10px 0', color: C.text, fontWeight: 500 }}>
                  {formatCurrency(p.net_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
