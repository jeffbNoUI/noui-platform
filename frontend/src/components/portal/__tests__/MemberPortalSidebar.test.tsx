import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortalSidebar from '../MemberPortalSidebar';

describe('MemberPortalSidebar', () => {
  const defaultProps = {
    personas: ['active' as const],
    activeSection: 'dashboard',
    onNavigate: vi.fn(),
  };

  it('renders navigation landmark', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('shows correct items for active member persona', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} />);
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-profile')).toBeInTheDocument();
    expect(screen.getByTestId('nav-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('nav-documents')).toBeInTheDocument();
    expect(screen.getByTestId('nav-messages')).toBeInTheDocument();
    expect(screen.getByTestId('nav-retirement-app')).toBeInTheDocument();
    // Retiree-only items should not appear
    expect(screen.queryByTestId('nav-benefit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-tax-documents')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-refund')).not.toBeInTheDocument();
  });

  it('shows correct items for retiree persona', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} personas={['retiree']} />);
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-benefit')).toBeInTheDocument();
    expect(screen.getByTestId('nav-tax-documents')).toBeInTheDocument();
    // Active-only items should not appear
    expect(screen.queryByTestId('nav-calculator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-retirement-app')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-refund')).not.toBeInTheDocument();
  });

  it('shows correct items for inactive persona', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} personas={['inactive']} />);
    expect(screen.getByTestId('nav-refund')).toBeInTheDocument();
    expect(screen.getByTestId('nav-calculator')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-benefit')).not.toBeInTheDocument();
  });

  it('shows correct items for beneficiary persona', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} personas={['beneficiary']} />);
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-benefit')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-calculator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-refund')).not.toBeInTheDocument();
  });

  it('highlights the active section with aria-current', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} />);
    const dashboardBtn = screen.getByTestId('nav-dashboard');
    expect(dashboardBtn).toHaveAttribute('aria-current', 'page');
    // Non-active items should not have aria-current
    const profileBtn = screen.getByTestId('nav-profile');
    expect(profileBtn).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate when a nav item is clicked', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<MemberPortalSidebar {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTestId('nav-profile'));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('renders badge counts when provided', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} badgeCounts={{ messages: 3 }} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders help link at the bottom', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} />);
    expect(screen.getByTestId('nav-help')).toBeInTheDocument();
    expect(screen.getByText('Help & Support')).toBeInTheDocument();
  });

  it('hides labels when collapsed', () => {
    renderWithProviders(<MemberPortalSidebar {...defaultProps} collapsed={true} />);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
  });

  it('shows items for dual-persona (active + beneficiary)', () => {
    renderWithProviders(
      <MemberPortalSidebar {...defaultProps} personas={['active', 'beneficiary']} />,
    );
    // Active items
    expect(screen.getByTestId('nav-calculator')).toBeInTheDocument();
    expect(screen.getByTestId('nav-retirement-app')).toBeInTheDocument();
    // Beneficiary items
    expect(screen.getByTestId('nav-benefit')).toBeInTheDocument();
  });
});
