import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import type { MemberPersona } from '@/types/MemberPortal';

// ── Navigation item configuration ────────────────────────────────────────────

export interface SidebarNavItem {
  key: string;
  label: string;
  icon: string;
  personas: MemberPersona[];
  badge?: number;
}

const NAV_ITEMS: SidebarNavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: '⌂',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
  },
  {
    key: 'profile',
    label: 'My Profile',
    icon: '◉',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
  },
  { key: 'calculator', label: 'Plan My Retirement', icon: '◈', personas: ['active', 'inactive'] },
  { key: 'benefit', label: 'My Benefit', icon: '◈', personas: ['retiree', 'beneficiary'] },
  {
    key: 'documents',
    label: 'Documents',
    icon: '▤',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: '✉',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
  },
  {
    key: 'letters',
    label: 'Letters',
    icon: '📄',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
  },
  { key: 'retirement-app', label: 'Retire', icon: '★', personas: ['active'] },
  { key: 'refund', label: 'Refund', icon: '↩', personas: ['inactive'] },
  { key: 'tax-documents', label: 'Tax Documents', icon: '⊞', personas: ['retiree'] },
];

// ── Props ────────────────────────────────────────────────────────────────────

export interface MemberPortalSidebarProps {
  personas: MemberPersona[];
  activeSection: string;
  onNavigate: (section: string) => void;
  badgeCounts?: Record<string, number>;
  collapsed?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MemberPortalSidebar({
  personas,
  activeSection,
  onNavigate,
  badgeCounts = {},
  collapsed: controlledCollapsed,
}: MemberPortalSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;

  const visibleItems = NAV_ITEMS.filter((item) => item.personas.some((p) => personas.includes(p)));

  return (
    <nav
      role="navigation"
      aria-label="Member portal navigation"
      data-tour-id="sidebar-nav"
      style={{
        width: collapsed ? 56 : 220,
        minHeight: '100vh',
        background: C.cardBgAccent,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: BODY,
        transition: 'width 200ms ease',
        flexShrink: 0,
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setInternalCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        data-testid="sidebar-toggle"
        style={{
          background: 'none',
          border: 'none',
          color: C.textOnDarkMuted,
          cursor: 'pointer',
          padding: '16px 16px 8px',
          textAlign: collapsed ? 'center' : 'right',
          fontSize: 18,
        }}
      >
        {collapsed ? '▸' : '◂'}
      </button>

      {/* Navigation items */}
      <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0', flex: 1 }}>
        {visibleItems.map((item) => {
          const isActive = activeSection === item.key;
          const badge = badgeCounts[item.key] ?? item.badge ?? 0;

          return (
            <li key={item.key}>
              <button
                onClick={() => onNavigate(item.key)}
                aria-current={isActive ? 'page' : undefined}
                data-tour-id={`nav-${item.key}`}
                data-testid={`nav-${item.key}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  width: '100%',
                  padding: collapsed ? '10px 0' : '10px 20px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(91, 138, 114, 0.25)' : 'transparent',
                  borderLeft: isActive ? `3px solid ${C.sage}` : '3px solid transparent',
                  color: isActive ? C.textOnDark : C.textOnDarkMuted,
                  fontFamily: BODY,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  border: 'none',
                  borderLeftStyle: 'solid',
                  borderLeftWidth: 3,
                  borderLeftColor: isActive ? C.sage : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && badge > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: C.coral,
                      color: '#fff',
                      borderRadius: 10,
                      padding: '1px 7px',
                      fontSize: 11,
                      fontWeight: 600,
                      minWidth: 18,
                      textAlign: 'center',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Help link at bottom */}
      <button
        onClick={() => onNavigate('help')}
        data-tour-id="nav-help"
        data-testid="nav-help"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '16px 0' : '16px 20px',
          background: 'none',
          border: 'none',
          color: C.textOnDarkDim,
          fontFamily: BODY,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 16 }}>?</span>
        {!collapsed && <span>Help & Support</span>}
      </button>
    </nav>
  );
}

export { NAV_ITEMS };
