import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import AuditTrailPanel from '../AuditTrailPanel';

const mockUseAuditLog = vi.fn();
vi.mock('@/hooks/useAuditLog', () => ({
  useAuditLog: (...args: unknown[]) => mockUseAuditLog(...args),
}));

const MOCK_ENTRIES = {
  items: [
    {
      auditId: 1,
      tenantId: 't1',
      eventType: 'UPDATE',
      entityType: 'Contact',
      entityId: 'c1',
      agentId: 'jsmith',
      summary: 'Updated phone number for Maria Santos',
      fieldChanges: { phone: { old: '555-0100', new: '555-0142' } },
      eventTime: '2026-03-17T14:32:00Z',
    },
    {
      auditId: 2,
      tenantId: 't1',
      eventType: 'CREATE',
      entityType: 'Interaction',
      entityId: 'i1',
      agentId: 'ajonez',
      summary: 'Created phone_inbound interaction',
      eventTime: '2026-03-17T14:28:00Z',
    },
  ],
  pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
};

describe('AuditTrailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuditLog.mockReturnValue({ data: MOCK_ENTRIES, isLoading: false, isError: false });
  });

  it('renders filter controls', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByLabelText(/entity type/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('renders audit entries with summary text', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByText(/Updated phone number/)).toBeInTheDocument();
    expect(screen.getByText(/Created phone_inbound/)).toBeInTheDocument();
  });

  it('shows agent and event type badges', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByText('jsmith')).toBeInTheDocument();
    expect(screen.getByText('UPDATE')).toBeInTheDocument();
    expect(screen.getByText('CREATE')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseAuditLog.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows error state gracefully', () => {
    mockUseAuditLog.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it('filters by entity type', () => {
    renderWithProviders(<AuditTrailPanel />);
    fireEvent.change(screen.getByLabelText(/entity type/i), { target: { value: 'Contact' } });
    expect(mockUseAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'Contact' }),
    );
  });
});
