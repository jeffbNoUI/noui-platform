import { usePayments } from '@/hooks/usePayments';
import NextPaymentCard from './NextPaymentCard';
import RecentPayments from './RecentPayments';
import CardGrid from '../CardGrid';
import NavigationCard from '../NavigationCard';
import { getCardsForPersona } from '../cardDefinitions';
import { getHintForCard } from '../learningHints';

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

  const personas: 'retiree'[] = ['retiree'];
  const cards = getCardsForPersona(personas);

  const summaries: Record<string, string | undefined> = {
    profile: 'Review your personal information',
    benefit: nextPayment ? `$${Number(nextPayment.net_amount).toLocaleString()}/mo` : undefined,
    'tax-documents': undefined,
    documents: undefined,
    messages: undefined,
    preferences: undefined,
  };

  return (
    <div
      data-testid="retiree-dashboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      <NextPaymentCard payment={nextPayment} isLoading={isLoading} />

      <RecentPayments payments={sortedPayments} isLoading={isLoading} />

      {/* Navigation cards */}
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
