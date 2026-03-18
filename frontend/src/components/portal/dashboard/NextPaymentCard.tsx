import { C, DISPLAY, BODY } from '@/lib/designSystem';
import { formatCurrency, formatDate } from '../MemberPortalUtils';
import type { PaymentRecord } from '@/types/MemberPortal';

export interface NextPaymentCardProps {
  payment: PaymentRecord | null;
  isLoading?: boolean;
}

export default function NextPaymentCard({ payment, isLoading }: NextPaymentCardProps) {
  return (
    <div
      data-testid="next-payment-card"
      data-tour-id="next-payment"
      style={{
        background: `linear-gradient(135deg, ${C.cardBgAccent} 0%, ${C.cardBgAccentLight} 100%)`,
        borderRadius: 12,
        padding: '24px 28px',
        color: C.textOnDark,
      }}
    >
      <div
        style={{
          fontFamily: BODY,
          fontSize: 12,
          color: C.textOnDarkDim,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        Next Payment
      </div>

      {isLoading ? (
        <div style={{ fontFamily: BODY, fontSize: 14, color: C.textOnDarkMuted }}>
          Loading payment data...
        </div>
      ) : payment ? (
        <>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 36,
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: 12,
            }}
          >
            {formatCurrency(payment.net_amount)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: C.textOnDarkDim }}>Gross</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {formatCurrency(payment.gross_amount)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textOnDarkDim }}>Deductions</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {formatCurrency(payment.federal_tax + payment.state_tax + payment.other_deductions)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textOnDarkDim }}>Pay Date</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {formatDate(payment.payment_date)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textOnDarkDim }}>Bank</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>****{payment.bank_last_four}</div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ fontFamily: BODY, fontSize: 14, color: C.textOnDarkMuted }}>
          No upcoming payment on file.
        </div>
      )}
    </div>
  );
}
