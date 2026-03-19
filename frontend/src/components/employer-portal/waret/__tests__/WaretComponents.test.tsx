import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DesignationForm from '../DesignationForm';
import DesignationDashboard from '../DesignationDashboard';
import LimitTracker from '../LimitTracker';
import AnnualWorksheet from '../AnnualWorksheet';
import type {
  WaretDesignation,
  WaretPenalty,
  WaretTracking,
  WaretYTDSummary,
} from '@/types/Employer';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

const mockDesignation: WaretDesignation = {
  id: 'desig-001',
  orgId: 'org-001',
  retireeId: null,
  ssnHash: 'hash123',
  firstName: 'John',
  lastName: 'Smith',
  designationType: 'STANDARD',
  calendarYear: 2026,
  dayLimit: 110,
  hourLimit: 720,
  consecutiveYears: 2,
  districtId: null,
  orpExempt: false,
  designationStatus: 'APPROVED',
  peracareConflict: false,
  peracareLetterSentAt: null,
  peracareResponseDue: null,
  peracareResolved: false,
  approvedBy: 'admin',
  approvedAt: '2026-01-10T10:00:00Z',
  revokedBy: null,
  revokedAt: null,
  revocationReason: null,
  notes: null,
  createdAt: '2026-01-05T10:00:00Z',
  updatedAt: '2026-01-10T10:00:00Z',
};

const mockTracking: WaretTracking = {
  id: 'track-001',
  designationId: 'desig-001',
  orgId: 'org-001',
  retireeId: null,
  workDate: '2026-02-15',
  hoursWorked: '6.50',
  countsAsDay: true,
  ytdDays: 15,
  ytdHours: '98.50',
  entryStatus: 'RECORDED',
  submittedBy: 'user1',
  verifiedBy: null,
  verifiedAt: null,
  notes: null,
  createdAt: '2026-02-15T10:00:00Z',
  updatedAt: '2026-02-15T10:00:00Z',
};

const mockYTDSummary: WaretYTDSummary = {
  designationId: 'desig-001',
  orgId: 'org-001',
  retireeId: null,
  ssnHash: 'hash123',
  calendarYear: 2026,
  designationType: 'STANDARD',
  dayLimit: 110,
  hourLimit: 720,
  orpExempt: false,
  totalDays: 15,
  totalHours: '98.50',
  daysRemaining: 95,
  hoursRemaining: '621.50',
  overLimit: false,
};

const mockPenalty: WaretPenalty = {
  id: 'pen-001',
  designationId: 'desig-001',
  retireeId: null,
  ssnHash: 'hash123',
  penaltyType: 'OVER_LIMIT',
  penaltyMonth: '2026-03-01',
  monthlyBenefit: '4832.17',
  daysOverLimit: 3,
  penaltyRate: '0.0500',
  penaltyAmount: '724.83',
  employerRecovery: '0.00',
  retireeRecovery: '0.00',
  spreadMonths: 1,
  monthlyDeduction: '724.83',
  penaltyStatus: 'ASSESSED',
  assessedBy: 'admin',
  assessedAt: '2026-03-15T10:00:00Z',
  appealedAt: null,
  appealNote: null,
  waivedBy: null,
  waivedAt: null,
  waiverReason: null,
  createdAt: '2026-03-15T10:00:00Z',
  updatedAt: '2026-03-15T10:00:00Z',
};

// ── Mock fetch ───────────────────────────────────────────────────────────────

const PAG = { total: 0, limit: 25, offset: 0, hasMore: false };

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

// ── DesignationForm tests ────────────────────────────────────────────────────

describe('DesignationForm', () => {
  it('renders the form title', () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<DesignationForm orgId="org-001" />);
    expect(screen.getByText('New WARET Designation')).toBeTruthy();
  });

  it('renders SSN hash and name fields', () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<DesignationForm orgId="org-001" />);
    expect(screen.getByPlaceholderText('SSN hash')).toBeTruthy();
  });

  it('renders designation type selector', () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<DesignationForm orgId="org-001" />);
    expect(screen.getByText(/Standard/)).toBeTruthy();
  });

  it('renders ORP exempt checkbox', () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<DesignationForm orgId="org-001" />);
    expect(screen.getByText(/ORP Exempt/)).toBeTruthy();
  });

  it('renders submit button', () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<DesignationForm orgId="org-001" />);
    expect(screen.getByText('Submit Designation')).toBeTruthy();
  });
});

// ── DesignationDashboard tests ───────────────────────────────────────────────

describe('DesignationDashboard', () => {
  it('renders the title', () => {
    fetchMock.mockResolvedValue(paginatedResponse([mockDesignation], 1));
    renderWithProviders(<DesignationDashboard orgId="org-001" />);
    expect(screen.getByText('WARET Designations')).toBeTruthy();
  });

  it('renders new designation button', () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<DesignationDashboard orgId="org-001" />);
    expect(screen.getByText('+ New Designation')).toBeTruthy();
  });

  it('renders year filter', () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<DesignationDashboard orgId="org-001" />);
    expect(screen.getByText(String(new Date().getFullYear()))).toBeTruthy();
  });
});

// ── LimitTracker tests ───────────────────────────────────────────────────────

describe('LimitTracker', () => {
  it('renders the title', () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(mockYTDSummary)) // getYTDSummary
      .mockResolvedValueOnce(paginatedResponse([mockTracking], 1)); // listTracking
    renderWithProviders(<LimitTracker designationId="desig-001" orgId="org-001" />);
    expect(screen.getByText('Limit Tracker')).toBeTruthy();
  });

  it('renders record work day button', () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(mockYTDSummary))
      .mockResolvedValueOnce(paginatedResponse([], 0));
    renderWithProviders(<LimitTracker designationId="desig-001" orgId="org-001" />);
    expect(screen.getByText('+ Record Work Day')).toBeTruthy();
  });
});

// ── AnnualWorksheet tests ────────────────────────────────────────────────────

describe('AnnualWorksheet', () => {
  it('renders the title', () => {
    fetchMock.mockResolvedValue(paginatedResponse([mockPenalty], 1));
    renderWithProviders(<AnnualWorksheet designationId="desig-001" />);
    expect(screen.getByText('Annual Penalty Worksheet')).toBeTruthy();
  });

  it('shows empty state when no penalties', async () => {
    fetchMock.mockResolvedValue(paginatedResponse([], 0));
    renderWithProviders(<AnnualWorksheet designationId="desig-001" />);
    expect(await screen.findByText(/No penalties assessed/)).toBeTruthy();
  });
});
