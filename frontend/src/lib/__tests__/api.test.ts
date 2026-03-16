import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectorAPI, intelligenceAPI } from '@/lib/api';

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { id: 'mock' },
          meta: { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' },
        }),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('connectorAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('getMember builds correct URL with member ID', async () => {
    await connectorAPI.getMember(10001);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/10001');
  });

  it('getEmployment hits employment endpoint', async () => {
    await connectorAPI.getEmployment(10001);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/10001/employment');
  });

  it('getSalary hits salary endpoint', async () => {
    await connectorAPI.getSalary(10001);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/10001/salary');
  });

  it('getAMS hits salary/ams endpoint', async () => {
    await connectorAPI.getAMS(10001);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/10001/salary/ams');
  });

  it('getBeneficiaries hits beneficiaries endpoint', async () => {
    await connectorAPI.getBeneficiaries(10001);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/10001/beneficiaries');
  });

  it('getDRO hits dro endpoint', async () => {
    await connectorAPI.getDRO(10001);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/10001/dro');
  });

  it('getContributions hits contributions endpoint', async () => {
    await connectorAPI.getContributions(10001);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/10001/contributions');
  });

  it('getServiceCredit hits service-credit endpoint', async () => {
    await connectorAPI.getServiceCredit(10001);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/v1/members/10001/service-credit');
  });
});

describe('intelligenceAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('evaluateEligibility sends POST with member_id', async () => {
    await intelligenceAPI.evaluateEligibility(10001, '2026-06-01');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/eligibility/evaluate');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.member_id).toBe(10001);
    expect(body.retirement_date).toBe('2026-06-01');
  });

  it('calculateBenefit sends POST with required fields', async () => {
    await intelligenceAPI.calculateBenefit(10001, '2026-06-01');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/benefit/calculate');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.member_id).toBe(10001);
    expect(body.retirement_date).toBe('2026-06-01');
  });

  it('calculateBenefit includes optional dro_id when provided', async () => {
    await intelligenceAPI.calculateBenefit(10001, '2026-06-01', 5);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.dro_id).toBe(5);
  });

  it('calculateOptions sends POST to options endpoint', async () => {
    await intelligenceAPI.calculateOptions(10001, '2026-06-01', '1960-03-15');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/benefit/options');
    const body = JSON.parse(opts.body);
    expect(body.beneficiary_dob).toBe('1960-03-15');
  });

  it('calculateScenario sends POST with retirement_dates array', async () => {
    const dates = ['2026-06-01', '2027-06-01'];
    await intelligenceAPI.calculateScenario(10001, dates);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.retirement_dates).toEqual(dates);
  });

  it('calculateDRO sends POST to dro/calculate endpoint', async () => {
    await intelligenceAPI.calculateDRO(10001, '2026-06-01');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/dro/calculate');
    expect(opts.method).toBe('POST');
  });
});
