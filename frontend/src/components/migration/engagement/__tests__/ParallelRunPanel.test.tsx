import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useReconciliationSummary: vi.fn(),
    useP1Issues: vi.fn(),
  };
});

import { useReconciliationSummary, useP1Issues } from '@/hooks/useMigrationApi';

import ParallelRunPanel from '../ParallelRunPanel';

describe('ParallelRunPanel', () => {
  beforeEach(() => {
    (useReconciliationSummary as any).mockReturnValue({ data: { gate_score: 0.9 } });
    (useP1Issues as any).mockReturnValue({ data: [] });
  });

  it('renders 5 checklist items', () => {
    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    expect(screen.getByText(/Weighted reconciliation/)).toBeTruthy();
    expect(screen.getByText(/Zero unresolved P1/)).toBeTruthy();
    expect(screen.getByText(/Parallel run duration/)).toBeTruthy();
    expect(screen.getByText(/Stakeholder sign-off/)).toBeTruthy();
    expect(screen.getByText(/Rollback plan/)).toBeTruthy();
  });

  it('auto-checks recon score item when gate_score >= 0.95', () => {
    (useReconciliationSummary as any).mockReturnValue({ data: { gate_score: 0.97 } });

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    // The recon_score checkbox should be checked (auto)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // First checkbox is recon_score
    expect(checkboxes[0].checked).toBe(true);
    // Shows 97.0%
    expect(screen.getByText('97.0%')).toBeTruthy();
  });

  it('auto-checks P1 item when no unresolved P1 issues exist', () => {
    (useP1Issues as any).mockReturnValue({ data: [] });

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Second checkbox is p1_resolved — should be checked since no unresolved issues
    expect(checkboxes[1].checked).toBe(true);
    expect(screen.getByText('0 unresolved')).toBeTruthy();
  });

  it('certify button is disabled when manual checks are unchecked', () => {
    (useReconciliationSummary as any).mockReturnValue({ data: { gate_score: 0.97 } });
    (useP1Issues as any).mockReturnValue({ data: [] });

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    const certifyBtn = screen.getByText('Certify Complete') as HTMLButtonElement;
    expect(certifyBtn.disabled).toBe(true);
  });

  it('all 5 checks pass — certify button is enabled', () => {
    (useReconciliationSummary as any).mockReturnValue({ data: { gate_score: 0.97 } });
    (useP1Issues as any).mockReturnValue({ data: [] });

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Auto checks (0, 1) are already checked. Manual checks are 2, 3, 4.
    fireEvent.click(checkboxes[2]); // parallel_duration
    fireEvent.click(checkboxes[3]); // stakeholder_signoff
    fireEvent.click(checkboxes[4]); // rollback_plan

    const certifyBtn = screen.getByText('Certify Complete') as HTMLButtonElement;
    expect(certifyBtn.disabled).toBe(false);
  });
});
