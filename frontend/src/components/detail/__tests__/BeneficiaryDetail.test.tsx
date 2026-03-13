import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import BeneficiaryDetail from '../BeneficiaryDetail';
import type { Beneficiary } from '@/types/Member';

// Mock useSpawnAnimation to skip real animations
vi.mock('@/hooks/useSpawnAnimation', () => ({
  useSpawnAnimation: () => ({
    panelRef: { current: null },
    isVisible: true,
    phase: 'open',
    open: vi.fn(),
    close: vi.fn(),
    style: { transform: 'none', opacity: 1, transition: 'none' },
    DURATION_MS: 0,
  }),
}));

const mockBeneficiary: Beneficiary = {
  bene_id: 1,
  member_id: 10001,
  bene_type: 'PRIMARY',
  first_name: 'Sarah',
  last_name: 'Martinez',
  relationship: 'Spouse',
  dob: '1965-08-15',
  alloc_pct: 100,
  eff_date: '2020-01-01',
};

const mockBeneficiaryWithEndDate: Beneficiary = {
  bene_id: 2,
  member_id: 10001,
  bene_type: 'CONTINGENT',
  first_name: 'James',
  last_name: 'Martinez',
  relationship: 'Child',
  dob: '1990-03-22',
  alloc_pct: 50,
  eff_date: '2020-01-01',
  end_date: '2024-06-30',
};

// Helper: format a date string the same way the component does
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const items = [mockBeneficiary, mockBeneficiaryWithEndDate];

const defaultProps = {
  item: mockBeneficiary,
  sourceRect: new DOMRect(100, 200, 600, 40),
  onClose: vi.fn(),
  items,
  currentIndex: 0,
  onNavigate: vi.fn(),
};

describe('BeneficiaryDetail', () => {
  it('renders full name as title', () => {
    renderWithProviders(<BeneficiaryDetail {...defaultProps} />);
    expect(screen.getByText('Sarah Martinez')).toBeInTheDocument();
  });

  it('renders type badge (Primary)', () => {
    renderWithProviders(<BeneficiaryDetail {...defaultProps} />);
    const primaries = screen.getAllByText('Primary');
    // StatusBadge + metadata grid both show type
    expect(primaries.length).toBeGreaterThanOrEqual(1);
  });

  it('renders relationship in subtitle', () => {
    renderWithProviders(<BeneficiaryDetail {...defaultProps} />);
    // Appears in both subtitle and metadata grid
    const matches = screen.getAllByText(/Spouse/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders allocation %', () => {
    renderWithProviders(<BeneficiaryDetail {...defaultProps} />);
    expect(screen.getByText(/100% allocation/)).toBeInTheDocument();
  });

  it('renders effective date', () => {
    renderWithProviders(<BeneficiaryDetail {...defaultProps} />);
    expect(screen.getByText('Effective Date')).toBeInTheDocument();
    const expected = formatDate('2020-01-01');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders DOB with age', () => {
    renderWithProviders(<BeneficiaryDetail {...defaultProps} />);
    expect(screen.getByText('Date of Birth')).toBeInTheDocument();
    const dobFormatted = formatDate('1965-08-15');
    const dobCell = screen.getByText(
      new RegExp(dobFormatted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    expect(dobCell).toBeInTheDocument();
    expect(dobCell.textContent).toMatch(/age \d+/);
  });

  it('renders navigation counter', () => {
    renderWithProviders(<BeneficiaryDetail {...defaultProps} />);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('renders end date when present', () => {
    renderWithProviders(
      <BeneficiaryDetail {...defaultProps} item={mockBeneficiaryWithEndDate} currentIndex={1} />,
    );
    expect(screen.getByText('End Date')).toBeInTheDocument();
    const expected = formatDate('2024-06-30');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
