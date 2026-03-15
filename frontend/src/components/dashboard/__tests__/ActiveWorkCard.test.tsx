import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ActiveWorkCard from '../ActiveWorkCard';
import type { RetirementCase } from '@/types/Case';
import type { Commitment } from '@/types/CRM';

const mockCases: RetirementCase[] = [
  {
    caseId: 'RET-2026-0147',
    tenantId: '00000000-0000-0000-0000-000000000001',
    memberId: 10001,
    caseType: 'retirement',
    retDate: '2026-07-01',
    priority: 'urgent',
    sla: 'at-risk',
    stage: 'Eligibility Determination',
    stageIdx: 2,
    assignedTo: 'Sarah Chen',
    daysOpen: 18,
    status: 'active',
    flags: ['leave-payout'],
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-03-05T00:00:00Z',
    name: 'Robert Martinez',
    tier: 1,
    dept: 'Public Works',
  },
  {
    caseId: 'RET-2026-0159',
    tenantId: '00000000-0000-0000-0000-000000000001',
    memberId: 10003,
    caseType: 'retirement',
    retDate: '2026-09-01',
    priority: 'standard',
    sla: 'on-track',
    stage: 'Verify Employment',
    stageIdx: 1,
    assignedTo: 'Sarah Chen',
    daysOpen: 7,
    status: 'active',
    flags: [],
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
    name: 'David Washington',
    tier: 3,
    dept: 'Technology Services',
  },
];

const mockCommitments: Commitment[] = [
  {
    commitmentId: 'CMT-001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    interactionId: 'INT-001',
    contactId: 'C-1001',
    description: 'Send benefit estimate letter',
    targetDate: '2026-03-20',
    ownerAgent: 'agent-mike',
    ownerTeam: 'Benefits Team',
    status: 'pending',
    alertDaysBefore: 1,
    alertSent: false,
    createdAt: '2026-03-05T00:00:00Z',
    createdBy: 'agent-mike',
    updatedAt: '2026-03-05T00:00:00Z',
    updatedBy: 'agent-mike',
  },
  {
    commitmentId: 'CMT-002',
    tenantId: '00000000-0000-0000-0000-000000000001',
    interactionId: 'INT-001',
    contactId: 'C-1001',
    description: 'Already done task',
    targetDate: '2026-03-10',
    ownerAgent: 'agent-mike',
    ownerTeam: 'Benefits Team',
    status: 'fulfilled',
    fulfilledAt: '2026-03-09T00:00:00Z',
    fulfillmentNote: 'Done',
    alertDaysBefore: 1,
    alertSent: false,
    createdAt: '2026-03-05T00:00:00Z',
    createdBy: 'agent-mike',
    updatedAt: '2026-03-09T00:00:00Z',
    updatedBy: 'agent-mike',
  },
];

describe('ActiveWorkCard', () => {
  it('shows empty state when no cases or commitments', () => {
    const onOpenCase = vi.fn();
    renderWithProviders(
      <ActiveWorkCard activeCases={[]} commitments={[]} onOpenCase={onOpenCase} />,
    );
    expect(screen.getByText('No active work items')).toBeInTheDocument();
  });

  it('renders case IDs, priority badges, SLA labels, and stage info', () => {
    const onOpenCase = vi.fn();
    renderWithProviders(
      <ActiveWorkCard activeCases={mockCases} commitments={[]} onOpenCase={onOpenCase} />,
    );
    expect(screen.getByText('RET-2026-0147')).toBeInTheDocument();
    expect(screen.getByText('RET-2026-0159')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('standard')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('Eligibility Determination')).toBeInTheDocument();
    expect(screen.getByText('18d open')).toBeInTheDocument();
  });

  it('renders open commitments and hides fulfilled ones', () => {
    const onOpenCase = vi.fn();
    renderWithProviders(
      <ActiveWorkCard activeCases={[]} commitments={mockCommitments} onOpenCase={onOpenCase} />,
    );
    // Pending commitment should be visible
    expect(screen.getByText('Send benefit estimate letter')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText(/agent-mike/)).toBeInTheDocument();
    // Fulfilled commitment should be hidden
    expect(screen.queryByText('Already done task')).not.toBeInTheDocument();
  });

  it('shows correct total badge count (cases + open commitments only)', () => {
    const onOpenCase = vi.fn();
    renderWithProviders(
      <ActiveWorkCard
        activeCases={mockCases}
        commitments={mockCommitments}
        onOpenCase={onOpenCase}
      />,
    );
    // 2 cases + 1 open commitment = 3 total (fulfilled commitment excluded)
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onOpenCase with correct args when case row is clicked', () => {
    const onOpenCase = vi.fn();
    renderWithProviders(
      <ActiveWorkCard activeCases={mockCases} commitments={[]} onOpenCase={onOpenCase} />,
    );
    fireEvent.click(screen.getByText('RET-2026-0147'));
    expect(onOpenCase).toHaveBeenCalledWith(
      'RET-2026-0147',
      10001,
      '2026-07-01',
      ['leave-payout'],
      undefined,
    );
  });

  it('renders case flag badges', () => {
    const onOpenCase = vi.fn();
    renderWithProviders(
      <ActiveWorkCard activeCases={mockCases} commitments={[]} onOpenCase={onOpenCase} />,
    );
    expect(screen.getByText('leave-payout')).toBeInTheDocument();
  });
});
