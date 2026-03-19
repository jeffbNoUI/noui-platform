import { C, BODY } from '@/lib/designSystem';
import { usePayments } from '@/hooks/usePayments';
import NextPaymentCard from './NextPaymentCard';
import RecentPayments from './RecentPayments';
import CardGrid from '../CardGrid';
import NavigationCard from '../NavigationCard';
import { getCardsForPersona } from '../cardDefinitions';
import { getHintForCard } from '../learningHints';

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

  const personas: 'beneficiary'[] = ['beneficiary'];
  const cards = getCardsForPersona(personas);

  const summaries: Record<string, string | undefined> = {
    profile: 'Review your personal information',
    benefit: 'Survivor benefit details',
    documents: undefined,
    messages: undefined,
    preferences: undefined,
  };

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

        <CardGrid>
          {cards.map((card) => (
            <NavigationCard
              key={card.key}
              icon={card.icon}
              title={card.label}
              summary={summaries[card.key] ?? card.staticSummary}
              tourId={`card-${card.key}`}
              accentColor={card.accentColor}
              hint={getHintForCard(card.key, personas)}
              onClick={() => onNavigate?.(card.key)}
            />
          ))}
        </CardGrid>
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

      <CardGrid>
        {cards.map((card) => (
          <NavigationCard
            key={card.key}
            icon={card.icon}
            title={card.label}
            summary={summaries[card.key] ?? card.staticSummary}
            tourId={`card-${card.key}`}
            accentColor={card.accentColor}
            hint={getHintForCard(card.key, personas)}
            onClick={() => onNavigate?.(card.key)}
          />
        ))}
      </CardGrid>
    </div>
  );
}
