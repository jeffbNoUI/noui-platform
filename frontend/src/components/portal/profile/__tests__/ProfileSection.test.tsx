import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ProfileSection from '../ProfileSection';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useMember', () => ({
  useMember: () => ({ data: undefined, isLoading: false, error: null }),
  useEmployment: () => ({ data: [] }),
  useContributions: () => ({ data: undefined }),
  useBeneficiaries: () => ({ data: [] }),
  useServiceCredit: () => ({ data: undefined }),
}));

vi.mock('@/hooks/useBenefitCalculation', () => ({
  useBenefitCalculation: () => ({ data: undefined }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ProfileSection', () => {
  it('renders the profile section with heading and tab navigation', () => {
    renderWithProviders(<ProfileSection memberId={10001} personas={['active']} />);
    expect(screen.getByTestId('profile-section')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-nav')).toBeInTheDocument();
  });

  it('shows all 6 tabs for active persona', () => {
    renderWithProviders(<ProfileSection memberId={10001} personas={['active']} />);
    expect(screen.getByTestId('profile-tab-personal')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-addresses')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-beneficiaries')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-employment')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-contributions')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-service-credit')).toBeInTheDocument();
  });

  it('shows only applicable tabs for beneficiary persona', () => {
    renderWithProviders(<ProfileSection memberId={10001} personas={['beneficiary']} />);
    expect(screen.getByTestId('profile-tab-personal')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-addresses')).toBeInTheDocument();
    // Beneficiaries don't see these tabs
    expect(screen.queryByTestId('profile-tab-beneficiaries')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-tab-employment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-tab-contributions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-tab-service-credit')).not.toBeInTheDocument();
  });

  it('shows retiree-appropriate tabs', () => {
    renderWithProviders(<ProfileSection memberId={10001} personas={['retiree']} />);
    expect(screen.getByTestId('profile-tab-personal')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-addresses')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-beneficiaries')).toBeInTheDocument();
    expect(screen.getByTestId('profile-tab-employment')).toBeInTheDocument();
    // Retirees don't see contributions or service credit
    expect(screen.queryByTestId('profile-tab-contributions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-tab-service-credit')).not.toBeInTheDocument();
  });

  it('defaults to personal info tab', () => {
    renderWithProviders(<ProfileSection memberId={10001} personas={['active']} />);
    expect(screen.getByTestId('profile-tab-content-personal')).toBeInTheDocument();
    expect(screen.getByTestId('personal-info-tab')).toBeInTheDocument();
  });

  it('switches tabs when clicked', () => {
    renderWithProviders(<ProfileSection memberId={10001} personas={['active']} />);
    fireEvent.click(screen.getByTestId('profile-tab-addresses'));
    expect(screen.getByTestId('profile-tab-content-addresses')).toBeInTheDocument();
    expect(screen.getByTestId('addresses-tab')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected', () => {
    renderWithProviders(<ProfileSection memberId={10001} personas={['active']} />);
    expect(screen.getByTestId('profile-tab-personal')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('profile-tab-addresses')).toHaveAttribute('aria-selected', 'false');
  });

  it('uses tablist role for navigation', () => {
    renderWithProviders(<ProfileSection memberId={10001} personas={['active']} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});
