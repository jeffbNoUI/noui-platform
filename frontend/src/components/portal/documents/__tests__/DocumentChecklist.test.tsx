import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DocumentChecklist from '../DocumentChecklist';
import type { ChecklistItem, UseDocumentChecklistResult } from '@/hooks/useDocumentChecklist';
import type { DocumentChecklistRule } from '@/types/PlanProfile';

// ── Test Data ────────────────────────────────────────────────────────────────

const RULE_PROOF_OF_AGE: DocumentChecklistRule = {
  document_type: 'proof_of_age',
  label: 'Proof of Age',
  required_when: 'always',
  contexts: ['retirement_application'],
  accepted_formats: ['pdf', 'jpg', 'png'],
  max_size_mb: 10,
};

const RULE_DIRECT_DEPOSIT: DocumentChecklistRule = {
  document_type: 'direct_deposit_form',
  label: 'Direct Deposit Authorization',
  required_when: 'always',
  contexts: ['retirement_application'],
  accepted_formats: ['pdf'],
  max_size_mb: 5,
};

const OUTSTANDING_ITEM: ChecklistItem = {
  rule: RULE_PROOF_OF_AGE,
  status: 'outstanding',
};

const RECEIVED_ITEM: ChecklistItem = {
  rule: RULE_DIRECT_DEPOSIT,
  status: 'received',
  upload: {
    id: 'doc-001',
    document_type: 'direct_deposit_form',
    filename: 'direct_deposit.pdf',
    status: 'received',
    uploaded_at: '2026-03-15T10:00:00Z',
  },
};

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUploadDocument = vi.fn();

const mockUseDocumentChecklist = vi.fn<() => UseDocumentChecklistResult>();
vi.mock('@/hooks/useDocumentChecklist', () => ({
  useDocumentChecklist: (...args: unknown[]) =>
    mockUseDocumentChecklist(...(args as Parameters<typeof mockUseDocumentChecklist>)),
  statusToContext: (s: string) => (s === 'ACTIVE' ? 'retirement_application' : ''),
}));

function mockReturn(
  overrides: Partial<UseDocumentChecklistResult> = {},
): UseDocumentChecklistResult {
  return {
    items: [],
    outstanding: 0,
    received: 0,
    isLoading: false,
    error: null,
    uploadDocument: mockUploadDocument,
    uploadingType: null,
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  memberId: '10001',
  memberStatus: 'ACTIVE',
  memberData: {},
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DocumentChecklist', () => {
  beforeEach(() => {
    mockUploadDocument.mockClear();
  });

  it('shows loading state', () => {
    mockUseDocumentChecklist.mockReturnValue(mockReturn({ isLoading: true }));
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('checklist-loading')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseDocumentChecklist.mockReturnValue(mockReturn({ error: new Error('fail') }));
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('checklist-error')).toBeInTheDocument();
  });

  it('shows empty state when no rules apply', () => {
    mockUseDocumentChecklist.mockReturnValue(mockReturn({ items: [] }));
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('checklist-empty')).toBeInTheDocument();
  });

  it('renders outstanding and received sections', () => {
    mockUseDocumentChecklist.mockReturnValue(
      mockReturn({
        items: [OUTSTANDING_ITEM, RECEIVED_ITEM],
        outstanding: 1,
        received: 1,
      }),
    );
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);

    expect(screen.getByTestId('document-checklist')).toBeInTheDocument();
    expect(screen.getByTestId('outstanding-section')).toBeInTheDocument();
    expect(screen.getByTestId('received-section')).toBeInTheDocument();
  });

  it('shows summary counts', () => {
    mockUseDocumentChecklist.mockReturnValue(
      mockReturn({
        items: [OUTSTANDING_ITEM, RECEIVED_ITEM],
        outstanding: 1,
        received: 1,
      }),
    );
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);

    const summary = screen.getByTestId('checklist-summary');
    expect(summary).toHaveTextContent('1 outstanding');
    expect(summary).toHaveTextContent('1 received');
  });

  it('renders outstanding item with upload button', () => {
    mockUseDocumentChecklist.mockReturnValue(
      mockReturn({ items: [OUTSTANDING_ITEM], outstanding: 1 }),
    );
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);

    const item = screen.getByTestId('checklist-item-proof_of_age');
    expect(item).toBeInTheDocument();
    expect(item).toHaveTextContent('Proof of Age');
    // FileUpload compact mode renders an upload button
    expect(screen.getByTestId('upload-btn-proof_of_age')).toBeInTheDocument();
  });

  it('renders received item with checkmark and filename', () => {
    mockUseDocumentChecklist.mockReturnValue(mockReturn({ items: [RECEIVED_ITEM], received: 1 }));
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);

    const item = screen.getByTestId('checklist-item-direct_deposit_form');
    expect(item).toBeInTheDocument();
    expect(item).toHaveTextContent('Direct Deposit Authorization');
    expect(item).toHaveTextContent('direct_deposit.pdf');
    expect(item).toHaveTextContent('✓');
  });

  it('shows accepted formats on outstanding items', () => {
    mockUseDocumentChecklist.mockReturnValue(
      mockReturn({ items: [OUTSTANDING_ITEM], outstanding: 1 }),
    );
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);

    const item = screen.getByTestId('checklist-item-proof_of_age');
    expect(item).toHaveTextContent('PDF, JPG, PNG');
    expect(item).toHaveTextContent('Max 10MB');
  });

  it('shows only received section when all docs are uploaded', () => {
    mockUseDocumentChecklist.mockReturnValue(
      mockReturn({ items: [RECEIVED_ITEM], outstanding: 0, received: 1 }),
    );
    renderWithProviders(<DocumentChecklist {...DEFAULT_PROPS} />);

    expect(screen.queryByTestId('outstanding-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('received-section')).toBeInTheDocument();
  });
});
