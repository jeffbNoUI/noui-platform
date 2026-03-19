import { C, BODY } from '@/lib/designSystem';
import { useMember } from '@/hooks/useMember';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import { useRefundEstimate } from '@/hooks/useRefundEstimate';
import { isVested, DEMO_MEMBER } from '../MemberPortalUtils';
import OptionsComparison from './OptionsComparison';
import CardGrid from '../CardGrid';
import NavigationCard from '../NavigationCard';
import { getCardsForPersona } from '../cardDefinitions';
import { getHintForCard } from '../learningHints';

export interface InactiveMemberDashboardProps {
  memberId: number;
  onNavigate?: (section: string) => void;
}

export default function InactiveMemberDashboard({
  memberId,
  onNavigate,
}: InactiveMemberDashboardProps) {
  const { data: member, isLoading: memberLoading, error: memberError } = useMember(memberId);
  const effectiveMember = member ?? (memberError ? DEMO_MEMBER : null);

  const vested = effectiveMember ? isVested(effectiveMember.hire_date) : false;

  // Deferred benefit estimate (only for vested)
  const { data: calculation } = useBenefitCalculation(
    memberId,
    effectiveMember
      ? `${new Date(effectiveMember.dob + 'T00:00:00').getFullYear() + 65}-01-01`
      : '',
  );

  const { data: refundEstimate, isLoading: refundLoading } = useRefundEstimate(memberId);

  if (memberLoading || !effectiveMember) {
    return (
      <div style={{ fontFamily: BODY, color: C.textSecondary, padding: 32, textAlign: 'center' }}>
        Loading dashboard...
      </div>
    );
  }

  const personas: 'inactive'[] = ['inactive'];
  const cards = getCardsForPersona(personas);

  const summaries: Record<string, string | undefined> = {
    profile: 'Review your personal information',
    calculator: vested ? 'Explore deferred benefit scenarios' : undefined,
    refund: refundEstimate
      ? `Est. $${Number(refundEstimate.total ?? 0).toLocaleString()}`
      : undefined,
    documents: undefined,
    messages: undefined,
    preferences: undefined,
  };

  return (
    <div
      data-testid="inactive-member-dashboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {/* Status banner */}
      <div
        data-testid="status-banner"
        style={{
          background: C.goldLight,
          borderRadius: 12,
          border: `1px solid ${C.gold}`,
          padding: '20px 28px',
          fontFamily: BODY,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 4 }}>
          Your account is inactive
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary }}>
          {vested
            ? 'You are vested with 5+ years of service. You can choose between a deferred pension benefit or a refund of your contributions.'
            : 'You have fewer than 5 years of service and are not vested. You may request a refund of your employee contributions plus interest.'}
        </div>
      </div>

      <OptionsComparison
        isVested={vested}
        deferredMonthly={calculation?.maximum_benefit}
        refundEstimate={refundEstimate}
        isLoading={refundLoading}
        onNavigate={onNavigate}
      />

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
