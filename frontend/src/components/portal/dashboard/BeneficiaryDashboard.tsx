import { C, BODY } from '@/lib/designSystem';
import { usePayments } from '@/hooks/usePayments';
import NextPaymentCard from './NextPaymentCard';
import RecentPayments from './RecentPayments';

export interface BeneficiaryDashboardProps {
  memberId: number;
  benefitType: 'survivor' | 'lump_sum';
  onNavigate?: (section: string) => void;
}

export default function BeneficiaryDashboard({
  memberId,
  benefitType,
  onNavigate,
}: BeneficiaryDashboardProps) {
  const { data: payments, isLoading } = usePayments(memberId);

  const sortedPayments = (payments ?? []).sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
  );
  const nextPayment = sortedPayments[0] ?? null;

  if (benefitType === 'lump_sum') {
    return (
      <div
        data-testid="beneficiary-dashboard"
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <div
          data-testid="claim-status"
          style={{
            background: C.cardBg,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            padding: '28px 32px',
            textAlign: 'center',
            fontFamily: BODY,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 8 }}>
            Lump Sum Claim Status
          </div>
          <div style={{ fontSize: 14, color: C.textSecondary }}>
            Your claim is being processed. You will be notified when payment is issued.
          </div>
        </div>

        <button
          onClick={() => onNavigate?.('documents')}
          data-testid="quick-link-documents"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            cursor: 'pointer',
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 500,
            color: C.navy,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 20 }}>▤</span>
          View submitted documents
        </button>
      </div>
    );
  }

  // Survivor benefit — monthly payments
  return (
    <div
      data-testid="beneficiary-dashboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      <NextPaymentCard payment={nextPayment} isLoading={isLoading} />

      <RecentPayments payments={sortedPayments} isLoading={isLoading} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <button
          onClick={() => onNavigate?.('profile')}
          data-testid="quick-link-profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            cursor: 'pointer',
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 500,
            color: C.navy,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 20 }}>◉</span>
          Update my information
        </button>
        <button
          onClick={() => onNavigate?.('messages')}
          data-testid="quick-link-messages"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            cursor: 'pointer',
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 500,
            color: C.navy,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 20 }}>✉</span>
          Contact us
        </button>
      </div>
    </div>
  );
}
