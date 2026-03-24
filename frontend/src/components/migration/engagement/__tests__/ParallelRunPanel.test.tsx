import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

const mockMutate = vi.fn();

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useReconciliationSummary: vi.fn(),
    useP1Issues: vi.fn(),
    useCertification: vi.fn(),
    useCertifyEngagement: vi.fn(),
  };
});

import {
  useReconciliationSummary,
  useP1Issues,
  useCertification,
  useCertifyEngagement,
} from '@/hooks/useMigrationApi';

import ParallelRunPanel from '../ParallelRunPanel';

describe('ParallelRunPanel', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    vi.mocked(useReconciliationSummary).mockReturnValue({
      data: { gate_score: 0.9 },
    } as unknown as ReturnType<typeof useReconciliationSummary>);
    vi.mocked(useP1Issues).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useP1Issues
    >);
    vi.mocked(useCertification).mockReturnValue({ data: null } as unknown as ReturnType<
      typeof useCertification
    >);
    vi.mocked(useCertifyEngagement).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCertifyEngagement>);
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
    vi.mocked(useReconciliationSummary).mockReturnValue({
      data: { gate_score: 0.97 },
    } as unknown as ReturnType<typeof useReconciliationSummary>);

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    // The recon_score checkbox should be checked (auto)
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // First checkbox is recon_score
    expect(checkboxes[0].checked).toBe(true);
    // Shows 97.0%
    expect(screen.getByText('97.0%')).toBeTruthy();
  });

  it('auto-checks P1 item when no unresolved P1 issues exist', () => {
    vi.mocked(useP1Issues).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useP1Issues
    >);

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Second checkbox is p1_resolved — should be checked since no unresolved issues
    expect(checkboxes[1].checked).toBe(true);
    expect(screen.getByText('0 unresolved')).toBeTruthy();
  });

  it('certify button is disabled when manual checks are unchecked', () => {
    vi.mocked(useReconciliationSummary).mockReturnValue({
      data: { gate_score: 0.97 },
    } as unknown as ReturnType<typeof useReconciliationSummary>);
    vi.mocked(useP1Issues).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useP1Issues
    >);

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    const certifyBtn = screen.getByText('Certify Complete') as HTMLButtonElement;
    expect(certifyBtn.disabled).toBe(true);
  });

  it('all 5 checks pass — certify button is enabled', () => {
    vi.mocked(useReconciliationSummary).mockReturnValue({
      data: { gate_score: 0.97 },
    } as unknown as ReturnType<typeof useReconciliationSummary>);
    vi.mocked(useP1Issues).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useP1Issues
    >);

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Auto checks (0, 1) are already checked. Manual checks are 2, 3, 4.
    fireEvent.click(checkboxes[2]); // parallel_duration
    fireEvent.click(checkboxes[3]); // stakeholder_signoff
    fireEvent.click(checkboxes[4]); // rollback_plan

    const certifyBtn = screen.getByText('Certify Complete') as HTMLButtonElement;
    expect(certifyBtn.disabled).toBe(false);
  });

  it('calls certifyMutation.mutate when Certify Complete is clicked', () => {
    vi.mocked(useReconciliationSummary).mockReturnValue({
      data: { gate_score: 0.97 },
    } as unknown as ReturnType<typeof useReconciliationSummary>);
    vi.mocked(useP1Issues).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useP1Issues
    >);

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[2]);
    fireEvent.click(checkboxes[3]);
    fireEvent.click(checkboxes[4]);

    fireEvent.click(screen.getByText('Certify Complete'));

    expect(mockMutate).toHaveBeenCalledWith(
      {
        engagementId: 'eng-1',
        body: {
          gate_score: 0.97,
          p1_count: 0,
          checklist: {
            recon_score: true,
            p1_resolved: true,
            parallel_duration: true,
            stakeholder_signoff: true,
            rollback_plan: true,
          },
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('shows Already Certified state when existing certification exists', () => {
    vi.mocked(useCertification).mockReturnValue({
      data: {
        certified_by: 'user-abc',
        certified_at: '2026-03-22T10:00:00Z',
        checklist_json: {
          recon_score: true,
          p1_resolved: true,
          parallel_duration: true,
          stakeholder_signoff: true,
          rollback_plan: true,
        },
      },
    } as unknown as ReturnType<typeof useCertification>);

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    // Banner and button both show "Already Certified"
    expect(screen.getAllByText('Already Certified').length).toBeGreaterThanOrEqual(1);
    // Button should be disabled
    const certifyBtn = screen.getByRole('button', {
      name: 'Already Certified',
    }) as HTMLButtonElement;
    expect(certifyBtn.disabled).toBe(true);
  });

  it('disables manual checkboxes when already certified', () => {
    vi.mocked(useCertification).mockReturnValue({
      data: {
        certified_by: 'user-abc',
        certified_at: '2026-03-22T10:00:00Z',
        checklist_json: {
          recon_score: true,
          p1_resolved: true,
          parallel_duration: true,
          stakeholder_signoff: true,
          rollback_plan: true,
        },
      },
    } as unknown as ReturnType<typeof useCertification>);

    renderWithProviders(<ParallelRunPanel engagementId="eng-1" />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // All manual checkboxes should be disabled
    expect(checkboxes[2].disabled).toBe(true); // parallel_duration
    expect(checkboxes[3].disabled).toBe(true); // stakeholder_signoff
    expect(checkboxes[4].disabled).toBe(true); // rollback_plan
  });
});
