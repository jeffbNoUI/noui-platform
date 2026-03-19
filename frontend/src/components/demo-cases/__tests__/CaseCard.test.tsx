import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CaseCard from '../CaseCard';
import type { DemoCase } from '@/types/Rules';

const MOCK_CASE: DemoCase = {
  caseId: 'CASE-001',
  description: 'Normal retirement, Tier 1 member, leave payout',
  member: {
    memberId: 1001,
    firstName: 'Robert',
    lastName: 'Martinez',
    dob: '1960-05-15',
    hireDate: '1995-08-01',
    tier: 1,
  },
  retirementDate: '2025-06-01',
  inputs: {},
  expected: {},
  testPoints: ['Verify AMS calculation', 'Verify leave payout', 'Verify benefit amount'],
  full: {},
};

describe('CaseCard', () => {
  it('renders member name', () => {
    renderWithProviders(<CaseCard demoCase={MOCK_CASE} onClick={() => {}} />);
    expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
  });

  it('shows tier badge', () => {
    renderWithProviders(<CaseCard demoCase={MOCK_CASE} onClick={() => {}} />);
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('shows description', () => {
    renderWithProviders(<CaseCard demoCase={MOCK_CASE} onClick={() => {}} />);
    expect(screen.getByText(MOCK_CASE.description)).toBeInTheDocument();
  });

  it('shows test count', () => {
    renderWithProviders(<CaseCard demoCase={MOCK_CASE} onClick={() => {}} />);
    expect(screen.getByText('3 tests')).toBeInTheDocument();
  });

  it('shows retirement date', () => {
    renderWithProviders(<CaseCard demoCase={MOCK_CASE} onClick={() => {}} />);
    expect(screen.getByText('Retirement: 2025-06-01')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    renderWithProviders(<CaseCard demoCase={MOCK_CASE} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
