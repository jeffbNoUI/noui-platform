import { useState } from 'react';
import { useMember } from '@/hooks/useMember';
import { resolveMemberPersona } from '@/types/MemberPortal';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { MemberPortalProps } from './MemberPortalUtils';
import { DEMO_MEMBER } from './MemberPortalUtils';
import MemberPortalShell from './MemberPortalShell';
import DashboardRouter from './dashboard/DashboardRouter';
import ProfileSection from './profile/ProfileSection';
import CalculatorSection from './calculator/CalculatorSection';
import TourProvider from './tour/TourProvider';

// ── Main Component ───────────────────────────────────────────────────────────

export default function MemberPortal({ memberID, retirementDate }: MemberPortalProps) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [tourCompleted, setTourCompleted] = useState(false);

  const { data: member, isLoading: memberLoading, error: memberError } = useMember(memberID);

  // Use real data if available, demo data as fallback
  const effectiveMember = member ?? (memberError ? DEMO_MEMBER : null);

  if (memberLoading || !effectiveMember) {
    return (
      <div
        data-testid="member-portal-loading"
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

  // Resolve persona(s) from member status
  const personas = resolveMemberPersona(effectiveMember);

  return (
    <TourProvider
      persona={personas[0]}
      tourCompleted={tourCompleted}
      tourVersion={1}
      onTourComplete={() => setTourCompleted(true)}
      autoStart={!tourCompleted}
    >
      <MemberPortalShell
        memberId={memberID}
        personas={personas}
        activeSection={activeSection}
        onNavigate={setActiveSection}
      >
        {activeSection === 'dashboard' && (
          <DashboardRouter
            memberId={memberID}
            personas={personas}
            retirementDate={retirementDate}
            onNavigate={setActiveSection}
          />
        )}
        {activeSection === 'profile' && <ProfileSection memberId={memberID} personas={personas} />}
        {activeSection === 'calculator' && <CalculatorSection memberId={memberID} />}
        {activeSection !== 'dashboard' &&
          activeSection !== 'profile' &&
          activeSection !== 'calculator' && (
            <div
              data-testid={`section-${activeSection}`}
              style={{
                padding: 32,
                textAlign: 'center',
                color: C.textSecondary,
                fontFamily: BODY,
              }}
            >
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} section coming soon
            </div>
          )}
      </MemberPortalShell>
    </TourProvider>
  );
}
