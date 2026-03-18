import { C, BODY } from '@/lib/designSystem';
import { usePayments } from '@/hooks/usePayments';
import NextPaymentCard from './NextPaymentCard';
import RecentPayments from './RecentPayments';

export interface RetireeDashboardProps {
  memberId: number;
  onNavigate?: (section: string) => void;
}

export default function RetireeDashboard({ memberId, onNavigate }: RetireeDashboardProps) {
  const { data: payments, isLoading } = usePayments(memberId);

  const sortedPayments = (payments ?? []).sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
  );
  const nextPayment = sortedPayments[0] ?? null;

  const quickLinks = [
    { key: 'tax-documents', label: '1099-R Tax Documents', icon: '⊞' },
    { key: 'profile', label: 'Update my information', icon: '◉' },
    { key: 'benefit', label: 'Manage my benefit', icon: '◈' },
  ];

  return (
    <div
      data-testid="retiree-dashboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      <NextPaymentCard payment={nextPayment} isLoading={isLoading} />

      <RecentPayments payments={sortedPayments} isLoading={isLoading} />

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {quickLinks.map((link) => (
          <button
            key={link.key}
            onClick={() => onNavigate?.(link.key)}
            data-testid={`quick-link-${link.key}`}
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
            <span style={{ fontSize: 20 }}>{link.icon}</span>
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
