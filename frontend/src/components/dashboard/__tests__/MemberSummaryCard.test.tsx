import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberSummaryCard from '../MemberSummaryCard';
import type { MemberSummaryResult } from '@/lib/memberSummary';

const mockSummary: MemberSummaryResult = {
  context: 'Robert Martinez — 24 yr 6 mo Tier 1 veteran, Normal Retirement, no reduction.',
  attentionItems: [
    { severity: 'critical', label: 'Overdue commitment', detail: 'Send estimate — due Mar 1' },
    {
      severity: 'high',
      label: 'Urgent case',
      detail: 'RET-2026-0147 at Eligibility (12 days open)',
    },
    { severity: 'medium', label: 'Data quality', detail: '2 issues flagged for review' },
    {
      severity: 'info',
      label: 'Beneficiaries on file',
      detail: '2 beneficiary designations on file',
    },
  ],
};

describe('MemberSummaryCard', () => {
  it('renders header with AI-generated badge', () => {
    renderWithProviders(<MemberSummaryCard summary={mockSummary} isLoading={false} />);
    expect(screen.getByText('Member Summary')).toBeInTheDocument();
    expect(screen.getByText('AI-generated')).toBeInTheDocument();
  });

  it('renders context line and attention items', () => {
    renderWithProviders(<MemberSummaryCard summary={mockSummary} isLoading={false} />);
    expect(screen.getByText(mockSummary.context)).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText(/Overdue commitment/)).toBeInTheDocument();
    expect(screen.getByText(/Urgent case/)).toBeInTheDocument();
    expect(screen.getByText(/Data quality/)).toBeInTheDocument();
  });

  it('separates info items from action items', () => {
    renderWithProviders(<MemberSummaryCard summary={mockSummary} isLoading={false} />);
    // Info items are rendered as a joined string, not under "Needs attention"
    expect(screen.getByText(/2 beneficiary designations on file/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithProviders(<MemberSummaryCard summary={null} isLoading={true} />);
    expect(screen.getByText('Generating summary...')).toBeInTheDocument();
  });

  it('shows no-data state when summary is null and not loading', () => {
    renderWithProviders(<MemberSummaryCard summary={null} isLoading={false} />);
    expect(screen.getByText('No member data available to summarize.')).toBeInTheDocument();
  });
});
