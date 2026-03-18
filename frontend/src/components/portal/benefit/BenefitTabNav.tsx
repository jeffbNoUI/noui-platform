import { C, BODY } from '@/lib/designSystem';
import type { MemberPersona } from '@/types/MemberPortal';

// ── Tab configuration ───────────────────────────────────────────────────────

export interface BenefitTab {
  key: string;
  label: string;
  personas: MemberPersona[];
}

const BENEFIT_TABS: BenefitTab[] = [
  { key: 'payments', label: 'Payments', personas: ['retiree', 'beneficiary'] },
  { key: 'tax-documents', label: 'Tax Documents', personas: ['retiree', 'beneficiary'] },
  { key: 'benefit-details', label: 'Benefit Details', personas: ['retiree', 'beneficiary'] },
  { key: 'manage', label: 'Manage', personas: ['retiree'] },
];

export { BENEFIT_TABS };

// ── Props ───────────────────────────────────────────────────────────────────

interface BenefitTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  personas: MemberPersona[];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BenefitTabNav({ activeTab, onTabChange, personas }: BenefitTabNavProps) {
  const visibleTabs = BENEFIT_TABS.filter((tab) => tab.personas.some((p) => personas.includes(p)));

  return (
    <nav
      role="tablist"
      aria-label="Benefit sections"
      data-testid="benefit-tab-nav"
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 24,
        fontFamily: BODY,
      }}
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            data-testid={`benefit-tab-${tab.key}`}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${isActive ? C.sage : 'transparent'}`,
              color: isActive ? C.sage : C.textSecondary,
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              transition: 'color 150ms ease, border-color 150ms ease',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
