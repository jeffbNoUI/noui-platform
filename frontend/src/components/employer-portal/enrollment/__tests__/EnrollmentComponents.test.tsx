import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import NewHireForm from '../NewHireForm';
import DuplicateResolution from '../DuplicateResolution';
import PERAChoiceTracker from '../PERAChoiceTracker';
import StatusChangeForm from '../StatusChangeForm';
import type { EnrollmentSubmission, DuplicateFlag, PERAChoiceElection } from '@/types/Employer';

const META = { requestId: 'test', timestamp: '2026-01-01T00:00:00Z' };

const mockSubmission: EnrollmentSubmission = {
  id: 'sub-001',
  orgId: 'org-001',
  submittedBy: 'user-001',
  enrollmentType: 'EMPLOYER_INITIATED',
  submissionStatus: 'DRAFT',
  ssnHash: 'abc123hash',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1985-03-15',
  hireDate: '2024-06-01',
  planCode: 'DB',
  divisionCode: 'SD',
  tier: 'T3',
  middleName: null,
  suffix: null,
  gender: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  zipCode: null,
  email: null,
  phone: null,
  isSafetyOfficer: false,
  jobTitle: null,
  annualSalary: null,
  isRehire: false,
  priorMemberId: null,
  priorRefundTaken: null,
  conflictStatus: null,
  conflictFields: null,
  conflictResolvedBy: null,
  conflictResolvedAt: null,
  validationErrors: null,
  validatedAt: null,
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const mockDuplicate: DuplicateFlag = {
  id: 'dup-001',
  submissionId: 'sub-001',
  matchType: 'SSN_EXACT',
  matchedMemberId: 'member-001',
  matchedSubmissionId: null,
  confidenceScore: '1.0',
  matchDetails: null,
  resolutionStatus: 'PENDING',
  resolvedBy: null,
  resolvedAt: null,
  resolutionNote: null,
  createdAt: '2026-01-15T10:00:00Z',
};

const mockElection: PERAChoiceElection = {
  id: 'pe-001',
  submissionId: 'sub-001',
  memberId: null,
  hireDate: '2024-06-01',
  windowOpens: '2024-06-01',
  windowCloses: '2099-12-31',
  electionStatus: 'PENDING',
  electedAt: null,
  electedPlan: null,
  notificationSentAt: null,
  dcTeamNotified: false,
  reminderSentAt: null,
  memberAcknowledged: false,
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const PAG = { total: 1, limit: 25, offset: 0, hasMore: false };

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    // Single submission by ID (non-paginated — uses fetchAPI → unwraps data)
    if (
      url.includes('/api/v1/enrollment/submissions/sub-001') &&
      !url.includes('/duplicates') &&
      !url.includes('/submit') &&
      !url.includes('/approve') &&
      !url.includes('/reject')
    ) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockSubmission, meta: META }),
      });
    }
    // Submission list (paginated)
    if (
      url.includes('/api/v1/enrollment/submissions') &&
      !url.includes('/duplicates') &&
      !url.includes('/submit') &&
      !url.includes('/approve') &&
      !url.includes('/reject')
    ) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [mockSubmission], pagination: PAG }),
      });
    }
    // Submission duplicates (non-paginated — fetchAPI)
    if (url.includes('/duplicates') && url.includes('sub-')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { items: [mockDuplicate], total: 1 }, meta: META }),
      });
    }
    // Pending duplicates (paginated)
    if (url.includes('/api/v1/enrollment/duplicates')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [mockDuplicate], pagination: PAG }),
      });
    }
    // PERAChoice (paginated)
    if (url.includes('/api/v1/enrollment/perachoice')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [mockElection], pagination: PAG }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, meta: META }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// ─── NewHireForm ─────────────────────────────────────────────────────────────

