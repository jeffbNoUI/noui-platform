import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import IssueManagementPanel from '../IssueManagementPanel';

// ─── Mock API responses ─────────────────────────────────────────────────────

const MOCK_ISSUES = [
  {
    id: 1,
    issueId: 'ISS-042',
    tenantId: 'test',
    title: 'Benefit calc rounding error for Tier 2 members',
    description: 'Monthly benefit calculation produces values off by $0.01-$0.03.',
    severity: 'critical',
    category: 'defect',
    status: 'open',
    affectedService: 'Intelligence',
    reportedBy: 'mwilson',
    assignedTo: 'jsmith',
    reportedAt: '2026-03-15T09:30:00Z',
    resolvedAt: null,
    resolutionNote: null,
    createdAt: '2026-03-15T09:30:00Z',
    updatedAt: '2026-03-15T09:30:00Z',
  },
  {
    id: 2,
    issueId: 'ISS-041',
    tenantId: 'test',
    title: 'Correspondence template missing merge field',
    description: 'The retirement confirmation letter template references a missing field.',
    severity: 'high',
    category: 'defect',
    status: 'in-work',
    affectedService: 'Correspondence',
    reportedBy: 'klee',
    assignedTo: 'ajonez',
    reportedAt: '2026-03-14T14:22:00Z',
    resolvedAt: null,
    resolutionNote: null,
    createdAt: '2026-03-14T14:22:00Z',
    updatedAt: '2026-03-14T14:22:00Z',
  },
  {
    id: 3,
    issueId: 'ISS-039',
    tenantId: 'test',
    title: 'Add export button to audit trail panel',
    description: 'Users have requested CSV export for compliance.',
    severity: 'low',
    category: 'enhancement',
    status: 'open',
    affectedService: 'Platform',
    reportedBy: 'ajonez',
    assignedTo: null,
    reportedAt: '2026-03-12T16:45:00Z',
    resolvedAt: null,
    resolutionNote: null,
    createdAt: '2026-03-12T16:45:00Z',
    updatedAt: '2026-03-12T16:45:00Z',
  },
  {
    id: 4,
    issueId: 'ISS-038',
    tenantId: 'test',
    title: 'Case management slow query',
    description: 'Work queue query takes >5s.',
    severity: 'high',
    category: 'incident',
    status: 'resolved',
    affectedService: 'Case Management',
    reportedBy: 'mwilson',
    assignedTo: 'jsmith',
    reportedAt: '2026-03-10T08:15:00Z',
    resolvedAt: '2026-03-11T14:30:00Z',
    resolutionNote: 'Added composite index. Query time reduced from 5.2s to 45ms.',
    createdAt: '2026-03-10T08:15:00Z',
    updatedAt: '2026-03-11T14:30:00Z',
  },
];

const MOCK_STATS = {
  openCount: 3,
  criticalCount: 1,
  avgResolution: 1.5,
  resolvedCount: 1,
};

function setupFetch(overrides?: { issues?: typeof MOCK_ISSUES; stats?: typeof MOCK_STATS }) {
  const issues = overrides?.issues ?? MOCK_ISSUES;
  const stats = overrides?.stats ?? MOCK_STATS;

  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/v1/issues/stats')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: stats,
            meta: { request_id: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    if (typeof url === 'string' && url.includes('/v1/issues')) {
      // Filter mock issues based on query params
      const urlObj = new URL(url, 'http://localhost');
      let filtered = [...issues];
      const statusParam = urlObj.searchParams.get('status');
      const categoryParam = urlObj.searchParams.get('category');
      const assignedParam = urlObj.searchParams.get('assigned_to');
      if (statusParam) filtered = filtered.filter((i) => i.status === statusParam);
      if (categoryParam) filtered = filtered.filter((i) => i.category === categoryParam);
      if (assignedParam) filtered = filtered.filter((i) => i.assignedTo === assignedParam);

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: filtered,
            pagination: { total: filtered.length, limit: 25, offset: 0, hasMore: false },
            meta: { request_id: 'test', timestamp: new Date().toISOString() },
          }),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { message: 'Not found' } }),
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('IssueManagementPanel', () => {
  beforeEach(() => {
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders summary stat cards', async () => {
    renderWithProviders(<IssueManagementPanel />);
    await waitFor(() => {
      expect(screen.getByText('Open Issues')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Critical').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Avg Resolution')).toBeInTheDocument();
    expect(screen.getByText('Resolved (30d)')).toBeInTheDocument();
  });

  it('renders issue list from API', async () => {
    renderWithProviders(<IssueManagementPanel />);
    await waitFor(() => {
      expect(screen.getAllByText(/ISS-/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows severity badges', async () => {
    renderWithProviders(<IssueManagementPanel />);
    await waitFor(() => {
      expect(screen.getAllByText(/critical/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders filter controls', async () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/severity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assigned/i)).toBeInTheDocument();
  });

  it('filters by category', async () => {
    renderWithProviders(<IssueManagementPanel />);
    await waitFor(() => {
      expect(screen.getByText('ISS-042')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'enhancement' } });
    await waitFor(() => {
      expect(screen.getByText('ISS-039')).toBeInTheDocument();
    });
    expect(screen.queryByText('ISS-042')).not.toBeInTheDocument();
  });

  it('filters by assigned', async () => {
    renderWithProviders(<IssueManagementPanel />);
    await waitFor(() => {
      expect(screen.getByText('ISS-042')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/assigned/i), { target: { value: 'jsmith' } });
    await waitFor(() => {
      expect(screen.getByText('ISS-042')).toBeInTheDocument();
      expect(screen.getByText('ISS-038')).toBeInTheDocument();
    });
    expect(screen.queryByText('ISS-039')).not.toBeInTheDocument();
  });

  it('expands issue to show detail via button role', async () => {
    renderWithProviders(<IssueManagementPanel />);
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
    const issueButtons = screen.getAllByRole('button');
    const firstIssueBtn = issueButtons.find((btn) => btn.textContent?.includes('ISS-'));
    expect(firstIssueBtn).toBeDefined();
    fireEvent.click(firstIssueBtn!);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('shows error message when API is unavailable', async () => {
    vi.restoreAllMocks();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Internal Server Error' } }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<IssueManagementPanel />);
    await waitFor(() => {
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
    });
  });
});
