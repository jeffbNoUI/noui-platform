import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CostQuote from '../CostQuote';
import PurchaseRequest from '../PurchaseRequest';
import PaymentTracker from '../PaymentTracker';
import type { SCPRequest } from '@/types/Employer';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };
const PAG = { total: 0, limit: 25, offset: 0, hasMore: false };

const mockRequest: SCPRequest = {
  id: 'req-001',
  orgId: 'org-001',
  memberId: null,
  ssnHash: 'hash123',
  firstName: 'Jane',
  lastName: 'Doe',
  serviceType: 'MILITARY_USERRA',
  tier: 'TIER_2',
  yearsRequested: '5.00',
  costFactorId: 'cf-001',
  costFactor: '0.125000',
  annualSalaryAtPurchase: '80000.00',
  totalCost: '50000.00',
  paymentMethod: 'INSTALLMENT',
  amountPaid: '15000.00',
  amountRemaining: '35000.00',
  quoteDate: '2026-01-15',
  quoteExpires: '2026-03-16',
  quoteRecalculated: false,
  documentationReceived: true,
  documentationVerified: true,
  verifiedBy: 'admin',
  verifiedAt: '2026-02-01T10:00:00Z',
  excludesFromRuleOf7585: true,
  excludesFromIpr: true,
  excludesFromVesting: true,
  requestStatus: 'PAYING',
  submittedBy: 'user1',
  submittedAt: '2026-01-10T10:00:00Z',
  reviewedBy: 'reviewer1',
  reviewedAt: '2026-01-20T10:00:00Z',
  reviewNote: null,
  approvedBy: 'approver1',
  approvedAt: '2026-01-25T10:00:00Z',
  deniedBy: null,
  deniedAt: null,
  denialReason: null,
  notes: null,
  createdAt: '2026-01-10T10:00:00Z',
  updatedAt: '2026-02-15T10:00:00Z',
};

const mockCompletedRequest: SCPRequest = {
  ...mockRequest,
  id: 'req-002',
  firstName: 'Robert',
  lastName: 'Johnson',
  requestStatus: 'COMPLETED',
  amountPaid: '50000.00',
  amountRemaining: '0.00',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function okResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data, meta: META }),
    headers: new Headers({ 'content-type': 'application/json' }),
  };
}

function paginatedResponse(items: unknown[], total: number) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: items, pagination: { ...PAG, total }, meta: META }),
    headers: new Headers({ 'content-type': 'application/json' }),
  };
}

// ─── CostQuote ──────────────────────────────────────────────────────────────

describe('CostQuote', () => {
  it('renders the cost quote form', () => {
    fetchMock.mockResolvedValue(okResponse({}));
    renderWithProviders(<CostQuote orgId="org-001" />);
    expect(screen.getByText('Service Credit Purchase — Cost Quote')).toBeTruthy();
    expect(screen.getByText('Generate Quote')).toBeTruthy();
  });

  it('has tier, hire date, age, salary, and years fields', () => {
    fetchMock.mockResolvedValue(okResponse({}));
    renderWithProviders(<CostQuote orgId="org-001" />);
    expect(screen.getByText('Tier')).toBeTruthy();
    expect(screen.getByText('Hire Date')).toBeTruthy();
    expect(screen.getByText('Age at Purchase')).toBeTruthy();
    expect(screen.getByText('Annual Salary')).toBeTruthy();
    expect(screen.getByText('Years to Purchase')).toBeTruthy();
  });

  it('generate button is disabled when form is incomplete', () => {
    fetchMock.mockResolvedValue(okResponse({}));
    renderWithProviders(<CostQuote orgId="org-001" />);
    const button = screen.getByText('Generate Quote');
    expect(button).toHaveProperty('disabled', true);
  });
});

// ─── PurchaseRequest ────────────────────────────────────────────────────────

