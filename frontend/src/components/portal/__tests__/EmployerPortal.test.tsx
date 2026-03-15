import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import EmployerPortal from '../EmployerPortal';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockOrgs = [
  {
    orgId: 'ORG-001',
    orgName: 'City of Denver',
    orgShortName: 'Denver',
    legacyEmployerId: 'EMP-100',
    employerStatus: 'active',
    memberCount: 142,
    lastContributionDate: '2026-02-28',
    reportingFrequency: 'Monthly',
  },
];

const mockOrg = mockOrgs[0];
let mockConversations: Record<string, unknown>[] = [];
const mockInteractions: Record<string, unknown>[] = [];

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useCRM', () => ({
  usePortalOrganizations: () => ({ data: mockOrgs }),
  usePortalOrganization: () => ({ data: mockOrg }),
  useEmployerConversations: () => ({ data: mockConversations }),
  usePublicConversationInteractions: () => ({ data: mockInteractions }),
  useCreatePortalMessage: () => ({ mutate: vi.fn() }),
  useCreateNewConversation: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/components/crm', () => ({
  ConversationThread: () => <div data-testid="conversation-thread" />,
  MessageComposer: ({ onSend }: { onSend: (msg: string) => void }) => (
    <button data-testid="message-composer" onClick={() => onSend('test')}>
      Send
    </button>
  ),
  EMPLOYER_THEME: {},
}));

vi.mock('../EmployerCorrespondenceTab', () => ({
  default: () => <div data-testid="employer-correspondence-tab">Correspondence Content</div>,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('EmployerPortal', () => {
  const onChangeView = vi.fn();

  beforeEach(() => {
    onChangeView.mockClear();
    mockConversations = [];
  });

  it('renders nav bar with Employer Portal title and tab navigation', () => {
    renderWithProviders(<EmployerPortal onChangeView={onChangeView} />);
    expect(screen.getByText('Employer Portal')).toBeInTheDocument();
    expect(screen.getByText('Communications')).toBeInTheDocument();
    expect(screen.getByText('Correspondence')).toBeInTheDocument();
    expect(screen.getByText('Reporting')).toBeInTheDocument();
    expect(screen.getByText('Enrollment')).toBeInTheDocument();
  });

  it('renders org info banner with organization details', () => {
    renderWithProviders(<EmployerPortal onChangeView={onChangeView} />);
    expect(screen.getByText('City of Denver')).toBeInTheDocument();
    expect(screen.getByText('ID: EMP-100')).toBeInTheDocument();
    expect(screen.getByText('142 members')).toBeInTheDocument();
    expect(screen.getByText('Monthly reporting')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows reporting tab with Coming Soon overlay', () => {
    renderWithProviders(<EmployerPortal onChangeView={onChangeView} />);
    fireEvent.click(screen.getByText('Reporting'));
    expect(screen.getByText('Contribution Reporting')).toBeInTheDocument();
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
  });

  it('shows enrollment tab with stats and action cards', () => {
    renderWithProviders(<EmployerPortal onChangeView={onChangeView} />);
    fireEvent.click(screen.getByText('Enrollment'));
    expect(screen.getByText('Active Members')).toBeInTheDocument();
    expect(screen.getByText('Pending Actions')).toBeInTheDocument();
    expect(screen.getByText('Enrollment Actions')).toBeInTheDocument();
    expect(screen.getByText('New Hire Enrollment')).toBeInTheDocument();
    expect(screen.getByText('Termination / Separation')).toBeInTheDocument();
    expect(screen.getByText('Status Change')).toBeInTheDocument();
  });

  it('shows correspondence tab', () => {
    renderWithProviders(<EmployerPortal onChangeView={onChangeView} />);
    fireEvent.click(screen.getByText('Correspondence'));
    expect(screen.getByTestId('employer-correspondence-tab')).toBeInTheDocument();
  });

  it('calls onChangeView when Member Portal button is clicked', () => {
    renderWithProviders(<EmployerPortal onChangeView={onChangeView} />);
    fireEvent.click(screen.getByText('Member Portal'));
    expect(onChangeView).toHaveBeenCalledWith('portal');
  });

  it('calls onChangeView when Staff CRM button is clicked', () => {
    renderWithProviders(<EmployerPortal onChangeView={onChangeView} />);
    fireEvent.click(screen.getByText('Staff CRM'));
    expect(onChangeView).toHaveBeenCalledWith('crm');
  });

  it('shows empty thread state in communications tab', () => {
    renderWithProviders(<EmployerPortal onChangeView={onChangeView} />);
    // Communications is the default tab
    expect(screen.getByText('Threads')).toBeInTheDocument();
    expect(screen.getByText('No communication threads.')).toBeInTheDocument();
  });
});
