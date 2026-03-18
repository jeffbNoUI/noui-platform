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

  // Quick links
  const quickLinks = [
    { key: 'projections', label: 'Explore retirement scenarios', icon: '◈' },
    { key: 'profile', label: 'Update my profile', icon: '◉' },
  ];

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

      {/* Quick link cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
