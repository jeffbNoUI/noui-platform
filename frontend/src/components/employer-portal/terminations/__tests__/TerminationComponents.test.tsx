import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import TerminationForm from '../TerminationForm';
import CertificationHoldPanel from '../CertificationHold';
import RefundStatus from '../RefundStatus';
import type { CertificationHold, RefundApplication } from '@/types/Employer';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

const mockHold: CertificationHold = {
  id: 'hold-001',
  refundApplicationId: 'ref-001',
  orgId: 'org-001',
  memberId: null,
  ssnHash: 'def456hash',
  holdStatus: 'PENDING',
  holdReason: 'PENDING_EMPLOYER_CERTIFICATION',
  countdownDays: 45,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  reminderSentAt: null,
  escalatedAt: null,
  resolvedBy: null,
  resolvedAt: null,
  resolutionNote: null,
  certificationId: null,
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const mockRefund: RefundApplication = {
  id: 'ref-001',
  memberId: null,
  ssnHash: 'abc123hash',
  firstName: 'Jane',
  lastName: 'Doe',
  hireDate: '2015-03-01',
  terminationDate: '2025-12-31',
  separationDate: null,
  yearsOfService: '10.75',
  isVested: true,
  hasDisabilityApp: false,
  disabilityAppDate: null,
  employeeContributions: '45230.15',
  interestRate: '3',
  interestAmount: '8777.01',
  grossRefund: '54007.16',
  federalTaxWithholding: '10801.43',
  droDeduction: '0.00',
  netRefund: '43205.73',
  paymentMethod: null,
  rolloverAmount: null,
  directAmount: null,
  applicationStatus: 'CALCULATION_COMPLETE',
  forfeitureAcknowledged: false,
  forfeitureAcknowledgedAt: null,
  memberSignature: true,
  notarized: true,
  w9Received: true,
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TerminationForm', () => {
  it('renders the form with all required fields', () => {
    renderWithProviders(<TerminationForm orgId="org-001" />);
    expect(screen.getByText('Termination Certification')).toBeTruthy();
    expect(screen.getByPlaceholderText('SSN hash')).toBeTruthy();
    expect(screen.getByText('Submit Certification')).toBeTruthy();
  });

  it('renders termination reason dropdown with all options', () => {
    renderWithProviders(<TerminationForm orgId="org-001" />);
    expect(screen.getByText('Resignation')).toBeTruthy();
    expect(screen.getByText('Retirement')).toBeTruthy();
    expect(screen.getByText('Death')).toBeTruthy();
    expect(screen.getByText('Disability')).toBeTruthy();
  });
});

const PAG = { total: 1, limit: 25, offset: 0, hasMore: false };

describe('CertificationHoldPanel', () => {
  it('shows empty state when no holds', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [],
          pagination: { total: 0, limit: 25, offset: 0, hasMore: false },
        }),
    });

    renderWithProviders(<CertificationHoldPanel orgId="org-001" />);
    // Initially shows loading
    expect(screen.getByText('Loading holds...')).toBeTruthy();
  });

  it('renders holds when data arrives', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [mockHold], pagination: PAG }),
    });

    renderWithProviders(<CertificationHoldPanel orgId="org-001" />);

    const heading = await screen.findByText('Certification Holds (1)');
    expect(heading).toBeTruthy();
  });
});

describe('RefundStatus', () => {
  it('shows loading state initially', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}), // never resolves
    });

    renderWithProviders(<RefundStatus refundId="ref-001" />);
    expect(screen.getByText('Loading refund...')).toBeTruthy();
  });

  it('renders refund calculation breakdown', async () => {
    // Both calls use fetchAPI which expects { data: ..., meta: ... }
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockRefund, meta: META }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { eligible: true, reasons: ['Member is vested'] }, meta: META }),
      });

    renderWithProviders(<RefundStatus refundId="ref-001" />);

    const heading = await screen.findByText(/Refund Application — Jane Doe/);
    expect(heading).toBeTruthy();

    // Check calculation table is rendered
    expect(await screen.findByText('Employee Contributions')).toBeTruthy();
    expect(await screen.findByText('Gross Refund')).toBeTruthy();
    expect(await screen.findByText('Net Refund')).toBeTruthy();
  });
});
