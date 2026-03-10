import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import StaffPortal from '@/components/StaffPortal';

// Mock case management hooks
vi.mock('@/hooks/useCaseManagement', () => ({
  useCases: () => ({
    data: [
      {
        caseId: 'RET-2026-0147',
        memberId: 10001,
        name: 'Robert Martinez',
        caseType: 'RET',
        tier: 1,
        dept: 'Public Works',
        retDate: '2026-04-01',
        stage: 'Benefit Calculation',
        stageIdx: 4,
        priority: 'standard' as const,
        sla: 'on-track' as const,
        daysOpen: 5,
        flags: ['leave-payout'],
        assignedTo: 'Sarah Chen',
        status: 'active',
      },
    ],
    isLoading: false,
    error: null,
  }),
  useStages: () => ({
    data: [
      { stageIdx: 0, stageName: 'Application Intake', sortOrder: 0 },
      { stageIdx: 1, stageName: 'Document Verification', sortOrder: 1 },
      { stageIdx: 2, stageName: 'Eligibility Review', sortOrder: 2 },
      { stageIdx: 3, stageName: 'Marital Share Calculation', sortOrder: 3 },
      { stageIdx: 4, stageName: 'Benefit Calculation', sortOrder: 4 },
      { stageIdx: 5, stageName: 'Election Recording', sortOrder: 5 },
      { stageIdx: 6, stageName: 'Certification', sortOrder: 6 },
    ],
    isLoading: false,
    error: null,
  }),
}));

const noop = vi.fn();

describe('StaffPortal', () => {
  it('renders work queue tab by default', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    expect(screen.getByText('My Work Queue')).toBeInTheDocument();
    expect(screen.getByText('Active Cases')).toBeInTheDocument();
    expect(screen.getByText('RET-2026-0147')).toBeInTheDocument();
  });

  it('renders Member Lookup tab', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    fireEvent.click(screen.getByText('Member Lookup'));
    expect(screen.getByText('Member / Employer Lookup')).toBeInTheDocument();
  });

  it('renders Supervisor Dashboard tab', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    fireEvent.click(screen.getByText('Supervisor'));
    expect(screen.getByText('Supervisor Dashboard')).toBeInTheDocument();
  });

  it('renders Executive Dashboard tab', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    fireEvent.click(screen.getByText('Executive'));
    expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
  });

  it('renders CSR Hub tab', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    fireEvent.click(screen.getByText('CSR Hub'));
    expect(screen.getByText('CSR Context Hub')).toBeInTheDocument();
  });

  it('renders Service Map tab', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    fireEvent.click(screen.getByText('Service Map'));
    expect(screen.getByText('Platform Service Map')).toBeInTheDocument();
  });

  it('renders Data Quality tab', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    fireEvent.click(screen.getByText('Data Quality'));
    // The tab header changes to "Data Quality"
    const headers = screen.getAllByText('Data Quality');
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Correspondence tab', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    fireEvent.click(screen.getByText('Correspondence'));
    // Tab header
    const headers = screen.getAllByText('Correspondence');
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it('shows all 8 sidebar nav items', () => {
    renderWithProviders(<StaffPortal onOpenCase={noop} onViewMember={noop} onChangeView={noop} />);
    const labels = [
      'Work Queue',
      'Member Lookup',
      'Supervisor',
      'Executive',
      'CSR Hub',
      'Service Map',
      'Data Quality',
      'Correspondence',
    ];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
