import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { MemberPersona } from '@/types/MemberPortal';
import ProfileTabNav, { PROFILE_TABS } from './ProfileTabNav';
import PersonalInfoTab from './PersonalInfoTab';
import AddressesTab from './AddressesTab';
import BeneficiariesTab from './BeneficiariesTab';
import EmploymentHistoryTab from './EmploymentHistoryTab';
import ContributionsTab from './ContributionsTab';
import ServiceCreditTab from './ServiceCreditTab';

// ── Props ───────────────────────────────────────────────────────────────────

export interface ProfileSectionProps {
  memberId: number;
  personas: MemberPersona[];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ProfileSection({ memberId, personas }: ProfileSectionProps) {
  // Default to first visible tab
  const visibleTabs = PROFILE_TABS.filter((tab) => tab.personas.some((p) => personas.includes(p)));
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key ?? 'personal');

  return (
    <div data-testid="profile-section">
      <h1
        style={{
          fontFamily: DISPLAY,
          fontSize: 28,
          fontWeight: 700,
          color: C.navy,
          margin: '0 0 4px',
        }}
      >
        My Profile
      </h1>
      <p
        style={{
          fontFamily: BODY,
          fontSize: 14,
          color: C.textSecondary,
          margin: '0 0 24px',
        }}
      >
        View and manage your personal information
      </p>

      <ProfileTabNav activeTab={activeTab} onTabChange={setActiveTab} personas={personas} />

      <div data-testid={`profile-tab-content-${activeTab}`}>
        {activeTab === 'personal' && <PersonalInfoTab memberId={memberId} />}
        {activeTab === 'addresses' && <AddressesTab memberId={memberId} />}
        {activeTab === 'beneficiaries' && <BeneficiariesTab memberId={memberId} />}
        {activeTab === 'employment' && <EmploymentHistoryTab memberId={memberId} />}
        {activeTab === 'contributions' && <ContributionsTab memberId={memberId} />}
        {activeTab === 'service-credit' && <ServiceCreditTab memberId={memberId} />}
      </div>
    </div>
  );
}
