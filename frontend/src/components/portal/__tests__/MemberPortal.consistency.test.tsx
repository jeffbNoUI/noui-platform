import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortalShell from '../MemberPortalShell';
import NavigationCard from '../NavigationCard';
import Breadcrumb from '../Breadcrumb';
import { C } from '@/lib/designSystem';

// JSDOM normalizes hex colors to rgb()
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MemberPortal — Design System & Card Consistency', () => {
  // ── Shell design system usage ─────────────────────────────────────────────

  describe('MemberPortalShell design system', () => {
    it('applies background, font, and text color from design system', () => {
      renderWithProviders(
        <MemberPortalShell>
          <div>Content</div>
        </MemberPortalShell>,
      );

      const shell = screen.getByTestId('member-portal-shell');
      expect(shell.style.background).toBe(hexToRgb('#F8F7F4'));
      expect(shell.style.fontFamily).toContain('Plus Jakarta Sans');
      expect(shell.style.color).toBe(hexToRgb('#2C2A26'));
    });

    it('has main landmark with max-width constraint', () => {
      renderWithProviders(
        <MemberPortalShell>
          <div>Content</div>
        </MemberPortalShell>,
      );

      const main = screen.getByRole('main');
      expect(main.style.maxWidth).toBe('1320px');
    });
  });

  // ── NavigationCard design consistency ───────────────────────────────────────

  describe('NavigationCard design', () => {
    it('renders with correct border radius', () => {
      renderWithProviders(
        <NavigationCard
          icon="◉"
          title="Test Card"
          tourId="card-test"
          accentColor={C.sage}
          onClick={vi.fn()}
        />,
      );

      const card = screen.getByTestId('card-test');
      expect(card.style.borderRadius).toBe('12px');
    });

    it('renders badge when badgeCount > 0', () => {
      renderWithProviders(
        <NavigationCard
          icon="✉"
          title="Messages"
          badgeCount={5}
          tourId="card-messages"
          accentColor={C.coral}
          onClick={vi.fn()}
        />,
      );

      expect(screen.getByTestId('badge-messages')).toBeInTheDocument();
      expect(screen.getByTestId('badge-messages')).toHaveTextContent('5');
    });

    it('does not render badge when badgeCount is 0', () => {
      renderWithProviders(
        <NavigationCard
          icon="✉"
          title="Messages"
          badgeCount={0}
          tourId="card-messages"
          accentColor={C.coral}
          onClick={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('badge-messages')).not.toBeInTheDocument();
    });

    it('renders learning hint when provided', () => {
      const hint = {
        id: 'test-hint',
        cardKey: 'test',
        personas: ['active' as const],
        teaser: 'Test hint teaser',
        expanded: 'Test hint expanded content',
      };

      renderWithProviders(
        <NavigationCard
          icon="◉"
          title="Test"
          hint={hint}
          tourId="card-test"
          accentColor={C.sage}
          onClick={vi.fn()}
        />,
      );

      expect(screen.getByTestId('hint-test-hint')).toBeInTheDocument();
      expect(screen.getByText('Test hint teaser')).toBeInTheDocument();
    });

    it('fires onClick when card is clicked', () => {
      const onClick = vi.fn();
      renderWithProviders(
        <NavigationCard
          icon="◉"
          title="Test"
          tourId="card-test"
          accentColor={C.sage}
          onClick={onClick}
        />,
      );

      screen.getByTestId('card-test').click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // ── Breadcrumb consistency ────────────────────────────────────────────────

  describe('Breadcrumb design', () => {
    it('does not render when trail has only Home', () => {
      renderWithProviders(
        <Breadcrumb trail={[{ section: 'dashboard', label: 'Home' }]} onNavigate={vi.fn()} />,
      );

      expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
    });

    it('renders trail with clickable segments', () => {
      renderWithProviders(
        <Breadcrumb
          trail={[
            { section: 'dashboard', label: 'Home' },
            { section: 'documents', label: 'Documents' },
          ]}
          onNavigate={vi.fn()}
        />,
      );

      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-dashboard')).toBeInTheDocument();
    });

    it('marks last segment with aria-current="page"', () => {
      renderWithProviders(
        <Breadcrumb
          trail={[
            { section: 'dashboard', label: 'Home' },
            { section: 'documents', label: 'Documents' },
          ]}
          onNavigate={vi.fn()}
        />,
      );

      const lastSegment = screen.getByText('Documents');
      expect(lastSegment).toHaveAttribute('aria-current', 'page');
    });

    it('has navigation landmark with aria-label', () => {
      renderWithProviders(
        <Breadcrumb
          trail={[
            { section: 'dashboard', label: 'Home' },
            { section: 'documents', label: 'Documents' },
          ]}
          onNavigate={vi.fn()}
        />,
      );

      const nav = screen.getByTestId('breadcrumb');
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    });
  });
});
