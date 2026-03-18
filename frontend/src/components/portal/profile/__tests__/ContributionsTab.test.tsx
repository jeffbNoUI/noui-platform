import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ContributionsTab from '../ContributionsTab';
import type { ContributionSummary } from '@/types/Member';

// ── Mock data ───────────────────────────────────────────────────────────────

const mockContributions: ContributionSummary = {
  member_id: 10001,
  total_ee_contributions: 168420,
  total_er_contributions: 244430,
  total_interest: 52300,
  current_ee_balance: 168420,
  current_er_balance: 244430,
  period_count: 624,
};

let contribData: ContributionSummary | undefined = mockContributions;
let contribLoading = false;

vi.mock('@/hooks/useMember', () => ({
  useContributions: () => ({ data: contribData, isLoading: contribLoading }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ContributionsTab', () => {
  beforeEach(() => {
    contribData = mockContributions;
    contribLoading = false;
  });

  it('renders summary cards', () => {
    renderWithProviders(<ContributionsTab memberId={10001} />);
    expect(screen.getByTestId('contributions-tab')).toBeInTheDocument();
    expect(screen.getByTestId('summary-employee')).toBeInTheDocument();
    expect(screen.getByTestId('summary-employer')).toBeInTheDocument();
    expect(screen.getByTestId('summary-total')).toBeInTheDocument();
  });

  it('shows formatted contribution amounts', () => {
    renderWithProviders(<ContributionsTab memberId={10001} />);
    expect(screen.getByTestId('summary-employee')).toHaveTextContent('$168,420');
    expect(screen.getByTestId('summary-employer')).toHaveTextContent('$244,430');
    expect(screen.getByTestId('summary-total')).toHaveTextContent('$412,850');
  });

  it('shows contribution rates', () => {
    renderWithProviders(<ContributionsTab memberId={10001} />);
    // Rates appear in both summary cards (subtitles) and the info banner
    expect(screen.getByTestId('summary-employee')).toHaveTextContent('8.45%');
    expect(screen.getByTestId('summary-employer')).toHaveTextContent('17.95%');
  });

  it('shows pay period count', () => {
    renderWithProviders(<ContributionsTab memberId={10001} />);
    expect(screen.getByText('624 pay periods')).toBeInTheDocument();
  });

  it('renders contributions table', () => {
    renderWithProviders(<ContributionsTab memberId={10001} />);
    expect(screen.getByTestId('contributions-table')).toBeInTheDocument();
    expect(screen.getByText('Employee (you)')).toBeInTheDocument();
    expect(screen.getByText('Employer')).toBeInTheDocument();
  });

  it('shows interest row when interest > 0', () => {
    renderWithProviders(<ContributionsTab memberId={10001} />);
    expect(screen.getByText('Interest Earned')).toBeInTheDocument();
  });

  it('hides interest row when interest is 0', () => {
    contribData = { ...mockContributions, total_interest: 0 };
    renderWithProviders(<ContributionsTab memberId={10001} />);
    expect(screen.queryByText('Interest Earned')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    contribLoading = true;
    contribData = undefined;
    renderWithProviders(<ContributionsTab memberId={10001} />);
    expect(screen.getByText('Loading contributions...')).toBeInTheDocument();
  });

  it('shows unavailable state when no data', () => {
    contribData = undefined;
    renderWithProviders(<ContributionsTab memberId={10001} />);
    expect(screen.getByText('Contribution data not available.')).toBeInTheDocument();
  });
});
