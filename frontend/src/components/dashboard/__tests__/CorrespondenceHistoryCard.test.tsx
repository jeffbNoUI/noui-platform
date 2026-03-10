import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CorrespondenceHistoryCard from '../CorrespondenceHistoryCard';
import { mockCorrespondence } from './fixtures';

describe('CorrespondenceHistoryCard', () => {
  it('renders header', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={mockCorrespondence} />);
    expect(screen.getByText('Correspondence')).toBeInTheDocument();
  });

  it('shows item count in header', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={mockCorrespondence} />);
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('hides item count when no correspondence', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={[]} />);
    expect(screen.queryByText(/items/)).not.toBeInTheDocument();
  });

  it('shows empty state when no correspondence', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={[]} />);
    expect(screen.getByText('No correspondence on file')).toBeInTheDocument();
  });

  it('renders subject for each item', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={mockCorrespondence} />);
    expect(screen.getByText('Retirement Benefit Estimate')).toBeInTheDocument();
    expect(screen.getByText('DRO Acknowledgment Letter')).toBeInTheDocument();
    expect(screen.getByText('Beneficiary Confirmation')).toBeInTheDocument();
  });

  it('renders status badges', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={mockCorrespondence} />);
    expect(screen.getByText('sent')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('final')).toBeInTheDocument();
  });

  it('shows generatedBy for each item', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={mockCorrespondence} />);
    // Benefits Team appears twice (CORR-001 and CORR-003)
    const benefitsTeam = screen.getAllByText(/Benefits Team/);
    expect(benefitsTeam.length).toBe(2);
    expect(screen.getByText(/Legal Team/)).toBeInTheDocument();
  });

  it('shows "Sent" date when sentAt is available', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={mockCorrespondence} />);
    // First item has sentAt — "Sent Mar 4"
    expect(screen.getByText(/Sent/)).toBeInTheDocument();
  });

  it('shows "Created" date when sentAt is not available', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={mockCorrespondence} />);
    // Second item (draft) has no sentAt — shows "Created Mar 5"
    const created = screen.getAllByText(/Created/);
    expect(created.length).toBeGreaterThanOrEqual(1);
  });

  it('renders with single item', () => {
    renderWithProviders(<CorrespondenceHistoryCard correspondence={[mockCorrespondence[0]]} />);
    expect(screen.getByText('1 items')).toBeInTheDocument();
    expect(screen.getByText('Retirement Benefit Estimate')).toBeInTheDocument();
  });
});
