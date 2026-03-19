import { C, BODY } from '@/lib/designSystem';

export type EmployerTab =
  | 'dashboard'
  | 'communications'
  | 'reporting'
  | 'enrollment'
  | 'terminations'
  | 'waret'
  | 'scp';

interface PortalNavProps {
  activeTab: EmployerTab;
  onTabChange: (tab: EmployerTab) => void;
}

const TABS: { id: EmployerTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'communications', label: 'Communications' },
  { id: 'reporting', label: 'Reporting' },
  { id: 'enrollment', label: 'Enrollment' },
  { id: 'terminations', label: 'Terminations' },
  { id: 'waret', label: 'WARET' },
  { id: 'scp', label: 'SCP' },
];

export default function PortalNav({ activeTab, onTabChange }: PortalNavProps) {
  return (
    <nav
      role="tablist"
      style={{
        fontFamily: BODY,
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${C.border}`,
        background: C.cardBg,
        padding: '0 32px',
        maxWidth: 1320,
        margin: '0 auto',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? C.navy : C.textSecondary,
              background: 'none',
              border: 'none',
              borderBottom: isActive ? `2px solid ${C.navy}` : '2px solid transparent',
              padding: '12px 20px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
