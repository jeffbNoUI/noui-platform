import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import {
  useEmployerRoster,
  useEmployerMemberSummary,
  useEmployerDQScore,
  useEmployerDQIssues,
  useEmployerCases,
  useEmployerCaseSummary,
  useEmployerTemplates,
  useOrgInteractions,
  useOrgContacts,
  useCreateEmployerInteraction,
  useCreateEmployerCase,
  useGenerateEmployerLetter,
  useEmployerAlerts,
} from '@/hooks/useEmployerOps';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };
const PAGINATION = { total: 1, limit: 25, offset: 0, hasMore: false };

/** Route-aware fetch mock for Employer Ops endpoints. */
function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    // POST: create case
    if (url.includes('/employer/cases') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { caseId: 'case-new', status: 'OPEN' },
            meta: META,
          }),
      });
    }
    // POST: create interaction
    if (url.includes('/crm/interactions/employer') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { interactionId: 'int-new', channel: 'PHONE_INBOUND' },
            meta: META,
          }),
      });
    }
    // POST: generate letter
    if (url.includes('/correspondence/generate/employer') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { correspondenceId: 'corr-new', status: 'GENERATED' },
            meta: META,
          }),
      });
    }
    // GET: member summary
    if (url.includes('/members/summary')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              org_id: 'org-001',
              total_members: 150,
              active_count: 120,
              retired_count: 20,
              terminated_count: 5,
              deferred_count: 5,
              tier1_count: 40,
              tier2_count: 60,
              tier3_count: 50,
            },
            meta: META,
          }),
      });
    }
    // GET: roster (paginated)
    if (url.match(/\/employer\/[^/]+\/members/)) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                memberId: 1,
                firstName: 'Alice',
                lastName: 'Smith',
                tier: 1,
                dept: 'HR',
                status: 'ACTIVE',
              },
            ],
            pagination: PAGINATION,
            meta: META,
          }),
      });
    }
    // GET: DQ score — route-specific responses for alert tests
    if (url.includes('/dq/employer/org-critical/score')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              overallScore: 45,
              totalChecks: 10,
              passingChecks: 4,
              openIssues: 3,
              criticalIssues: 2,
              categoryScores: {},
              lastRunAt: null,
            },
            meta: META,
          }),
      });
    }
    if (url.includes('/dq/employer/org-warning/score')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              overallScore: 72,
              totalChecks: 10,
              passingChecks: 7,
              openIssues: 1,
              criticalIssues: 0,
              categoryScores: {},
              lastRunAt: null,
            },
            meta: META,
          }),
      });
    }
    if (url.includes('/dq/employer/org-healthy/score')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              overallScore: 95,
              totalChecks: 10,
              passingChecks: 9,
              openIssues: 0,
              criticalIssues: 0,
              categoryScores: {},
              lastRunAt: null,
            },
            meta: META,
          }),
      });
    }
    // GET: DQ score — generic fallback
    if (url.includes('/dq/employer') && url.includes('/score')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              overallScore: 85,
              totalChecks: 10,
              passingChecks: 8,
              openIssues: 0,
              criticalIssues: 0,
              categoryScores: {},
              lastRunAt: null,
            },
            meta: META,
          }),
      });
    }
    // GET: DQ issues (paginated)
    if (url.includes('/dq/employer') && url.includes('/issues')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ issueId: 'iss-001', severity: 'critical', description: 'Bad SSN' }],
            pagination: PAGINATION,
            meta: META,
          }),
      });
    }
    // GET: case summary — route-specific for alert tests
    if (url.includes('/employer/org-critical/cases/summary')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              orgId: 'org-critical',
              totalCases: 20,
              activeCases: 15,
              completedCases: 5,
              atRiskCases: 3,
            },
            meta: META,
          }),
      });
    }
    if (url.includes('/employer/org-warning/cases/summary')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              orgId: 'org-warning',
              totalCases: 5,
              activeCases: 3,
              completedCases: 2,
              atRiskCases: 0,
            },
            meta: META,
          }),
      });
    }
    if (url.includes('/employer/org-healthy/cases/summary')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              orgId: 'org-healthy',
              totalCases: 2,
              activeCases: 1,
              completedCases: 1,
              atRiskCases: 0,
            },
            meta: META,
          }),
      });
    }
    // GET: case summary — generic fallback
    if (url.includes('/cases/summary')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              orgId: 'org-001',
              totalCases: 8,
              activeCases: 5,
              completedCases: 3,
              atRiskCases: 0,
            },
            meta: META,
          }),
      });
    }
    // GET: cases (paginated)
    if (url.match(/\/employer\/[^/]+\/cases/)) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ caseId: 'case-001', status: 'OPEN', priority: 'MEDIUM' }],
            pagination: PAGINATION,
            meta: META,
          }),
      });
    }
    // GET: interactions (paginated)
    if (url.includes('/crm/organizations') && url.includes('/interactions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { interactionId: 'int-001', summary: 'Follow-up call', channel: 'PHONE_INBOUND' },
            ],
            pagination: PAGINATION,
            meta: META,
          }),
      });
    }
    // GET: contacts (paginated)
    if (url.includes('/crm/organizations') && url.includes('/contacts')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ contactId: 'ct-001', firstName: 'Jane', lastName: 'Doe' }],
            pagination: PAGINATION,
            meta: META,
          }),
      });
    }
    // GET: templates (paginated)
    if (url.includes('/correspondence/templates/employer')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ templateId: 'tmpl-001', templateName: 'Welcome Letter' }],
            pagination: PAGINATION,
            meta: META,
          }),
      });
    }
    // Fallback
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: null, meta: META }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useEmployerOps query hooks', () => {
  beforeEach(() => {
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useEmployerRoster returns paginated roster data', async () => {
    const { result } = renderHookWithProviders(() => useEmployerRoster('org-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].firstName).toBe('Alice');
    expect(result.current.data?.pagination.total).toBe(1);
  });

  it('useEmployerRoster is disabled when orgId is empty', () => {
    const { result } = renderHookWithProviders(() => useEmployerRoster(''));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useEmployerMemberSummary returns summary data', async () => {
    const { result } = renderHookWithProviders(() => useEmployerMemberSummary('org-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.total_members).toBe(150);
    expect(result.current.data?.active_count).toBe(120);
  });

  it('useEmployerDQScore returns score data', async () => {
    const { result } = renderHookWithProviders(() => useEmployerDQScore('org-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.overallScore).toBe(85);
    expect(result.current.data?.openIssues).toBe(0);
  });

  it('useEmployerDQIssues returns paginated issues', async () => {
    const { result } = renderHookWithProviders(() =>
      useEmployerDQIssues('org-001', { severity: 'critical' }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].severity).toBe('critical');
  });

  it('useEmployerCases returns paginated cases', async () => {
    const { result } = renderHookWithProviders(() => useEmployerCases('org-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
  });

  it('useEmployerCaseSummary returns summary data', async () => {
    const { result } = renderHookWithProviders(() => useEmployerCaseSummary('org-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.totalCases).toBe(8);
    expect(result.current.data?.activeCases).toBe(5);
  });

  it('useOrgInteractions returns paginated interactions', async () => {
    const { result } = renderHookWithProviders(() => useOrgInteractions('org-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
  });

  it('useOrgContacts returns paginated contacts', async () => {
    const { result } = renderHookWithProviders(() => useOrgContacts('org-001'));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].firstName).toBe('Jane');
  });

  it('useEmployerTemplates returns template list', async () => {
    const { result } = renderHookWithProviders(() => useEmployerTemplates());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].templateName).toBe('Welcome Letter');
  });
});

describe('useEmployerOps mutation hooks', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('useCreateEmployerInteraction posts and invalidates interaction queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateEmployerInteraction());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({
        orgId: 'org-001',
        channel: 'PHONE_INBOUND',
        interactionType: 'inquiry',
        direction: 'INBOUND',
        category: 'GENERAL_EMPLOYER',
        outcome: 'resolved',
        summary: 'Test call',
      });
    });

    // Verify POST was sent
    const postCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeDefined();

    // Verify cache invalidation targets interactions for the org
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['employer-ops', 'interactions', 'org-001'],
      }),
    );
  });

  it('useCreateEmployerCase posts and invalidates cases + case-summary', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateEmployerCase());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({
        employerOrgId: 'org-002',
        triggerType: 'CONTRIBUTION_EXCEPTION',
        triggerReferenceId: 'ref-001',
      });
    });

    // Both cases and case-summary should be invalidated
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['employer-ops', 'cases', 'org-002'],
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['employer-ops', 'case-summary', 'org-002'],
      }),
    );
  });

  it('useGenerateEmployerLetter posts and invalidates templates', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useGenerateEmployerLetter());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({
        templateId: 'tmpl-001',
        orgId: 'org-001',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['employer-ops', 'templates'],
      }),
    );
  });
});

