import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DataQualityCard from '../DataQualityCard';
import {
  mockDQScore,
  mockDQScoreLow,
  mockDQScoreMid,
  mockDQIssues,
  mockDQIssueResolved,
} from './fixtures';

describe('DataQualityCard', () => {
  it('renders loading state when isLoading and no score', () => {
    renderWithProviders(<DataQualityCard score={undefined} memberIssues={[]} isLoading={true} />);
    expect(screen.getByText('Data Quality')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('returns null when no score and no open issues', () => {
    const { container } = renderWithProviders(
      <DataQualityCard score={undefined} memberIssues={[]} isLoading={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when issues are all resolved', () => {
    const { container } = renderWithProviders(
      <DataQualityCard score={undefined} memberIssues={[mockDQIssueResolved]} isLoading={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders score with green color for score >= 95', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={[]} isLoading={false} />,
    );
    expect(screen.getByText('96.2%')).toBeInTheDocument();
    expect(screen.getByText('overall score')).toBeInTheDocument();
  });

  it('renders score with amber color for score between 85 and 95', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScoreMid} memberIssues={[]} isLoading={false} />,
    );
    const scoreEl = screen.getByText('89.0%');
    expect(scoreEl.className).toContain('text-amber-600');
  });

  it('renders score with red color for score below 85', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScoreLow} memberIssues={[]} isLoading={false} />,
    );
    const scoreEl = screen.getByText('72.5%');
    expect(scoreEl.className).toContain('text-red-600');
  });

  it('displays check count and open issues from score', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={[]} isLoading={false} />,
    );
    expect(screen.getByText('45 checks')).toBeInTheDocument();
    expect(screen.getByText('2 open issues')).toBeInTheDocument();
  });

  it('shows critical count when present', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScoreLow} memberIssues={[]} isLoading={false} />,
    );
    expect(screen.getByText('3 critical')).toBeInTheDocument();
  });

  it('hides critical count when zero', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={[]} isLoading={false} />,
    );
    expect(screen.queryByText(/critical/)).not.toBeInTheDocument();
  });

  it('shows singular "issue" when exactly 1 open issue', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={[mockDQIssues[0]]} isLoading={false} />,
    );
    expect(screen.getByText('1 issue')).toBeInTheDocument();
  });

  it('shows issue count badge with plural when multiple open issues', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={mockDQIssues} isLoading={false} />,
    );
    expect(screen.getByText('2 issues')).toBeInTheDocument();
  });

  it('renders member issues with severity badges', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={mockDQIssues} isLoading={false} />,
    );
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('Email address format appears invalid')).toBeInTheDocument();
    expect(screen.getByText('Hire date is after retirement date')).toBeInTheDocument();
  });

  it('shows field name when present on issue', () => {
    renderWithProviders(
      <DataQualityCard score={mockDQScore} memberIssues={mockDQIssues} isLoading={false} />,
    );
    expect(screen.getByText('primary_email')).toBeInTheDocument();
    expect(screen.getByText('hire_date')).toBeInTheDocument();
  });

  it('filters out resolved issues from display', () => {
    renderWithProviders(
      <DataQualityCard
        score={mockDQScore}
        memberIssues={[...mockDQIssues, mockDQIssueResolved]}
        isLoading={false}
      />,
    );
    // Only 2 open issues should render, not the resolved one
    expect(screen.getByText('2 issues')).toBeInTheDocument();
  });

  it('renders with score visible while still loading (score cached)', () => {
    renderWithProviders(<DataQualityCard score={mockDQScore} memberIssues={[]} isLoading={true} />);
    // Should show score, not loading state
    expect(screen.getByText('96.2%')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('renders without score but with open issues', () => {
    renderWithProviders(
      <DataQualityCard score={undefined} memberIssues={mockDQIssues} isLoading={false} />,
    );
    expect(screen.getByText('Issues for this member')).toBeInTheDocument();
    expect(screen.getByText('Email address format appears invalid')).toBeInTheDocument();
  });
});
