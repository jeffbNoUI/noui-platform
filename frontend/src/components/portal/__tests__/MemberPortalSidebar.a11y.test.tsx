import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortalSidebar from '../MemberPortalSidebar';
import MemberPortalShell from '../MemberPortalShell';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MemberPortalSidebar — Keyboard & ARIA Accessibility', () => {
  const defaultProps = {
    personas: ['active' as const],
    activeSection: 'dashboard',
    onNavigate: vi.fn(),
  };

  // ── ARIA landmarks & labels ───────────────────────────────────────────────

  describe('ARIA landmarks', () => {
    it('sidebar has role="navigation" with descriptive aria-label', () => {
      renderWithProviders(<MemberPortalSidebar {...defaultProps} />);
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Member portal navigation');
    });

    it('collapsed sidebar preserves navigation landmark', () => {
      renderWithProviders(<MemberPortalSidebar {...defaultProps} collapsed={true} />);
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Member portal navigation');
    });

    it('collapse toggle has accessible label that changes with state', () => {
      const { rerender } = renderWithProviders(<MemberPortalSidebar {...defaultProps} />);
      const toggle = screen.getByTestId('sidebar-toggle');
      expect(toggle).toHaveAttribute('aria-label', 'Collapse navigation');

      rerender(<MemberPortalSidebar {...defaultProps} collapsed={true} />);
      expect(screen.getByTestId('sidebar-toggle')).toHaveAttribute(
        'aria-label',
        'Expand navigation',
      );
    });
  });

  // ── aria-current tracking ─────────────────────────────────────────────────

  describe('aria-current', () => {
    it('marks active nav item with aria-current="page"', () => {
      renderWithProviders(<MemberPortalSidebar {...defaultProps} activeSection="profile" />);
      const profileBtn = screen.getByTestId('nav-profile');
      expect(profileBtn).toHaveAttribute('aria-current', 'page');
    });

    it('non-active items do not have aria-current', () => {
      renderWithProviders(<MemberPortalSidebar {...defaultProps} activeSection="profile" />);
      const dashboardBtn = screen.getByTestId('nav-dashboard');
      expect(dashboardBtn).not.toHaveAttribute('aria-current');
    });

    it('only one nav item has aria-current at a time', () => {
      renderWithProviders(<MemberPortalSidebar {...defaultProps} activeSection="calculator" />);
      const allButtons = screen.getAllByRole('button');
      const withCurrent = allButtons.filter((btn) => btn.getAttribute('aria-current') === 'page');
      expect(withCurrent).toHaveLength(1);
    });
  });

  // ── Focusability ──────────────────────────────────────────────────────────

  describe('focusability', () => {
    it('all nav buttons are focusable (no negative tabIndex)', () => {
      renderWithProviders(<MemberPortalSidebar {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => {
        const tabIndex = btn.getAttribute('tabindex');
        // Buttons are focusable by default; ensure none are explicitly excluded
        expect(tabIndex).not.toBe('-1');
      });
    });
  });

  // ── Keyboard activation ───────────────────────────────────────────────────

  describe('keyboard activation', () => {
    it('clicking a nav button calls onNavigate', () => {
      const onNavigate = vi.fn();
      renderWithProviders(<MemberPortalSidebar {...defaultProps} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByTestId('nav-profile'));
      expect(onNavigate).toHaveBeenCalledWith('profile');
    });

    it('badge count is within the button element for screen reader context', () => {
      renderWithProviders(<MemberPortalSidebar {...defaultProps} badgeCounts={{ messages: 3 }} />);

      const messagesBtn = screen.getByTestId('nav-messages');
      // Badge should be a child of the button, not a sibling
      expect(messagesBtn.textContent).toContain('3');
    });
  });

  // ── Shell landmarks ───────────────────────────────────────────────────────

  describe('MemberPortalShell landmarks', () => {
    it('has a main landmark', () => {
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

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has exactly one navigation and one main landmark', () => {
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

      expect(screen.getAllByRole('navigation')).toHaveLength(1);
      expect(screen.getAllByRole('main')).toHaveLength(1);
    });
  });
});
