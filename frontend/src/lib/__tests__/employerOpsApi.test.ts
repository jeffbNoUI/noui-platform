import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchEmployerRoster,
  fetchEmployerMemberSummary,
  fetchEmployerDQScore,
  fetchEmployerDQIssues,
  fetchEmployerDQChecks,
  fetchOrgInteractions,
  fetchOrgContacts,
  createEmployerInteraction,
  fetchEmployerTemplates,
  generateEmployerLetter,
  fetchEmployerCases,
  fetchEmployerCaseSummary,
  createEmployerCase,
} from '@/lib/employerOpsApi';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };
const PAGINATION = { total: 1, limit: 25, offset: 0, hasMore: false };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ id: 'mock' }],
          pagination: PAGINATION,
          meta: META,
        }),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('employerOpsApi', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── Data Access (port 8081) ──────────────────────────────────────────────

  it('fetchEmployerRoster builds URL with orgId', async () => {
    await fetchEmployerRoster('org-001');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/employer/org-001/members');
  });

  it('fetchEmployerRoster appends limit and offset params', async () => {
    await fetchEmployerRoster('org-001', { limit: 25, offset: 50 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=25');
    expect(url).toContain('offset=50');
  });

  it('fetchEmployerRoster omits empty params', async () => {
    await fetchEmployerRoster('org-001', {});
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain('?');
  });

  it('fetchEmployerMemberSummary builds correct URL', async () => {
    await fetchEmployerMemberSummary('org-002');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/employer/org-002/members/summary');
  });

  // ─── Data Quality (port 8086) ─────────────────────────────────────────────

  it('fetchEmployerDQScore builds correct URL', async () => {
    await fetchEmployerDQScore('org-003');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/dq/employer/org-003/score');
  });

  it('fetchEmployerDQIssues builds URL with severity and status filters', async () => {
    await fetchEmployerDQIssues('org-003', { severity: 'critical', status: 'open', limit: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/dq/employer/org-003/issues');
    expect(url).toContain('severity=critical');
    expect(url).toContain('status=open');
    expect(url).toContain('limit=10');
  });

  it('fetchEmployerDQIssues omits undefined filters', async () => {
    await fetchEmployerDQIssues('org-003');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/dq/employer/org-003/issues');
    expect(url).not.toContain('?');
  });

  it('fetchEmployerDQChecks builds correct URL with pagination', async () => {
    await fetchEmployerDQChecks('org-003', { limit: 5, offset: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/dq/employer/org-003/checks');
    expect(url).toContain('limit=5');
    expect(url).toContain('offset=10');
  });

  // ─── CRM (port 8083/8084) ─────────────────────────────────────────────────

  it('fetchOrgInteractions builds URL with category filter', async () => {
    await fetchOrgInteractions('org-004', { category: 'ENROLLMENT_ISSUE', limit: 20 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/crm/organizations/org-004/interactions');
    expect(url).toContain('category=ENROLLMENT_ISSUE');
    expect(url).toContain('limit=20');
  });

  it('fetchOrgContacts builds URL with pagination', async () => {
    await fetchOrgContacts('org-004', { limit: 50, offset: 25 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/crm/organizations/org-004/contacts');
    expect(url).toContain('limit=50');
    expect(url).toContain('offset=25');
  });

  it('createEmployerInteraction sends POST to employer interactions endpoint', async () => {
    await createEmployerInteraction({
      orgId: 'org-004',
      channel: 'PHONE_INBOUND',
      interactionType: 'inquiry',
      direction: 'INBOUND',
      category: 'GENERAL_EMPLOYER',
      outcome: 'resolved',
      summary: 'Test interaction',
    });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/crm/interactions/employer');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeTruthy();
    const body = JSON.parse(opts.body as string);
    expect(body.orgId).toBe('org-004');
  });

  // ─── Correspondence (port 8085) ───────────────────────────────────────────

  it('fetchEmployerTemplates builds correct URL with pagination', async () => {
    await fetchEmployerTemplates({ limit: 10, offset: 0 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/correspondence/templates/employer');
    expect(url).toContain('limit=10');
  });

  it('fetchEmployerTemplates works without options', async () => {
    await fetchEmployerTemplates();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/correspondence/templates/employer');
    expect(url).not.toContain('?');
  });

  it('generateEmployerLetter sends POST with template and merge data', async () => {
    await generateEmployerLetter({
      templateId: 'tmpl-001',
      orgId: 'org-005',
      contactId: 'ct-001',
      mergeData: { orgName: 'Acme Corp' },
    });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/correspondence/generate/employer');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body as string);
    expect(body.templateId).toBe('tmpl-001');
    expect(body.orgId).toBe('org-005');
    expect(body.mergeData.orgName).toBe('Acme Corp');
  });

  // ─── Case Management (port 8088) ─────────────────────────────────────────

  it('fetchEmployerCases builds URL with orgId', async () => {
    await fetchEmployerCases('org-006');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/employer/org-006/cases');
  });

  it('fetchEmployerCases appends pagination params', async () => {
    await fetchEmployerCases('org-006', { limit: 10, offset: 20 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
  });

  it('fetchEmployerCaseSummary builds correct URL', async () => {
    await fetchEmployerCaseSummary('org-006');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/employer/org-006/cases/summary');
  });

  it('createEmployerCase sends POST with case data', async () => {
    await createEmployerCase({
      employerOrgId: 'org-006',
      triggerType: 'CONTRIBUTION_EXCEPTION',
      triggerReferenceId: 'ref-001',
      memberId: 10001,
      priority: 'high',
    });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/employer/cases');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body as string);
    expect(body.employerOrgId).toBe('org-006');
    expect(body.triggerType).toBe('CONTRIBUTION_EXCEPTION');
    expect(body.memberId).toBe(10001);
  });
});
