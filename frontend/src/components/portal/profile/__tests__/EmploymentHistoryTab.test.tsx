import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import EmploymentHistoryTab from '../EmploymentHistoryTab';
import type { EmploymentEvent } from '@/types/Member';

// ── Mock data ───────────────────────────────────────────────────────────────

const mockEvents: EmploymentEvent[] = [
  {
    event_id: 1,
    member_id: 10001,
    event_type: 'HIRE',
    event_date: '2000-03-15',
    annual_salary: 55000,
    dept_code: 'IT',
  },
  {
    event_id: 2,
    member_id: 10001,
    event_type: 'PROMOTION',
    event_date: '2005-06-01',
    annual_salary: 72000,
    dept_code: 'IT',
  },
  {
    event_id: 3,
    member_id: 10001,
    event_type: 'SALARY_CHANGE',
    event_date: '2023-01-01',
    annual_salary: 95000,
  },
];

let eventData: EmploymentEvent[] | undefined = mockEvents;
let eventLoading = false;

vi.mock('@/hooks/useMember', () => ({
  useEmployment: () => ({ data: eventData, isLoading: eventLoading }),
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('EmploymentHistoryTab', () => {
  beforeEach(() => {
    eventData = mockEvents;
    eventLoading = false;
  });

  it('renders employment events in reverse chronological order', () => {
    renderWithProviders(<EmploymentHistoryTab memberId={10001} />);
    expect(screen.getByTestId('employment-history-tab')).toBeInTheDocument();
    const events = screen.getAllByText(/Hired|Promotion|Salary Change/);
    expect(events.length).toBeGreaterThanOrEqual(3);
  });

  it('shows event details (type, date, salary, department)', () => {
    renderWithProviders(<EmploymentHistoryTab memberId={10001} />);
    expect(screen.getByText('Hired')).toBeInTheDocument();
    expect(screen.getByText(/Annual Salary: \$55,000/)).toBeInTheDocument();
    expect(screen.getAllByText(/Department: IT/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state', () => {
    eventLoading = true;
    eventData = undefined;
    renderWithProviders(<EmploymentHistoryTab memberId={10001} />);
    expect(screen.getByText('Loading employment history...')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    eventData = [];
    renderWithProviders(<EmploymentHistoryTab memberId={10001} />);
    expect(screen.getByText('No employment history on file.')).toBeInTheDocument();
  });

  it('shows Flag Issue button when onFlagIssue is provided', () => {
    renderWithProviders(<EmploymentHistoryTab memberId={10001} onFlagIssue={vi.fn()} />);
    expect(screen.getByTestId('flag-event-1')).toBeInTheDocument();
  });

  it('does not show Flag Issue button when onFlagIssue is not provided', () => {
    renderWithProviders(<EmploymentHistoryTab memberId={10001} />);
    expect(screen.queryByTestId('flag-event-1')).not.toBeInTheDocument();
  });

  it('calls onFlagIssue with event context when clicked', () => {
    const onFlagIssue = vi.fn();
    renderWithProviders(<EmploymentHistoryTab memberId={10001} onFlagIssue={onFlagIssue} />);
    fireEvent.click(screen.getByTestId('flag-event-1'));
    expect(onFlagIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'employment_event',
        entityId: '1',
      }),
    );
  });

  it('renders timeline dots for each event', () => {
    renderWithProviders(<EmploymentHistoryTab memberId={10001} />);
    expect(screen.getByTestId('event-1')).toBeInTheDocument();
    expect(screen.getByTestId('event-2')).toBeInTheDocument();
    expect(screen.getByTestId('event-3')).toBeInTheDocument();
  });
});
