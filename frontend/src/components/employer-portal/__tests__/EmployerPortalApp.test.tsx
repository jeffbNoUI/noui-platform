import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import EmployerPortalApp from '../EmployerPortalApp';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    // GET: organizations list (paginated — used by usePortalOrganizations)
    if (url.includes('/v1/crm/organizations')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                orgId: 'org-001',
                orgName: 'City of Denver',
                orgShortName: 'Denver',
                employerStatus: 'ACTIVE',
                memberCount: 1250,
                reportingFrequency: 'Monthly',
                lastContributionDate: '2026-02-15',
                createdAt: '2020-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
                createdBy: 'system',
                updatedBy: 'system',
              },
            ],
            pagination: { total: 1, limit: 25, offset: 0, hasMore: false },
            meta: META,
          }),
      });
    }
    // GET: employer alerts
    if (url.includes('/api/v1/employer/alerts')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
            meta: META,
          }),
      });
    }
    // GET: employer dashboard
    if (url.includes('/api/v1/employer/dashboard')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              pendingExceptions: 3,
              unresolvedTasks: 1,
              recentSubmissions: 5,
              activeAlerts: 0,
            },
            meta: META,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('EmployerPortalApp', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders without crash', () => {
    renderWithProviders(<EmployerPortalApp />);
    expect(screen.getByLabelText('Organization:')).toBeDefined();
  });

  it('shows org selector', () => {
    renderWithProviders(<EmployerPortalApp />);
    const select = screen.getByLabelText('Organization:') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
  });

  it('tab navigation works', async () => {
    renderWithProviders(<EmployerPortalApp />);

    // Dashboard tab is active by default
    const dashboardTab = screen.getByRole('tab', { name: 'Dashboard' });
    expect(dashboardTab.getAttribute('aria-selected')).toBe('true');

    // Click on Reporting tab
    const reportingTab = screen.getByRole('tab', { name: 'Reporting' });
    fireEvent.click(reportingTab);

    // Reporting tab becomes active, shows phase placeholder
    expect(reportingTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Coming Soon')).toBeDefined();
    expect(screen.getByText(/Phase 3/)).toBeDefined();

    // Click back to Dashboard
    fireEvent.click(dashboardTab);
    expect(dashboardTab.getAttribute('aria-selected')).toBe('true');
  });

  it('shows dashboard by default', () => {
    renderWithProviders(<EmployerPortalApp />);
    const dashboardTab = screen.getByRole('tab', { name: 'Dashboard' });
    expect(dashboardTab.getAttribute('aria-selected')).toBe('true');
    // Dashboard content renders summary cards
    expect(screen.getByText('Pending Exceptions')).toBeDefined();
    expect(screen.getByText('Unresolved Tasks')).toBeDefined();
    expect(screen.getByText('Recent Submissions')).toBeDefined();
    expect(screen.getByText('Active Alerts')).toBeDefined();
  });
});
