import { C, BODY } from '@/lib/designSystem';
import type { MemberPersona } from '@/types/MemberPortal';
import ActiveMemberDashboard from './ActiveMemberDashboard';
import RetireeDashboard from './RetireeDashboard';
import InactiveMemberDashboard from './InactiveMemberDashboard';
import BeneficiaryDashboard from './BeneficiaryDashboard';

export interface DashboardRouterProps {
  memberId: number;
  personas: MemberPersona[];
  retirementDate: string;
  benefitType?: 'survivor' | 'lump_sum';
  onNavigate?: (section: string) => void;
}

const PERSONA_LABELS: Record<MemberPersona, string> = {
  active: 'Active Member',
  inactive: 'Inactive Member',
  retiree: 'Retiree',
  beneficiary: 'Beneficiary',
};

export default function DashboardRouter({
  memberId,
  personas,
  retirementDate,
  benefitType = 'survivor',
  onNavigate,
}: DashboardRouterProps) {
  const primary = personas[0];
  const isDualRole = personas.length > 1;

  const renderDashboard = (persona: MemberPersona) => {
    switch (persona) {
      case 'active':
        return (
          <ActiveMemberDashboard
            memberId={memberId}
            retirementDate={retirementDate}
            onNavigate={onNavigate}
          />
        );
      case 'retiree':
        return <RetireeDashboard memberId={memberId} onNavigate={onNavigate} />;
      case 'inactive':
        return <InactiveMemberDashboard memberId={memberId} onNavigate={onNavigate} />;
      case 'beneficiary':
        return (
          <BeneficiaryDashboard
            memberId={memberId}
            benefitType={benefitType}
            onNavigate={onNavigate}
          />
        );
      default:
        return null;
    }
  };

  if (!isDualRole) {
    return <div data-testid="dashboard-router">{renderDashboard(primary)}</div>;
  }

  // Dual-role: show sections for each persona
  return (
    <div
      data-testid="dashboard-router"
      style={{ display: 'flex', flexDirection: 'column', gap: 32 }}
    >
      {personas.map((persona) => (
        <section key={persona} data-testid={`dashboard-section-${persona}`}>
          <h2
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              color: C.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 16,
              paddingBottom: 8,
              borderBottom: `1px solid ${C.borderLight}`,
            }}
          >
            {PERSONA_LABELS[persona]}
          </h2>
          {renderDashboard(persona)}
        </section>
      ))}
    </div>
  );
}