describe('NewHireForm', () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.restoreAllMocks());

  it('renders the form with required fields', () => {
    renderWithProviders(<NewHireForm orgId="org-001" />);
    expect(screen.getByText(/New Member Enrollment/)).toBeTruthy();
    expect(screen.getByText(/First Name/)).toBeTruthy();
    expect(screen.getByText(/Last Name/)).toBeTruthy();
    expect(screen.getByText(/SSN Hash/)).toBeTruthy();
    expect(screen.getByText(/Date of Birth/)).toBeTruthy();
    expect(screen.getByText(/Hire Date/)).toBeTruthy();
    expect(screen.getByText('Division *')).toBeTruthy();
  });

  it('renders enrollment type selector', () => {
    renderWithProviders(<NewHireForm orgId="org-001" />);
    expect(screen.getByText(/Enrollment Type/)).toBeTruthy();
    expect(screen.getByText(/New Hire/)).toBeTruthy();
  });

  it('renders plan code selector with DB, DC, ORP options', () => {
    renderWithProviders(<NewHireForm orgId="org-001" />);
    expect(screen.getByText(/Defined Benefit/)).toBeTruthy();
    expect(screen.getByText(/Defined Contribution/)).toBeTruthy();
    expect(screen.getByText(/Optional Retirement Plan/)).toBeTruthy();
  });

  it('renders safety officer checkbox', () => {
    renderWithProviders(<NewHireForm orgId="org-001" />);
    expect(screen.getByText(/Safety Officer/)).toBeTruthy();
  });

  it('renders submit button', () => {
    renderWithProviders(<NewHireForm orgId="org-001" />);
    expect(screen.getByText('Create Enrollment')).toBeTruthy();
  });

  it('renders all 5 COPERA divisions', () => {
    renderWithProviders(<NewHireForm orgId="org-001" />);
    expect(screen.getByText(/School Division/)).toBeTruthy();
    expect(screen.getByText(/Local Government/)).toBeTruthy();
    expect(screen.getByText(/State Division/)).toBeTruthy();
    expect(screen.getByText(/Judicial Division/)).toBeTruthy();
    expect(screen.getByText(/DPS/)).toBeTruthy();
  });
});

// ─── DuplicateResolution ─────────────────────────────────────────────────────

describe('DuplicateResolution', () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.restoreAllMocks());

  it('renders duplicate review queue header', async () => {
    renderWithProviders(<DuplicateResolution orgId="org-001" />);
    expect(await screen.findByText(/Duplicate Review Queue/)).toBeTruthy();
  });

  it('shows SSN exact match badge', async () => {
    renderWithProviders(<DuplicateResolution orgId="org-001" />);
    expect(await screen.findByText(/SSN Exact Match/)).toBeTruthy();
  });

  it('shows review button for pending flags', async () => {
    renderWithProviders(<DuplicateResolution orgId="org-001" />);
    expect(await screen.findByText('Review')).toBeTruthy();
  });

  it('shows empty state when no duplicates', async () => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { items: [], total: 0 },
              meta: { ...META, pagination: { total: 0, limit: 25, offset: 0 } },
            }),
        }),
      ),
    );
    renderWithProviders(<DuplicateResolution orgId="org-001" />);
    expect(await screen.findByText(/No pending duplicate flags/)).toBeTruthy();
  });
});

// ─── PERAChoiceTracker ───────────────────────────────────────────────────────

describe('PERAChoiceTracker', () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.restoreAllMocks());

  it('renders PERAChoice elections header', async () => {
    renderWithProviders(<PERAChoiceTracker orgId="org-001" />);
    expect(await screen.findByText(/PERAChoice Elections/)).toBeTruthy();
  });

  it('shows election action buttons for pending elections', async () => {
    renderWithProviders(<PERAChoiceTracker orgId="org-001" />);
    expect(await screen.findByText('Elect DC Plan')).toBeTruthy();
    expect(screen.getByText('Keep DB Plan')).toBeTruthy();
  });

  it('shows hire date and window dates', async () => {
    renderWithProviders(<PERAChoiceTracker orgId="org-001" />);
    expect(await screen.findByText(/Hire date: 2024-06-01/)).toBeTruthy();
  });

  it('shows empty state when no pending elections', async () => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { items: [], total: 0 },
              meta: { ...META, pagination: { total: 0, limit: 25, offset: 0 } },
            }),
        }),
      ),
    );
    renderWithProviders(<PERAChoiceTracker orgId="org-001" />);
    expect(await screen.findByText(/No pending PERAChoice elections/)).toBeTruthy();
  });
});

// ─── StatusChangeForm ────────────────────────────────────────────────────────

describe('StatusChangeForm', () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.restoreAllMocks());

  it('renders member name and details', async () => {
    renderWithProviders(<StatusChangeForm submissionId="sub-001" />);
    expect(await screen.findByText(/Jane Doe/)).toBeTruthy();
  });

  it('shows status badge', async () => {
    renderWithProviders(<StatusChangeForm submissionId="sub-001" />);
    expect(await screen.findByText('Draft')).toBeTruthy();
  });

  it('shows submit button for DRAFT status', async () => {
    renderWithProviders(<StatusChangeForm submissionId="sub-001" />);
    expect(await screen.findByText('Submit for Validation')).toBeTruthy();
  });
});
