import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DashboardRouter from '../DashboardRouter';

// ── Mocks — mock the individual dashboards to isolate routing logic ─────────

vi.mock('../ActiveMemberDashboard', () => ({
  default: ({ memberId }: { memberId: number }) => (
    <div data-testid="active-member-dashboard">Active Dashboard {memberId}</div>
  ),
}));

vi.mock('../RetireeDashboard', () => ({
  default: ({ memberId }: { memberId: number }) => (
    <div data-testid="retiree-dashboard">Retiree Dashboard {memberId}</div>
  ),
}));

vi.mock('../InactiveMemberDashboard', () => ({
  default: ({ memberId }: { memberId: number }) => (
    <div data-testid="inactive-member-dashboard">Inactive Dashboard {memberId}</div>
  ),
}));

vi.mock('../BeneficiaryDashboard', () => ({
  default: ({ memberId, benefitType }: { memberId: number; benefitType: string }) => (
    <div data-testid="beneficiary-dashboard">
      Beneficiary Dashboard {memberId} ({benefitType})
    </div>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardRouter', () => {
  const defaultProps = {
    memberId: 10001,
    retirementDate: '2030-07-15',
    onNavigate: vi.fn(),
  };

  it('renders active member dashboard for active persona', async () => {
    renderWithProviders(<DashboardRouter {...defaultProps} personas={['active']} />);
    await waitFor(() => {
      expect(screen.getByTestId('active-member-dashboard')).toBeInTheDocument();
    });
  });

  it('renders retiree dashboard for retiree persona', async () => {
    renderWithProviders(<DashboardRouter {...defaultProps} personas={['retiree']} />);
    await waitFor(() => {
      expect(screen.getByTestId('retiree-dashboard')).toBeInTheDocument();
    });
  });

  it('renders inactive dashboard for inactive persona', async () => {
    renderWithProviders(<DashboardRouter {...defaultProps} personas={['inactive']} />);
    await waitFor(() => {
      expect(screen.getByTestId('inactive-member-dashboard')).toBeInTheDocument();
    });
  });

  it('renders beneficiary dashboard for beneficiary persona', async () => {
    renderWithProviders(<DashboardRouter {...defaultProps} personas={['beneficiary']} />);
    await waitFor(() => {
      expect(screen.getByTestId('beneficiary-dashboard')).toBeInTheDocument();
    });
  });

  it('handles dual-role by showing both sections', async () => {
    renderWithProviders(<DashboardRouter {...defaultProps} personas={['active', 'beneficiary']} />);
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-section-active')).toBeInTheDocument();
    });
    expect(screen.getByTestId('dashboard-section-beneficiary')).toBeInTheDocument();
    expect(screen.getByTestId('active-member-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('beneficiary-dashboard')).toBeInTheDocument();
  });

  it('shows persona labels in dual-role mode', async () => {
    renderWithProviders(<DashboardRouter {...defaultProps} personas={['active', 'beneficiary']} />);
    await waitFor(() => {
      expect(screen.getByText('Active Member')).toBeInTheDocument();
    });
    expect(screen.getByText('Beneficiary')).toBeInTheDocument();
  });

  it('wraps in dashboard-router test id', () => {
    renderWithProviders(<DashboardRouter {...defaultProps} personas={['active']} />);
    expect(screen.getByTestId('dashboard-router')).toBeInTheDocument();
  });
});
