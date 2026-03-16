import { useState, useEffect } from 'react';
import { useMember, useContributions, useBeneficiaries } from '@/hooks/useMember';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import { C, DISPLAY, BODY } from '@/lib/designSystem';
import type { ContributionDataPoint } from './ContributionBars';
import MemberCorrespondenceTab from './MemberCorrespondenceTab';
import MemberPortalHeader from './MemberPortalHeader';
import MemberPortalHero from './MemberPortalHero';
import MemberPortalDashboard from './MemberPortalDashboard';
import MemberMessageCenter from './MemberPortalMessages';
import {
  type MemberPortalProps,
  DEMO_MEMBER,
  DEMO_CONTRIBUTIONS,
  DEMO_MONTHLY_BENEFIT,
  yearsOfService,
  isVested,
  buildProjectionData,
  buildMilestones,
} from './MemberPortalUtils';

// ── Main Component ───────────────────────────────────────────────────────────

export default function MemberPortal({
  memberID,
  retirementDate,
  onSwitchToWorkspace,
  onSwitchToCRM,
}: MemberPortalProps) {
  const [loaded, setLoaded] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [showChat, setShowChat] = useState(true);

  const { data: member, isLoading: memberLoading, error: memberError } = useMember(memberID);
  const { data: contributions } = useContributions(memberID);
  const { data: beneficiaries } = useBeneficiaries(memberID);
  const { data: calculation } = useBenefitCalculation(memberID, retirementDate);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 80);
  }, []);

  // Use real data if available, demo data as fallback
  const useDemo = !member && !memberLoading;
  const effectiveMember = member ?? (memberError ? DEMO_MEMBER : null);

  if (memberLoading || !effectiveMember) {
    return (
      <div
        style={{
          fontFamily: BODY,
          background: C.pageBg,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            N
          </div>
          <div style={{ color: C.textSecondary, fontSize: 16, fontFamily: BODY }}>
            Loading member data...
          </div>
        </div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const firstName = effectiveMember.first_name;
  const fullName = `${effectiveMember.first_name}${effectiveMember.middle_name ? ` ${effectiveMember.middle_name.charAt(0)}.` : ''} ${effectiveMember.last_name}`;
  const memberId = `DERP-${String(effectiveMember.member_id).padStart(7, '0')}`;
  const svcYears = yearsOfService(effectiveMember.hire_date);
  const vested = isVested(effectiveMember.hire_date);

  // Benefit calculation data — maximum_benefit is the final monthly amount
  const estimatedMonthly = calculation?.maximum_benefit ?? (useDemo ? DEMO_MONTHLY_BENEFIT : 0);
  const estimatedAnnual = estimatedMonthly * 12;

  // Contribution data
  const effectiveContrib = contributions ?? (useDemo ? DEMO_CONTRIBUTIONS : null);
  const employeeContrib = effectiveContrib?.total_ee_contributions ?? 0;
  const employerContrib = effectiveContrib?.total_er_contributions ?? 0;
  const currentBalance =
    (effectiveContrib?.current_ee_balance ?? 0) + (effectiveContrib?.current_er_balance ?? 0);

  // Annual contribution estimate
  const annualContrib = (employeeContrib + employerContrib) / Math.max(svcYears, 1);

  // Retirement year from the date
  const retirementYear = new Date(retirementDate + 'T00:00:00').getFullYear();

  // Build projection data
  const projectionData = buildProjectionData(currentBalance, annualContrib, retirementYear);

  // Build contribution history (last 6 years estimated)
  const currentYear = new Date().getFullYear();
  const contribHistory: ContributionDataPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const yr = currentYear - i;
    const scale = 1 + (5 - i) * 0.03;
    const empEstimate = Math.round(annualContrib * 0.4 * scale);
    const erEstimate = Math.round(annualContrib * 0.6 * scale);
    contribHistory.push({
      year: `'${(yr % 100).toString().padStart(2, '0')}`,
      employee: empEstimate,
      employer: erEstimate,
    });
  }

  // Milestones
  const milestones = buildMilestones(effectiveMember);

  // Beneficiary
  const primaryBeneficiary = beneficiaries?.[0] ?? null;
  const beneficiaryText = primaryBeneficiary
    ? `${primaryBeneficiary.first_name} ${primaryBeneficiary.last_name} (${primaryBeneficiary.relationship})`
    : 'Not on file';

  // ── Render ───────────────────────────────────────────────────────────────

  const navTabs = [
    { key: 'dashboard', label: 'My Benefits' },
    { key: 'messages', label: 'Messages' },
    { key: 'projections', label: 'Projections' },
    { key: 'history', label: 'History' },
    { key: 'documents', label: 'Documents' },
    { key: 'letters', label: 'Letters' },
  ];

  return (
    <div
      style={{
        fontFamily: BODY,
        background: C.pageBg,
        color: C.text,
        minHeight: '100vh',
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <MemberPortalHeader
        navTabs={navTabs}
        activeView={activeView}
        setActiveView={setActiveView}
        showChat={showChat}
        setShowChat={setShowChat}
        onSwitchToWorkspace={onSwitchToWorkspace}
        onSwitchToCRM={onSwitchToCRM}
        fullName={fullName}
        memberId={memberId}
        firstName={effectiveMember.first_name}
        lastName={effectiveMember.last_name}
      />

      <MemberPortalHero
        firstName={firstName}
        estimatedMonthly={estimatedMonthly}
        svcYears={svcYears}
        vested={vested}
        hireDate={effectiveMember.hire_date}
        useDemo={useDemo}
      />

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 32px 60px' }}>
        {activeView === 'messages' ? (
          <MemberMessageCenter
            memberID={memberID}
            onNavigateToDashboard={() => setActiveView('dashboard')}
          />
        ) : activeView === 'letters' ? (
          <MemberCorrespondenceTab memberId={memberID} />
        ) : (
          <MemberPortalDashboard
            loaded={loaded}
            showChat={showChat}
            currentBalance={currentBalance}
            tierCode={effectiveMember.tier_code}
            employeeContrib={employeeContrib}
            employerContrib={employerContrib}
            estimatedAnnual={estimatedAnnual}
            memberID={memberID}
            setActiveView={setActiveView}
            projectionData={projectionData}
            contribHistory={contribHistory}
            milestones={milestones}
            beneficiaryText={beneficiaryText}
            hireDate={effectiveMember.hire_date}
            retirementDate={retirementDate}
          />
        )}
      </div>
    </div>
  );
}
