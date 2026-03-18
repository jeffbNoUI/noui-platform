import { C, BODY } from '@/lib/designSystem';
import type { MemberPersona } from '@/types/MemberPortal';

// ── Tab configuration ───────────────────────────────────────────────────────

export interface ProfileTab {
  key: string;
  label: string;
  personas: MemberPersona[];
}

const PROFILE_TABS: ProfileTab[] = [
  {
    key: 'personal',
    label: 'Personal Info',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
  },
  {
    key: 'addresses',
    label: 'Addresses',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
  },
  { key: 'beneficiaries', label: 'Beneficiaries', personas: ['active', 'inactive', 'retiree'] },
  { key: 'employment', label: 'Employment', personas: ['active', 'inactive', 'retiree'] },
  { key: 'contributions', label: 'Contributions', personas: ['active', 'inactive'] },
  { key: 'service-credit', label: 'Service Credit', personas: ['active', 'inactive'] },
];

export { PROFILE_TABS };

// ── Props ───────────────────────────────────────────────────────────────────

interface ProfileTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  personas: MemberPersona[];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ProfileTabNav({ activeTab, onTabChange, personas }: ProfileTabNavProps) {
  const visibleTabs = PROFILE_TABS.filter((tab) => tab.personas.some((p) => personas.includes(p)));

  return (
    <nav
      role="tablist"
      aria-label="Profile sections"
      data-testid="profile-tab-nav"
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
            data-testid={`profile-tab-${tab.key}`}
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
