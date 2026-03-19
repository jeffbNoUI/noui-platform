import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import {
  useContributionFiles,
  useExceptions,
  usePayments,
  useLateInterest,
} from '@/hooks/useEmployerReporting';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

const mockFile = {
  id: 'file-001',
  orgId: 'org-001',
  uploadedBy: 'pu-001',
  fileName: 'jan-2026-payroll.txt',
  fileType: 'TEXT',
  fileStatus: 'VALIDATED',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  divisionCode: 'STATE',
  totalRecords: 100,
  validRecords: 95,
  failedRecords: 5,
  totalAmount: '150000.00',
  validatedAmount: '142500.00',
  replacesFileId: null,
  validationStartedAt: '2026-02-01T10:00:00Z',
  validationCompletedAt: '2026-02-01T10:01:30Z',
  createdAt: '2026-02-01T09:00:00Z',
  updatedAt: '2026-02-01T10:01:30Z',
};

const mockException = {
  id: 'exc-001',
  fileId: 'file-001',
  recordId: 'rec-005',
  orgId: 'org-001',
  exceptionType: 'RATE_MISMATCH',
  exceptionStatus: 'UNRESOLVED',
  description: 'Member contribution does not match expected rate',
  expectedValue: '550.00',
  submittedValue: '600.00',
  assignedTo: null,
  resolutionNote: null,
  resolvedBy: null,
  resolvedAt: null,
  escalatedAt: null,
  dcRoutedAt: null,
  createdAt: '2026-02-01T10:01:30Z',
  updatedAt: '2026-02-01T10:01:30Z',
};

const mockPayment = {
  id: 'pay-001',
  fileId: 'file-001',
  orgId: 'org-001',
  paymentMethod: 'ACH',
  paymentStatus: 'PENDING',
  amount: '142500.00',
  scheduledDate: null,
  processedDate: null,
  referenceNumber: null,
  discrepancyAmount: null,
  createdBy: 'pu-001',
  createdAt: '2026-02-01T11:00:00Z',
  updatedAt: '2026-02-01T11:00:00Z',
};

const mockInterest = {
  id: 'int-001',
  orgId: 'org-001',
  fileId: 'file-001',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  daysLate: 15,
  baseAmount: '150000.00',
  interestRate: '0.010000',
  interestAmount: '61.64',
  minimumChargeApplied: false,
  paymentId: null,
  createdAt: '2026-02-15T00:00:00Z',
};

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/v1/reporting/files') && !url.includes('records')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items: [mockFile], total: 1 },
            meta: { ...META, pagination: { total: 1, limit: 25, offset: 0 } },
          }),
      });
    }
    if (url.includes('/api/v1/reporting/exceptions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items: [mockException], total: 1 },
            meta: { ...META, pagination: { total: 1, limit: 25, offset: 0 } },
          }),
      });
    }
    if (url.includes('/api/v1/reporting/payments')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items: [mockPayment], total: 1 },
            meta: { ...META, pagination: { total: 1, limit: 25, offset: 0 } },
          }),
      });
    }
    if (url.includes('/api/v1/reporting/interest/')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [mockInterest],
            meta: META,
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useContributionFiles', () => {
  let fetchMock: ReturnType<typeof setupFetch>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches files for an org', async () => {
    const { result } = renderHookWithProviders(() => useContributionFiles('org-001'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reporting/files'),
      expect.any(Object),
    );
  });

  it('does not fetch when orgId is empty', () => {
    const { result } = renderHookWithProviders(() => useContributionFiles(''));
    expect(result.current.isFetching).toBe(false);
  });
});

describe('useExceptions', () => {
  let fetchMock: ReturnType<typeof setupFetch>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches exceptions for an org', async () => {
    const { result } = renderHookWithProviders(() => useExceptions('org-001'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reporting/exceptions'),
      expect.any(Object),
    );
  });

  it('filters exceptions by status', async () => {
    const { result } = renderHookWithProviders(() => useExceptions('org-001', 'UNRESOLVED'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('status=UNRESOLVED'),
      expect.any(Object),
    );
  });
});

describe('usePayments', () => {
  let fetchMock: ReturnType<typeof setupFetch>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches payments for an org', async () => {
    const { result } = renderHookWithProviders(() => usePayments('org-001'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reporting/payments'),
      expect.any(Object),
    );
  });
});

describe('useLateInterest', () => {
  let fetchMock: ReturnType<typeof setupFetch>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches late interest for an org', async () => {
    const { result } = renderHookWithProviders(() => useLateInterest('org-001'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reporting/interest/org-001'),
      expect.any(Object),
    );
  });

  it('does not fetch when orgId is empty', () => {
    const { result } = renderHookWithProviders(() => useLateInterest(''));
    expect(result.current.isFetching).toBe(false);
  });
});
