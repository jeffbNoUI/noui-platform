import { C, BODY } from '@/lib/designSystem';
import { useMember, useContributions } from '@/hooks/useMember';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import {
  DEMO_MEMBER,
  DEMO_CONTRIBUTIONS,
  DEMO_MONTHLY_BENEFIT,
  buildMilestones,
} from '../MemberPortalUtils';
import BenefitHero from './BenefitHero';
import MilestoneTimeline from './MilestoneTimeline';
import ActionItems, { type ActionItem } from './ActionItems';
import CardGrid from '../CardGrid';
import NavigationCard from '../NavigationCard';
import { getCardsForPersona } from '../cardDefinitions';
import { getHintForCard } from '../learningHints';

export interface ActiveMemberDashboardProps {
  memberId: number;
  retirementDate: string;
  onNavigate?: (section: string) => void;
}

export default function ActiveMemberDashboard({
  memberId,
  retirementDate,
  onNavigate,
}: ActiveMemberDashboardProps) {
  const { data: member, isLoading: memberLoading, error: memberError } = useMember(memberId);
  const { data: contributions } = useContributions(memberId);
  const { data: calculation } = useBenefitCalculation(memberId, retirementDate);

  const useDemo = !member && !memberLoading;
  const effectiveMember = member ?? (memberError ? DEMO_MEMBER : null);

  if (memberLoading || !effectiveMember) {
    return (
      <div style={{ fontFamily: BODY, color: C.textSecondary, padding: 32, textAlign: 'center' }}>
        Loading dashboard...
      </div>
    );
  }

  const effectiveContrib = contributions ?? (useDemo ? DEMO_CONTRIBUTIONS : null);
  const estimatedMonthly = calculation?.maximum_benefit ?? (useDemo ? DEMO_MONTHLY_BENEFIT : 0);
  const milestones = buildMilestones(effectiveMember);

  // Build action items from pending notifications, incomplete profile, etc.
  const actionItems: ActionItem[] = [];
  if (!effectiveContrib) {
    actionItems.push({
      id: 'missing-contributions',
      type: 'profile',
      title: 'Contribution data unavailable',
      description: 'We could not load your contribution history.',
      priority: 'medium',
    });
  }

  // Build card summaries from loaded data
  const personas: 'active'[] = ['active'];
  const cards = getCardsForPersona(personas);

  const summaries: Record<string, string | undefined> = {
    profile: effectiveMember.first_name ? 'Review your personal information' : undefined,
    calculator: estimatedMonthly
      ? `Est. $${Math.round(estimatedMonthly).toLocaleString()}/mo`
      : undefined,
    'retirement-app': undefined,
    documents: undefined,
    messages: undefined,
    preferences: undefined,
  };

  return (
    <div
      data-testid="active-member-dashboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      <BenefitHero
        firstName={effectiveMember.first_name}
        hireDate={effectiveMember.hire_date}
        estimatedMonthly={estimatedMonthly}
        useDemo={useDemo}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <ActionItems items={actionItems} />
        <MilestoneTimeline milestones={milestones} />
      </div>

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
