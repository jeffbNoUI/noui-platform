import { C } from '@/lib/designSystem';
import { formatDate, tierName } from './MemberPortalUtils';
import type { Milestone } from './MemberPortalUtils';
import type { ProjectionDataPoint } from './BenefitProjectionChart';
import type { ContributionDataPoint } from './ContributionBars';
import AIChatPanel from './AIChatPanel';
import StatPill from './MemberPortalStatPill';
import MemberPortalMilestones from './MemberPortalMilestones';
import MemberPortalRecentMessages from './MemberPortalRecentMessages';
import MemberPortalProjections from './MemberPortalProjections';
import MemberPortalContributions from './MemberPortalContributions';

interface MemberPortalDashboardProps {
  loaded: boolean;
  showChat: boolean;
  currentBalance: number;
  tierCode: number;
  employeeContrib: number;
  employerContrib: number;
  estimatedAnnual: number;
  memberID: number;
  setActiveView: (view: string) => void;
  projectionData: ProjectionDataPoint[];
  contribHistory: ContributionDataPoint[];
  milestones: Milestone[];
  beneficiaryText: string;
  hireDate: string;
  retirementDate: string;
}

export default function MemberPortalDashboard({
  loaded,
  showChat,
  currentBalance,
  tierCode,
  employeeContrib,
  employerContrib,
  estimatedAnnual,
  memberID,
  setActiveView,
  projectionData,
  contribHistory,
  milestones,
  beneficiaryText,
  hireDate,
  retirementDate,
}: MemberPortalDashboardProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showChat ? '1fr 360px' : '1fr',
        gap: 20,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Left: Dashboard content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        {/* Stat cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'none' : 'translateY(8px)',
            transition: 'all 0.5s ease 0.1s',
          }}
        >
          <StatPill
            label="Current Account Balance"
            value={currentBalance > 0 ? `$${(currentBalance / 1000).toFixed(0)}k` : '\u2014'}
            sub={currentBalance > 0 ? `${tierName(tierCode)} Member` : undefined}
          />
          <StatPill
            label="Employee Contributions"
            value={employeeContrib > 0 ? `$${(employeeContrib / 1000).toFixed(0)}k` : '\u2014'}
            sub="Lifetime total"
            color={C.gold}
          />
          <StatPill
            label="Employer Contributions"
            value={employerContrib > 0 ? `$${(employerContrib / 1000).toFixed(0)}k` : '\u2014'}
            sub={
              employerContrib > 0
                ? `${(employerContrib / Math.max(employeeContrib, 1)).toFixed(2)}\u00D7 match`
                : undefined
            }
            color={C.navyLight}
          />
          <StatPill
            label="Est. Annual Benefit"
            value={estimatedAnnual > 0 ? `$${(estimatedAnnual / 1000).toFixed(0)}k` : '\u2014'}
            sub={estimatedAnnual > 0 ? `At retirement` : undefined}
            color={C.sage}
          />
        </div>

        {/* Recent Messages card */}
        <MemberPortalRecentMessages
          memberID={memberID}
          onViewAll={() => setActiveView('messages')}
        />

        {/* Projection chart */}
        <MemberPortalProjections loaded={loaded} projectionData={projectionData} />

        {/* Bottom row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            opacity: loaded ? 1 : 0,
            transition: 'all 0.5s ease 0.35s',
          }}
        >
          <MemberPortalContributions contribHistory={contribHistory} />
          <MemberPortalMilestones milestones={milestones} />
        </div>

        {/* Personal details footer */}
        <div
          className="portal-card"
          style={{
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            opacity: loaded ? 1 : 0,
            transition: 'all 0.5s ease 0.45s',
          }}
        >
          {[
            { label: 'Beneficiary', value: beneficiaryText },
            { label: 'Hire Date', value: formatDate(hireDate) },
            { label: 'Retirement Date', value: formatDate(retirementDate) },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 500 }}>
                {item.label}:
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{item.value}</span>
              {i < 2 && (
                <div style={{ width: 1, height: 20, background: C.borderLight, marginLeft: 24 }} />
              )}
            </div>
          ))}
        </div>

        {/* Phase 1 transparency footer */}
        <div
          style={{
            padding: '14px 20px',
            borderRadius: 12,
            background: C.cardBgWarm,
            border: `1px solid ${C.borderLight}`,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 2 }}>
            Phase 1: Transparent
          </p>
          <p style={{ fontSize: 11, color: C.textTertiary }}>
            The system shows its work. Every calculation is transparent and verifiable. The
            deterministic rules engine executes certified plan provisions.
          </p>
        </div>
      </div>

      {/* Right: AI Chat Panel */}
      {showChat && <AIChatPanel />}
    </div>
  );
}
