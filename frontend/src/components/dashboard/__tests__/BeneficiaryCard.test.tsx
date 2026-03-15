import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BeneficiaryCard from '../BeneficiaryCard';
import type { Beneficiary } from '@/types/Member';

const mockBeneficiaries: Beneficiary[] = [
  {
    bene_id: 1,
    member_id: 10001,
    bene_type: 'PRIMARY',
    first_name: 'Maria',
    last_name: 'Martinez',
    relationship: 'Spouse',
    alloc_pct: 75,
    eff_date: '2005-01-01',
    dob: '1970-03-22',
  },
  {
    bene_id: 2,
    member_id: 10001,
    bene_type: 'CONTINGENT',
    first_name: 'Carlos',
    last_name: 'Martinez',
    relationship: 'Child',
    alloc_pct: 25,
    eff_date: '2010-06-15',
    dob: '1995-08-10',
  },
];

describe('BeneficiaryCard', () => {
  it('renders title and beneficiary count badge', async () => {
    renderWithProviders(<BeneficiaryCard beneficiaries={mockBeneficiaries} isLoading={false} />);
    expect(screen.getByText('Beneficiaries')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows beneficiary names, relationships, and allocation', async () => {
    renderWithProviders(<BeneficiaryCard beneficiaries={mockBeneficiaries} isLoading={false} />);
    expect(screen.getByText('Maria Martinez')).toBeInTheDocument();
    expect(screen.getByText('Carlos Martinez')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText(/Spouse/)).toBeInTheDocument();
    expect(screen.getByText(/Primary/)).toBeInTheDocument();
  });

  it('shows warning when no beneficiaries on file', () => {
    renderWithProviders(<BeneficiaryCard beneficiaries={[]} isLoading={false} />);
    expect(screen.getByText('No beneficiary designations on file')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithProviders(<BeneficiaryCard isLoading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('filters out beneficiaries with end_date', () => {
    const withEnded: Beneficiary[] = [
      { ...mockBeneficiaries[0], end_date: '2020-01-01' },
      mockBeneficiaries[1],
    ];
    renderWithProviders(<BeneficiaryCard beneficiaries={withEnded} isLoading={false} />);
    expect(screen.queryByText('Maria Martinez')).not.toBeInTheDocument();
    expect(screen.getByText('Carlos Martinez')).toBeInTheDocument();
  });
});
