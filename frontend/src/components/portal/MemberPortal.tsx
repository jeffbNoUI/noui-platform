import { useState, useCallback } from 'react';
import { useMember } from '@/hooks/useMember';
import { resolveMemberPersona } from '@/types/MemberPortal';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { MemberPortalProps } from './MemberPortalUtils';
import { DEMO_MEMBER } from './MemberPortalUtils';
import { getLabelForSection, type NavEntry } from './cardDefinitions';
import MemberPortalShell from './MemberPortalShell';
import Breadcrumb from './Breadcrumb';
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

// ── Navigation helpers ──────────────────────────────────────────────────────

const HOME: NavEntry = { section: 'dashboard', label: 'Home' };

// ── Main Component ───────────────────────────────────────────────────────────

export default function MemberPortal({ memberID, retirementDate }: MemberPortalProps) {
  const [navStack, setNavStack] = useState<NavEntry[]>([HOME]);
  const [tourCompleted, setTourCompleted] = useState(false);

  const { data: member, isLoading: memberLoading, error: memberError } = useMember(memberID);

  // Navigation actions
  const navigateTo = useCallback((section: string) => {
    setNavStack((prev) => [...prev, { section, label: getLabelForSection(section) }]);
  }, []);

  const navigateBack = useCallback((index: number) => {
    setNavStack((prev) => prev.slice(0, index + 1));
  }, []);

  const goHome = useCallback(() => {
    setNavStack([HOME]);
  }, []);

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
  const activeSection = navStack[navStack.length - 1].section;

  return (
    <TourProvider
      persona={personas[0]}
      tourCompleted={tourCompleted}
      tourVersion={1}
      onTourComplete={() => setTourCompleted(true)}
      autoStart={!tourCompleted}
    >
      <MemberPortalShell
        header={
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '12px 24px',
              maxWidth: 1320,
              margin: '0 auto',
              width: '100%',
            }}
          >
            <NotificationBell
              memberId={String(memberID)}
              onNotificationClick={() => navigateTo('messages')}
            />
          </div>
        }
      >
        <Breadcrumb trail={navStack} onNavigate={navigateBack} />

        {activeSection === 'dashboard' && (
          <DashboardRouter
            memberId={memberID}
            personas={personas}
            retirementDate={retirementDate}
            onNavigate={navigateTo}
          />
        )}
        {activeSection === 'profile' && <ProfileSection memberId={memberID} personas={personas} />}
        {activeSection === 'calculator' && <CalculatorSection memberId={memberID} />}
        {activeSection === 'retirement-app' && (
          <ApplicationSection memberId={memberID} personas={personas} />
        )}
        {activeSection === 'benefit' && (
          <BenefitSection memberId={memberID} personas={personas} retirementDate={retirementDate} />
        )}
        {activeSection === 'projections' && (
          <DeferredBenefitExplorer memberId={memberID} onBack={goHome} />
        )}
        {activeSection === 'refund' && (
          <RefundEstimate
            memberId={memberID}
            onStartApplication={() => navigateTo('refund-apply')}
            onBack={goHome}
          />
        )}
        {activeSection === 'refund-apply' && (
          <RefundApplication memberId={memberID} onBack={() => navigateTo('refund')} />
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
