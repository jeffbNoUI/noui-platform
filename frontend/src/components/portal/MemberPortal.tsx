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
import ApplicationSection from './application/ApplicationSection';
import BenefitSection from './benefit/BenefitSection';
import MessagesSection from './messages/MessagesSection';
import DocumentSection from './documents/DocumentSection';
import DeferredBenefitExplorer from './inactive/DeferredBenefitExplorer';
import RefundEstimate from './inactive/RefundEstimate';
import RefundApplication from './inactive/RefundApplication';
import PreferencesSection from './preferences/PreferencesSection';
import NotificationBell from './shared/NotificationBell';
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
        header={
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px' }}>
            <NotificationBell
              memberId={String(memberID)}
              onNotificationClick={() => setActiveSection('messages')}
            />
          </div>
        }
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
        {activeSection === 'retirement-app' && (
          <ApplicationSection memberId={memberID} personas={personas} />
        )}
        {activeSection === 'benefit' && <BenefitSection memberId={memberID} personas={personas} />}
        {activeSection === 'projections' && (
          <DeferredBenefitExplorer
            memberId={memberID}
            onBack={() => setActiveSection('dashboard')}
          />
        )}
        {activeSection === 'refund' && (
          <RefundEstimate
            memberId={memberID}
            onStartApplication={() => setActiveSection('refund-apply')}
            onBack={() => setActiveSection('dashboard')}
          />
        )}
        {activeSection === 'refund-apply' && (
          <RefundApplication memberId={memberID} onBack={() => setActiveSection('refund')} />
        )}
        {activeSection === 'documents' && <DocumentSection memberId={String(memberID)} />}
        {activeSection === 'messages' && <MessagesSection memberId={String(memberID)} />}
        {activeSection === 'preferences' && <PreferencesSection memberId={String(memberID)} />}
        {activeSection !== 'dashboard' &&
          activeSection !== 'profile' &&
          activeSection !== 'calculator' &&
          activeSection !== 'retirement-app' &&
          activeSection !== 'benefit' &&
          activeSection !== 'projections' &&
          activeSection !== 'refund' &&
          activeSection !== 'refund-apply' &&
          activeSection !== 'documents' &&
          activeSection !== 'messages' &&
          activeSection !== 'preferences' && (
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
