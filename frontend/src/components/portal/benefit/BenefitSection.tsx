import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { MemberPersona } from '@/types/MemberPortal';
import BenefitTabNav, { BENEFIT_TABS } from './BenefitTabNav';
import PaymentsTab from './PaymentsTab';
import TaxDocumentsTab from './TaxDocumentsTab';
import BenefitDetailsTab from './BenefitDetailsTab';
import ManageTab from './ManageTab';

// ── Props ───────────────────────────────────────────────────────────────────

export interface BenefitSectionProps {
  memberId: number;
  personas: MemberPersona[];
  retirementDate: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BenefitSection({
  memberId,
  personas,
  retirementDate,
}: BenefitSectionProps) {
  const visibleTabs = BENEFIT_TABS.filter((tab) => tab.personas.some((p) => personas.includes(p)));
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key ?? 'payments');

  return (
    <div data-testid="benefit-section">
      <h1
        style={{
          fontFamily: DISPLAY,
          fontSize: 28,
          fontWeight: 700,
          color: C.navy,
          margin: '0 0 4px',
        }}
      >
        My Benefit
      </h1>
      <p
        style={{
          fontFamily: BODY,
          fontSize: 14,
          color: C.textSecondary,
          margin: '0 0 24px',
        }}
      >
        View your benefit payments, tax documents, and account details
      </p>

      <BenefitTabNav activeTab={activeTab} onTabChange={setActiveTab} personas={personas} />

      <div data-testid={`benefit-tab-content-${activeTab}`}>
        {activeTab === 'payments' && <PaymentsTab memberId={memberId} />}
        {activeTab === 'tax-documents' && <TaxDocumentsTab memberId={memberId} />}
        {activeTab === 'benefit-details' && (
          <BenefitDetailsTab memberId={memberId} retirementDate={retirementDate} />
        )}
        {activeTab === 'manage' && <ManageTab memberId={memberId} />}
      </div>
    </div>
  );
}
