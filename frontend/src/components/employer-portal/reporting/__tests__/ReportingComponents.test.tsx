import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import FileUpload from '../FileUpload';
import ExceptionDashboard from '../ExceptionDashboard';
import PaymentSetup from '../PaymentSetup';
import ValidationProgress from '../ValidationProgress';
import type { ContributionFile } from '@/types/Employer';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

const mockFile: ContributionFile = {
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
            data: { items: [], total: 0 },
            meta: { ...META, pagination: { total: 0, limit: 25, offset: 0 } },
          }),
      });
    }
    if (url.includes('/api/v1/reporting/payments')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { items: [], total: 0 },
            meta: { ...META, pagination: { total: 0, limit: 25, offset: 0 } },
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('FileUpload', () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.restoreAllMocks());

  it('renders the file upload zone', () => {
    renderWithProviders(<FileUpload orgId="org-001" divisionCode="STATE" />);
    expect(screen.getByText(/drag and drop/i)).toBeTruthy();
  });

  it('renders the recent files heading', () => {
    renderWithProviders(<FileUpload orgId="org-001" divisionCode="STATE" />);
    expect(screen.getByText('Recent Files')).toBeTruthy();
  });
});

describe('ExceptionDashboard', () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.restoreAllMocks());

  it('renders the exception dashboard heading', () => {
    renderWithProviders(<ExceptionDashboard orgId="org-001" />);
    expect(screen.getByText(/exception/i)).toBeTruthy();
  });

  it('shows filter tabs', () => {
    renderWithProviders(<ExceptionDashboard orgId="org-001" />);
    expect(screen.getByText(/all/i)).toBeTruthy();
    expect(screen.getByText(/unresolved/i)).toBeTruthy();
  });
});

describe('PaymentSetup', () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.restoreAllMocks());

  it('renders the payment setup heading', () => {
    renderWithProviders(<PaymentSetup orgId="org-001" />);
    expect(screen.getByText(/payment/i)).toBeTruthy();
  });
});

describe('ValidationProgress', () => {
  it('renders status steps for a validated file', () => {
    renderWithProviders(<ValidationProgress file={mockFile} />);
    expect(screen.getAllByText(/validated/i).length).toBeGreaterThan(0);
  });

  it('shows record counts', () => {
    renderWithProviders(<ValidationProgress file={mockFile} />);
    expect(screen.getByText('95')).toBeTruthy(); // valid
    expect(screen.getByText('5')).toBeTruthy(); // failed (exact match)
  });

  it('shows total records', () => {
    renderWithProviders(<ValidationProgress file={mockFile} />);
    expect(screen.getByText(/100/)).toBeTruthy();
  });
});
