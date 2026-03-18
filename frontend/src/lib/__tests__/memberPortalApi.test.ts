import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  memberAuthAPI,
  memberPreferencesAPI,
  scenarioAPI,
  notificationAPI,
  paymentAPI,
  changeRequestAPI,
  addressAPI,
  refundAPI,
} from '../memberPortalApi';

// Mock fetch at the network layer — wraps response in Go API envelope { data: ... }
function setupFetch(data: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('memberAuthAPI', () => {
  it('verify posts identity verification request', async () => {
    const fetchMock = setupFetch({ status: 'matched', member_id: 10001, message: 'Match found' });
    const result = await memberAuthAPI.verify({
      last_name: 'Martinez',
      date_of_birth: '1963-03-08',
      ssn_last_four: '3456',
      is_beneficiary: false,
    });
    expect(result.status).toBe('matched');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/member-auth/verify',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('memberPreferencesAPI', () => {
  it('get fetches preferences for member', async () => {
    const prefs = {
      communication: {},
      accessibility: { text_size: 'standard', high_contrast: false, reduce_motion: false },
      tour_completed: false,
      tour_version: 0,
    };
    const fetchMock = setupFetch(prefs);
    const result = await memberPreferencesAPI.get(10001);
    expect(result.tour_completed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/members/10001/preferences', expect.anything());
  });
});

describe('scenarioAPI', () => {
  it('list fetches scenarios for member', async () => {
    const fetchMock = setupFetch([{ id: 'sc-1', label: 'Test Scenario' }]);
    const result = await scenarioAPI.list(10001);
    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/scenarios?member_id=10001', expect.anything());
  });

  it('save posts new scenario', async () => {
    const fetchMock = setupFetch({ id: 'sc-new', label: 'New Scenario' });
    await scenarioAPI.save(
      10001,
      'New Scenario',
      {
        retirement_date: '2028-01-01',
        service_purchase_years: 0,
        salary_growth_pct: 2.5,
        payment_option: 'life_only',
      },
      { monthly_benefit: 5000 },
      '2026-03-01',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/scenarios',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('delete removes scenario', async () => {
    setupFetch(undefined);
    await scenarioAPI.delete('sc-1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/scenarios/sc-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('notificationAPI', () => {
  it('list fetches notifications', async () => {
    setupFetch([{ id: 'n-1', title: 'Test', read: false }]);
    const result = await notificationAPI.list(10001);
    expect(result).toHaveLength(1);
  });

  it('markRead patches notification', async () => {
    setupFetch(undefined);
    await notificationAPI.markRead('n-1');
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/notifications/n-1/read',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

describe('paymentAPI', () => {
  it('list fetches payment history', async () => {
    setupFetch([{ id: 'p-1', gross_amount: 3450.0 }]);
    const result = await paymentAPI.list(10006);
    expect(result[0].gross_amount).toBe(3450.0);
  });

  it('taxDocuments fetches 1099-R records', async () => {
    setupFetch([{ id: 'td-1', tax_year: 2024, available: true }]);
    const result = await paymentAPI.taxDocuments(10006);
    expect(result[0].tax_year).toBe(2024);
  });
});

describe('changeRequestAPI', () => {
  it('list fetches filtered issues', async () => {
    const fetchMock = setupFetch([]);
    await changeRequestAPI.list(10001);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('member_id=10001'),
      expect.anything(),
    );
  });
});

describe('addressAPI', () => {
  it('list fetches addresses for member', async () => {
    setupFetch([{ id: 'a-1', type: 'mailing', line1: '123 Main St' }]);
    const result = await addressAPI.list(10001);
    expect(result[0].line1).toBe('123 Main St');
  });
});

describe('refundAPI', () => {
  it('estimate fetches refund calculation', async () => {
    const fetchMock = setupFetch({ employee_contributions: 45000, interest: 12000, total: 57000 });
    const result = await refundAPI.estimate(10009);
    expect(result.total).toBe(57000);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/members/10009/refund-estimate',
      expect.anything(),
    );
  });
});
