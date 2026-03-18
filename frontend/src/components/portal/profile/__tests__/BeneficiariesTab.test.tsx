import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BeneficiariesTab from '../BeneficiariesTab';
import type { Beneficiary } from '@/types/Member';

// ── Mock data ───────────────────────────────────────────────────────────────

const mockBeneficiaries: Beneficiary[] = [
  {
    bene_id: 1,
    member_id: 10001,
    bene_type: 'primary',
    first_name: 'Sarah',
    last_name: 'Martinez',
    relationship: 'Spouse',
    dob: '1970-03-10',
    alloc_pct: 60,
    eff_date: '2000-03-15',
  },
  {
    bene_id: 2,
    member_id: 10001,
    bene_type: 'primary',
    first_name: 'Michael',
    last_name: 'Martinez',
    relationship: 'Child',
    dob: '1998-06-20',
    alloc_pct: 40,
    eff_date: '2000-03-15',
  },
];

let beneData: Beneficiary[] | undefined = mockBeneficiaries;
let beneLoading = false;

vi.mock('@/hooks/useMember', () => ({
  useBeneficiaries: () => ({ data: beneData, isLoading: beneLoading }),
}));

const mockCreate = vi.fn().mockResolvedValue({ id: 'cr-1', status: 'pending' });
vi.mock('@/lib/memberPortalApi', () => ({
  changeRequestAPI: { create: (...args: unknown[]) => mockCreate(...args) },
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BeneficiariesTab', () => {
  beforeEach(() => {
    beneData = mockBeneficiaries;
    beneLoading = false;
    mockCreate.mockClear();
  });

  it('renders beneficiary list', () => {
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    expect(screen.getByTestId('beneficiaries-tab')).toBeInTheDocument();
    expect(screen.getByText('Sarah Martinez')).toBeInTheDocument();
    expect(screen.getByText('Michael Martinez')).toBeInTheDocument();
  });

  it('shows allocation percentages', () => {
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    expect(screen.getByTestId('beneficiary-alloc-1')).toHaveTextContent('60%');
    expect(screen.getByTestId('beneficiary-alloc-2')).toHaveTextContent('40%');
  });

  it('shows allocation summary as fully allocated when summing to 100%', () => {
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    expect(screen.getByTestId('allocation-summary')).toHaveTextContent('Total Allocation: 100%');
    expect(screen.getByText('Fully Allocated')).toBeInTheDocument();
  });

  it('shows unallocated warning when not 100%', () => {
    beneData = [{ ...mockBeneficiaries[0], alloc_pct: 50 }];
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    expect(screen.getByTestId('allocation-summary')).toHaveTextContent('50% unallocated');
  });

  it('shows loading state', () => {
    beneLoading = true;
    beneData = undefined;
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    expect(screen.getByText('Loading beneficiaries...')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    beneData = [];
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    expect(screen.getByText('No beneficiaries on file.')).toBeInTheDocument();
  });

  it('shows staff review info banner', () => {
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    expect(screen.getByText(/All beneficiary changes require staff review/)).toBeInTheDocument();
  });

  it('opens add beneficiary form', () => {
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('add-beneficiary-btn'));
    expect(screen.getByTestId('beneficiary-form')).toBeInTheDocument();
  });

  it('validates required fields in add form', () => {
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('add-beneficiary-btn'));
    fireEvent.click(screen.getByTestId('bene-submit'));
    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Reason is required for staff review')).toBeInTheDocument();
  });

  it('submits add beneficiary change request', async () => {
    beneData = [{ ...mockBeneficiaries[0], alloc_pct: 60 }];
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('add-beneficiary-btn'));

    fireEvent.change(screen.getByTestId('bene-first-name'), { target: { value: 'Emily' } });
    fireEvent.change(screen.getByTestId('bene-last-name'), { target: { value: 'Martinez' } });
    fireEvent.change(screen.getByTestId('bene-relationship'), { target: { value: 'Child' } });
    fireEvent.change(screen.getByTestId('bene-alloc-pct'), { target: { value: '40' } });
    fireEvent.change(screen.getByTestId('bene-reason'), {
      target: { value: 'Adding second child' },
    });
    fireEvent.click(screen.getByTestId('bene-submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('beneficiary-change-success')).toBeInTheDocument();
    });
  });

  it('cancels add beneficiary form', () => {
    renderWithProviders(<BeneficiariesTab memberId={10001} />);
    fireEvent.click(screen.getByTestId('add-beneficiary-btn'));
    fireEvent.click(screen.getByTestId('bene-cancel'));
    expect(screen.queryByTestId('beneficiary-form')).not.toBeInTheDocument();
  });
});
