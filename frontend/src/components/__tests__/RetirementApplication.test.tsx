import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RetirementApplication from '@/components/RetirementApplication';

describe('RetirementApplication', () => {
  const defaultProps = {
    caseId: 'RET-2026-0147',
    memberId: 10001,
    retirementDate: '2026-04-01',
    caseFlags: ['leave-payout'],
    onBack: vi.fn(),
    onChangeView: vi.fn(),
  };

  it('renders without crashing', async () => {
    renderWithProviders(<RetirementApplication {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Retirement Application')).toBeInTheDocument();
    });
  });

  it('shows case ID in header and status bar', async () => {
    renderWithProviders(<RetirementApplication {...defaultProps} />);
    await waitFor(() => {
      const caseIds = screen.getAllByText('RET-2026-0147');
      expect(caseIds.length).toBe(2);
    });
  });

  it('shows Back to Queue button', async () => {
    renderWithProviders(<RetirementApplication {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Back to Queue/)).toBeInTheDocument();
    });
  });

  it('shows navigation model picker', async () => {
    renderWithProviders(<RetirementApplication {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Stage 1 of/)).toBeInTheDocument();
    });
  });

  it('shows status bar', async () => {
    renderWithProviders(<RetirementApplication {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Assigned: Sarah Chen')).toBeInTheDocument();
    });
  });

  it('renders with no case flags without crashing', async () => {
    renderWithProviders(<RetirementApplication {...defaultProps} caseFlags={[]} />);
    await waitFor(() => {
      expect(screen.getByText('Retirement Application')).toBeInTheDocument();
    });
  });
});
