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

function makeManyEntries(count: number) {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      auditId: i + 1,
      tenantId: 't1',
      eventType: 'UPDATE' as const,
      entityType: 'Contact' as const,
      entityId: `c${i}`,
      agentId: `agent${i}`,
      summary: `Entry ${i}`,
      eventTime: '2026-03-17T14:00:00Z',
    })),
    pagination: { total: count, limit: 50, offset: 0, hasMore: count >= 50 },
  };
}

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

  // --- New feature tests ---

  it('renders date range filter dropdown', () => {
    renderWithProviders(<AuditTrailPanel />);
    const dateSelect = screen.getByLabelText(/date range/i);
    expect(dateSelect).toBeInTheDocument();
    expect(dateSelect).toHaveValue('all');
  });

  it('date range filter has all preset options', () => {
    renderWithProviders(<AuditTrailPanel />);
    const dateSelect = screen.getByLabelText(/date range/i);
    const options = Array.from(dateSelect.querySelectorAll('option'));
    const values = options.map((o) => o.getAttribute('value'));
    expect(values).toEqual(['all', '24h', '7d', '30d', '90d']);
  });

  it('renders agent filter input', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByPlaceholderText(/filter by agent/i)).toBeInTheDocument();
  });

  it('filters entries by agent ID', () => {
    renderWithProviders(<AuditTrailPanel />);
    fireEvent.change(screen.getByPlaceholderText(/filter by agent/i), {
      target: { value: 'jsmith' },
    });
    expect(screen.getByText(/Updated phone number/)).toBeInTheDocument();
    expect(screen.queryByText(/Created phone_inbound/)).not.toBeInTheDocument();
  });

  it('agent filter is case-insensitive', () => {
    renderWithProviders(<AuditTrailPanel />);
    fireEvent.change(screen.getByPlaceholderText(/filter by agent/i), {
      target: { value: 'JSMITH' },
    });
    expect(screen.getByText(/Updated phone number/)).toBeInTheDocument();
  });

  it('renders Export CSV button', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
  });

  it('Export CSV triggers download', () => {
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();

    renderWithProviders(<AuditTrailPanel />);
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');

    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });

  it('does not show Load More when hasMore is false', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows Load More button when there are PAGE_SIZE results', () => {
    mockUseAuditLog.mockReturnValue({
      data: makeManyEntries(50),
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('Load More increments offset in query params', () => {
    mockUseAuditLog.mockReturnValue({
      data: makeManyEntries(50),
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<AuditTrailPanel />);
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(mockUseAuditLog).toHaveBeenCalledWith(expect.objectContaining({ offset: 50 }));
  });
});
