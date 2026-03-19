import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortalSidebar from '../MemberPortalSidebar';
import MemberPortalShell from '../MemberPortalShell';

// JSDOM normalizes hex colors to rgb() — helper to convert for comparison
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MemberPortal — Design System & Landmark Consistency', () => {
  // ── Shell design system usage ─────────────────────────────────────────────

  describe('MemberPortalShell design system', () => {
    it('applies background, font, and text color from design system', () => {
      renderWithProviders(
        <MemberPortalShell
          memberId={10001}
          personas={['active']}
          activeSection="dashboard"
          onNavigate={vi.fn()}
        >
          <div>Content</div>
        </MemberPortalShell>,
      );

      const shell = screen.getByTestId('member-portal-shell');
      // JSDOM converts hex to rgb — verify the values are present
      expect(shell.style.background).toBe(hexToRgb('#F8F7F4'));
      // JSDOM normalizes quotes — just check the font name is present
      expect(shell.style.fontFamily).toContain('Plus Jakarta Sans');
      expect(shell.style.color).toBe(hexToRgb('#2C2A26'));
    });
  });

  // ── Sidebar design system usage ───────────────────────────────────────────

  describe('MemberPortalSidebar design system', () => {
    it('uses dark accent background for sidebar nav', () => {
      renderWithProviders(
        <MemberPortalSidebar
          personas={['active']}
          activeSection="dashboard"
          onNavigate={vi.fn()}
        />,
      );

      const nav = screen.getByRole('navigation');
      expect(nav.style.background).toBe(hexToRgb('#1B2E4A'));
    });

    it('active nav item has sage-colored left border', () => {
      renderWithProviders(
        <MemberPortalSidebar personas={['active']} activeSection="profile" onNavigate={vi.fn()} />,
      );

      const profileBtn = screen.getByTestId('nav-profile');
      expect(profileBtn.style.borderLeftColor).toBe(hexToRgb('#5B8A72'));
    });

    it('inactive nav item has transparent left border', () => {
      renderWithProviders(
        <MemberPortalSidebar personas={['active']} activeSection="profile" onNavigate={vi.fn()} />,
      );

      const dashboardBtn = screen.getByTestId('nav-dashboard');
      expect(dashboardBtn.style.borderLeftColor).toBe('transparent');
    });

    it('badge count renders inside the button', () => {
      renderWithProviders(
        <MemberPortalSidebar
          personas={['active']}
          activeSection="dashboard"
          onNavigate={vi.fn()}
          badgeCounts={{ messages: 5 }}
        />,
      );

      const messagesBtn = screen.getByTestId('nav-messages');
      expect(messagesBtn.textContent).toContain('5');
    });

    it('collapsed sidebar has 56px width', () => {
      renderWithProviders(
        <MemberPortalSidebar
          personas={['active']}
          activeSection="dashboard"
          onNavigate={vi.fn()}
          collapsed={true}
        />,
      );

      const nav = screen.getByRole('navigation');
      expect(nav.style.width).toBe('56px');
    });

    it('expanded sidebar has 220px width', () => {
      renderWithProviders(
        <MemberPortalSidebar
          personas={['active']}
          activeSection="dashboard"
          onNavigate={vi.fn()}
          collapsed={false}
        />,
      );

      const nav = screen.getByRole('navigation');
      expect(nav.style.width).toBe('220px');
    });

    it('collapsed sidebar hides label text', () => {
      renderWithProviders(
        <MemberPortalSidebar
          personas={['active']}
          activeSection="dashboard"
          onNavigate={vi.fn()}
          collapsed={true}
        />,
      );

      // When collapsed, button text should not include the label
      const dashboardBtn = screen.getByTestId('nav-dashboard');
      expect(dashboardBtn.textContent).not.toContain('Dashboard');
    });
  });
});
