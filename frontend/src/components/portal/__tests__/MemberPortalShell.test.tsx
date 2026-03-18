import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberPortalShell from '../MemberPortalShell';

describe('MemberPortalShell', () => {
  const defaultProps = {
    memberId: 10001,
    personas: ['active' as const],
    activeSection: 'dashboard',
    onNavigate: vi.fn(),
  };

  it('renders the shell with sidebar and main content area', () => {
    renderWithProviders(
      <MemberPortalShell {...defaultProps}>
        <div data-testid="test-content">Hello</div>
      </MemberPortalShell>,
    );
    expect(screen.getByTestId('member-portal-shell')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('renders optional header slot', () => {
    renderWithProviders(
      <MemberPortalShell {...defaultProps} header={<div data-testid="custom-header">Header</div>}>
        <div>Content</div>
      </MemberPortalShell>,
    );
    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
  });

  it('delegates navigation to onNavigate callback', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <MemberPortalShell {...defaultProps} onNavigate={onNavigate}>
        <div>Content</div>
      </MemberPortalShell>,
    );
    fireEvent.click(screen.getByTestId('nav-profile'));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('passes badge counts to sidebar', () => {
    renderWithProviders(
      <MemberPortalShell {...defaultProps} badgeCounts={{ messages: 5 }}>
        <div>Content</div>
      </MemberPortalShell>,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('filters sidebar items based on persona', () => {
    renderWithProviders(
      <MemberPortalShell {...defaultProps} personas={['retiree']}>
        <div>Content</div>
      </MemberPortalShell>,
    );
    expect(screen.getByTestId('nav-benefit')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-calculator')).not.toBeInTheDocument();
  });
});
