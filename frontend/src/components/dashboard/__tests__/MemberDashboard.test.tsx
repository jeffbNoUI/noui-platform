import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberDashboard from '../MemberDashboard';
import { mockTimeline, mockDQScore, mockDQIssues, mockCorrespondence } from './fixtures';

// Mock useMemberDashboard hook
const mockUseMemberDashboard = vi.fn();
vi.mock('@/hooks/useMemberDashboard', () => ({
  useMemberDashboard: (...args: unknown[]) => mockUseMemberDashboard(...args),
}));

const mockMember = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  dob: '1961-03-15',
  hire_date: '1998-06-01',
  marital_status: 'M',
  status_code: 'A',
  tier_code: 1,
  dept_name: 'Public Works',
  pos_title: 'Senior Engineer',
};

const mockActiveCases = [
  {
    caseId: 'RET-2026-0147',
    memberId: 10001,
    name: 'Robert Martinez',
    tier: 1,
    dept: 'Public Works',
    retDate: '2026-04-01',
    stage: 'Benefit Calculation',
    stageIdx: 4,
    priority: 'high' as const,
    sla: 'on-track' as const,
    daysOpen: 12,
    flags: ['leave-payout'],
    assignedTo: 'Sarah Johnson',
  },
];

const defaultHookReturn = {
  member: mockMember,
  serviceCredit: null,
  beneficiaries: [],
  timeline: mockTimeline,
  commitments: [],
  activeCases: mockActiveCases,
  correspondence: mockCorrespondence,
  dqScore: mockDQScore,
  dqIssues: mockDQIssues,
  summary: {
    context: 'Robert Martinez — 25 yr 3 mo Tier 1 veteran, case at Benefit Calculation (5/7).',
    attentionItems: [
      {
        severity: 'high' as const,
        label: 'No beneficiaries',
        detail: 'No beneficiary designations on file',
      },
      { severity: 'info' as const, label: 'No DQ issues', detail: 'No data quality issues' },
    ],
  },
  isLoading: false,
  isLoadingSecondary: false,
  error: null,
};

const defaultProps = {
  memberId: 10001,
  onBack: vi.fn(),
  onOpenCase: vi.fn(),
  onChangeView: vi.fn(),
};

describe('MemberDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMemberDashboard.mockReturnValue(defaultHookReturn);
  });

  it('renders page header', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const headings = screen.getAllByText('Member Dashboard');
    expect(headings.length).toBeGreaterThanOrEqual(1);
    // The h1 in the header bar
    expect(headings[0].tagName).toBe('H1');
  });

  it('renders back button that calls onBack', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const backBtn = screen.getByText('Staff Portal');
    fireEvent.click(backBtn);
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('renders Open CRM button that calls onChangeView', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const crmBtn = screen.getByText('Open CRM');
    fireEvent.click(crmBtn);
    expect(defaultProps.onChangeView).toHaveBeenCalledWith('crm', { memberId: 10001 });
  });

  it('shows Open Active Case button when cases exist', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    const caseBtn = screen.getByText('Open Active Case');
    expect(caseBtn).toBeInTheDocument();
  });

  it('opens first active case when Open Active Case is clicked', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    fireEvent.click(screen.getByText('Open Active Case'));
    expect(defaultProps.onOpenCase).toHaveBeenCalledWith(
      'RET-2026-0147',
      10001,
      '2026-04-01',
      ['leave-payout'],
      undefined,
    );
  });

  it('hides Open Active Case button when no cases', () => {
    mockUseMemberDashboard.mockReturnValue({
      ...defaultHookReturn,
      activeCases: [],
    });
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    expect(screen.queryByText('Open Active Case')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseMemberDashboard.mockReturnValue({
      ...defaultHookReturn,
      member: null,
      isLoading: true,
    });
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    expect(screen.getByText('Loading member data...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseMemberDashboard.mockReturnValue({
      ...defaultHookReturn,
      member: null,
      error: new Error('Failed to load member'),
    });
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    expect(screen.getByText('Failed to load member')).toBeInTheDocument();
  });

  it('does not render content when member is null', () => {
    mockUseMemberDashboard.mockReturnValue({
      ...defaultHookReturn,
      member: null,
    });
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    expect(screen.queryByText('Correspondence')).not.toBeInTheDocument();
  });

  it('renders footer', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    expect(screen.getByText(/Aggregated view across data access/)).toBeInTheDocument();
  });

  it('passes memberId to useMemberDashboard', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    expect(mockUseMemberDashboard).toHaveBeenCalledWith(10001);
  });

  it('renders reference cards when member is loaded', () => {
    renderWithProviders(<MemberDashboard {...defaultProps} />);
    // ReferenceCards in the sidebar
    expect(screen.getByText('Interactions')).toBeInTheDocument();
    expect(screen.getByText('Correspondence')).toBeInTheDocument();
    expect(screen.getByText('Service Credit')).toBeInTheDocument();
    expect(screen.getByText('Beneficiaries')).toBeInTheDocument();
    expect(screen.getByText('Data Quality')).toBeInTheDocument();
  });
});