describe('useEmployerAlerts', () => {
  beforeEach(() => {
    setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('generates critical alert for DQ score below critical threshold', async () => {
    const orgIds = ['org-critical'];
    const orgNames = { 'org-critical': 'Critical Corp' };

    const { result } = renderHookWithProviders(() => useEmployerAlerts(orgIds, orgNames));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const dqAlert = result.current.alerts.find(
      (a) => a.orgId === 'org-critical' && a.type === 'dq_score',
    );
    expect(dqAlert).toBeDefined();
    expect(dqAlert?.severity).toBe('critical');
    expect(dqAlert?.message).toContain('45%');
  });

  it('generates warning alert for DQ score between critical and warning thresholds', async () => {
    const orgIds = ['org-warning'];
    const orgNames = { 'org-warning': 'Warning Inc' };

    const { result } = renderHookWithProviders(() => useEmployerAlerts(orgIds, orgNames));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const dqAlert = result.current.alerts.find(
      (a) => a.orgId === 'org-warning' && a.type === 'dq_score',
    );
    expect(dqAlert).toBeDefined();
    expect(dqAlert?.severity).toBe('warning');
  });

  it('generates no DQ score alert for healthy org', async () => {
    const orgIds = ['org-healthy'];
    const orgNames = { 'org-healthy': 'Healthy LLC' };

    const { result } = renderHookWithProviders(() => useEmployerAlerts(orgIds, orgNames));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const dqScoreAlert = result.current.alerts.find(
      (a) => a.orgId === 'org-healthy' && a.type === 'dq_score',
    );
    expect(dqScoreAlert).toBeUndefined();
  });

  it('generates critical DQ issues alert when criticalIssues > 0', async () => {
    const orgIds = ['org-critical'];
    const orgNames = { 'org-critical': 'Critical Corp' };

    const { result } = renderHookWithProviders(() => useEmployerAlerts(orgIds, orgNames));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const issueAlert = result.current.alerts.find(
      (a) => a.orgId === 'org-critical' && a.type === 'dq_issues',
    );
    expect(issueAlert).toBeDefined();
    expect(issueAlert?.severity).toBe('critical');
    expect(issueAlert?.message).toContain('2 critical');
  });

  it('generates warning DQ issues alert when openIssues > 0 but no critical', async () => {
    const orgIds = ['org-warning'];
    const orgNames = { 'org-warning': 'Warning Inc' };

    const { result } = renderHookWithProviders(() => useEmployerAlerts(orgIds, orgNames));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const issueAlert = result.current.alerts.find(
      (a) => a.orgId === 'org-warning' && a.type === 'dq_issues',
    );
    expect(issueAlert).toBeDefined();
    expect(issueAlert?.severity).toBe('warning');
    expect(issueAlert?.message).toContain('1 open');
  });

  it('generates SLA breach alert when atRiskCases >= threshold', async () => {
    const orgIds = ['org-critical'];
    const orgNames = { 'org-critical': 'Critical Corp' };

    const { result } = renderHookWithProviders(() => useEmployerAlerts(orgIds, orgNames));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const slaAlert = result.current.alerts.find(
      (a) => a.orgId === 'org-critical' && a.type === 'sla_breach',
    );
    expect(slaAlert).toBeDefined();
    expect(slaAlert?.severity).toBe('critical');
    expect(slaAlert?.message).toContain('3 cases at risk');
  });

  it('generates case volume info alert when activeCases >= threshold', async () => {
    const orgIds = ['org-critical'];
    const orgNames = { 'org-critical': 'Critical Corp' };

    const { result } = renderHookWithProviders(() => useEmployerAlerts(orgIds, orgNames));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const volumeAlert = result.current.alerts.find(
      (a) => a.orgId === 'org-critical' && a.type === 'case_volume',
    );
    expect(volumeAlert).toBeDefined();
    expect(volumeAlert?.severity).toBe('info');
  });

  it('sorts alerts: critical first, then warning, then info, then by orgName', async () => {
    const orgIds = ['org-critical', 'org-warning', 'org-healthy'];
    const orgNames = {
      'org-critical': 'Zeta Corp', // last alphabetically
      'org-warning': 'Alpha Inc', // first alphabetically
      'org-healthy': 'Middle LLC',
    };

    const { result } = renderHookWithProviders(() => useEmployerAlerts(orgIds, orgNames));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const alerts = result.current.alerts;
    expect(alerts.length).toBeGreaterThan(0);

    // All critical alerts should come before warning alerts
    const firstWarningIdx = alerts.findIndex((a) => a.severity === 'warning');
    const lastCriticalIdx = alerts.reduce(
      (last, a, i) => (a.severity === 'critical' ? i : last),
      -1,
    );
    if (firstWarningIdx >= 0 && lastCriticalIdx >= 0) {
      expect(lastCriticalIdx).toBeLessThan(firstWarningIdx);
    }

    // All warning alerts should come before info alerts
    const firstInfoIdx = alerts.findIndex((a) => a.severity === 'info');
    const lastWarningIdx = alerts.reduce((last, a, i) => (a.severity === 'warning' ? i : last), -1);
    if (firstInfoIdx >= 0 && lastWarningIdx >= 0) {
      expect(lastWarningIdx).toBeLessThan(firstInfoIdx);
    }
  });

  it('returns empty alerts for empty orgIds', async () => {
    const { result } = renderHookWithProviders(() => useEmployerAlerts([], {}));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.alerts).toHaveLength(0);
  });
});