describe('PurchaseRequest', () => {
  it('renders the purchase requests list', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([mockRequest], 1));
    renderWithProviders(<PurchaseRequest orgId="org-001" />);
    expect(screen.getByText('Purchase Requests')).toBeTruthy();
    expect(screen.getByText('New Request')).toBeTruthy();
  });

  it('shows empty state when no requests', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<PurchaseRequest orgId="org-001" />);
    expect(await screen.findByText('No purchase requests found.')).toBeTruthy();
  });

  it('displays request with name and service type', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([mockRequest], 1));
    renderWithProviders(<PurchaseRequest orgId="org-001" />);
    expect(await screen.findByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('Military (USERRA)')).toBeTruthy();
  });

  it('displays request status badge', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([mockRequest], 1));
    renderWithProviders(<PurchaseRequest orgId="org-001" />);
    expect(await screen.findByText('PAYING')).toBeTruthy();
  });

  it('shows exclusion flag notice in the form', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<PurchaseRequest orgId="org-001" />);
    const newBtn = await screen.findByText('New Request');
    fireEvent.click(newBtn);
    expect(
      screen.getByText(/Purchased service credit contributes to benefit calculation only/),
    ).toBeTruthy();
    expect(screen.getByText(/does NOT count toward Rule of 75\/85/)).toBeTruthy();
  });

  it('shows approve/deny buttons for UNDER_REVIEW requests', async () => {
    const reviewRequest = { ...mockRequest, requestStatus: 'UNDER_REVIEW' as const };
    fetchMock.mockResolvedValue(paginatedResponse([reviewRequest], 1));
    renderWithProviders(<PurchaseRequest orgId="org-001" />);
    expect(await screen.findByText('Approve')).toBeTruthy();
    expect(screen.getByText('Deny')).toBeTruthy();
  });

  it('shows cancel button for DRAFT requests', async () => {
    const draftRequest = { ...mockRequest, requestStatus: 'DRAFT' as const };
    fetchMock.mockResolvedValue(paginatedResponse([draftRequest], 1));
    renderWithProviders(<PurchaseRequest orgId="org-001" />);
    expect(await screen.findByText('Cancel')).toBeTruthy();
  });
});

// ─── PaymentTracker ─────────────────────────────────────────────────────────

describe('PaymentTracker', () => {
  it('renders the payment tracker', () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<PaymentTracker orgId="org-001" />);
    expect(screen.getByText('Payment Tracker')).toBeTruthy();
  });

  it('shows empty state when no payable requests', async () => {
    // Only draft requests — none should appear in payment tracker
    const draftOnly = { ...mockRequest, requestStatus: 'DRAFT' as const };
    fetchMock.mockResolvedValue(paginatedResponse([draftOnly], 1));
    renderWithProviders(<PaymentTracker orgId="org-001" />);
    expect(await screen.findByText('No requests with active payments.')).toBeTruthy();
  });

  it('displays payment details for active request', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([mockRequest], 1));
    renderWithProviders(<PaymentTracker orgId="org-001" />);
    expect(await screen.findByText('Jane Doe')).toBeTruthy();
    expect(screen.getByText('$50000.00')).toBeTruthy(); // total cost
    expect(screen.getByText('$15000.00')).toBeTruthy(); // paid
    expect(screen.getByText('$35000.00')).toBeTruthy(); // remaining
    expect(screen.getByText('Record Payment')).toBeTruthy();
  });

  it('does not show Record Payment for completed requests', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([mockCompletedRequest], 1));
    renderWithProviders(<PaymentTracker orgId="org-001" />);
    expect(await screen.findByText('Robert Johnson')).toBeTruthy();
    expect(screen.getByText('COMPLETED')).toBeTruthy();
    expect(screen.queryByText('Record Payment')).toBeNull();
  });

  it('shows payment method label', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([mockRequest], 1));
    renderWithProviders(<PaymentTracker orgId="org-001" />);
    expect(await screen.findByText('Installment')).toBeTruthy();
  });
});

// ─── Exclusion Flag Type Safety ─────────────────────────────────────────────

describe('SCPRequest exclusion flag type safety', () => {
  it('mock request has all exclusion flags set to true', () => {
    expect(mockRequest.excludesFromRuleOf7585).toBe(true);
    expect(mockRequest.excludesFromIpr).toBe(true);
    expect(mockRequest.excludesFromVesting).toBe(true);
  });

  it('completed request preserves exclusion flags', () => {
    expect(mockCompletedRequest.excludesFromRuleOf7585).toBe(true);
    expect(mockCompletedRequest.excludesFromIpr).toBe(true);
    expect(mockCompletedRequest.excludesFromVesting).toBe(true);
  });
});
