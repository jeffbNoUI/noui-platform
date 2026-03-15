import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CorrespondencePanel from '../CorrespondencePanel';

// Mock correspondence API
vi.mock('@/lib/correspondenceApi', () => ({
  correspondenceAPI: {
    listTemplates: vi.fn().mockResolvedValue([
      {
        templateId: 'tmpl-1',
        templateCode: 'INTAKE_ACK',
        templateName: 'Intake Acknowledgment',
        description: 'Sent after intake is complete',
        stageCategory: 'intake',
        mergeFields: [{ name: 'member_name', description: 'Member Name', required: true }],
        onSendEffects: [],
      },
      {
        templateId: 'tmpl-2',
        templateCode: 'ELIG_NOTICE',
        templateName: 'Eligibility Notice',
        description: 'Eligibility determination letter',
        stageCategory: 'eligibility',
        mergeFields: [],
        onSendEffects: [],
      },
    ]),
    listHistory: vi.fn().mockResolvedValue([
      {
        correspondenceId: 'corr-1',
        subject: 'Welcome Letter',
        status: 'sent',
        createdAt: '2026-03-10T00:00:00Z',
        sentAt: '2026-03-10T12:00:00Z',
      },
    ]),
    generate: vi.fn().mockResolvedValue({
      correspondenceId: 'corr-new',
      bodyRendered: 'Dear Member, your intake is complete.',
      subject: 'Intake Acknowledgment',
      status: 'draft',
      createdAt: '2026-03-15T00:00:00Z',
    }),
  },
}));

// Mock the send hook
vi.mock('@/hooks/useCorrespondence', () => ({
  useCorrespondenceSend: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ executedEffects: [] }),
    isPending: false,
  }),
}));

// Mock merge field resolver
vi.mock('@/lib/mergeFieldResolver', () => ({
  resolveMergeFields: vi.fn(() => ({ member_name: 'Robert Martinez' })),
}));

describe('CorrespondencePanel', () => {
  it('renders Generate Letter and History tabs', async () => {
    renderWithProviders(<CorrespondencePanel memberId={10001} />);
    await waitFor(() => {
      expect(screen.getByText('Generate Letter')).toBeInTheDocument();
    });
    expect(screen.getByText('History (1)')).toBeInTheDocument();
  });

  it('lists available templates after loading', async () => {
    renderWithProviders(<CorrespondencePanel memberId={10001} />);
    await waitFor(() => {
      expect(screen.getByText('Intake Acknowledgment')).toBeInTheDocument();
      expect(screen.getByText('Eligibility Notice')).toBeInTheDocument();
    });
  });

  it('shows stage category badge on templates', async () => {
    renderWithProviders(<CorrespondencePanel memberId={10001} />);
    await waitFor(() => {
      expect(screen.getByText('intake')).toBeInTheDocument();
      expect(screen.getByText('eligibility')).toBeInTheDocument();
    });
  });

  it('shows correspondence history when History tab is clicked', async () => {
    renderWithProviders(<CorrespondencePanel memberId={10001} />);
    await waitFor(() => {
      expect(screen.getByText('History (1)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('History (1)'));
    expect(screen.getByText('Welcome Letter')).toBeInTheDocument();
    expect(screen.getByText('sent')).toBeInTheDocument();
  });

  it('shows empty history message when no history', async () => {
    const { correspondenceAPI } = await import('@/lib/correspondenceApi');
    vi.mocked(correspondenceAPI.listHistory).mockResolvedValueOnce([]);
    renderWithProviders(<CorrespondencePanel memberId={10002} />);
    await waitFor(() => {
      expect(screen.getByText('History (0)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('History (0)'));
    expect(screen.getByText('No correspondence history')).toBeInTheDocument();
  });
});
