import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import TaxDocumentsTab from '../TaxDocumentsTab';
import type { TaxDocument } from '@/types/MemberPortal';

// ── Test Data ───────────────────────────────────────────────────────────────

const MOCK_TAX_DOCS: TaxDocument[] = [
  {
    id: 'td-1',
    tax_year: 2025,
    document_type: '1099-R',
    available: true,
    download_url: '/api/v1/documents/td-1/download',
  },
  {
    id: 'td-2',
    tax_year: 2024,
    document_type: '1099-R',
    available: true,
    download_url: '/api/v1/documents/td-2/download',
  },
  {
    id: 'td-3',
    tax_year: 2026,
    document_type: '1099-R',
    available: false,
  },
];

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockUseTaxDocuments = vi.fn();
vi.mock('@/hooks/usePayments', () => ({
  useTaxDocuments: (...args: unknown[]) => mockUseTaxDocuments(...args),
}));

const mockCreateChangeRequest = vi.fn().mockResolvedValue({});
vi.mock('@/lib/memberPortalApi', () => ({
  changeRequestAPI: { create: (...args: unknown[]) => mockCreateChangeRequest(...args) },
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('TaxDocumentsTab', () => {
  beforeEach(() => {
    mockCreateChangeRequest.mockClear();
  });

  it('shows loading state', () => {
    mockUseTaxDocuments.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    expect(screen.getByText(/loading tax documents/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseTaxDocuments.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
    });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    expect(screen.getByText(/unable to load/i)).toBeInTheDocument();
  });

  it('shows empty state when no documents', () => {
    mockUseTaxDocuments.mockReturnValue({ data: [], isLoading: false, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    expect(screen.getByTestId('no-tax-documents')).toBeInTheDocument();
  });

  it('renders tax documents sorted by year descending', () => {
    mockUseTaxDocuments.mockReturnValue({ data: MOCK_TAX_DOCS, isLoading: false, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    const docs = screen.getAllByTestId(/^tax-doc-/);
    expect(docs[0]).toHaveAttribute('data-testid', 'tax-doc-2026');
    expect(docs[1]).toHaveAttribute('data-testid', 'tax-doc-2025');
    expect(docs[2]).toHaveAttribute('data-testid', 'tax-doc-2024');
  });

  it('shows download link for available documents', () => {
    mockUseTaxDocuments.mockReturnValue({ data: MOCK_TAX_DOCS, isLoading: false, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    expect(screen.getByTestId('download-2025')).toBeInTheDocument();
    expect(screen.getByTestId('download-2024')).toBeInTheDocument();
  });

  it('does not show download for unavailable documents', () => {
    mockUseTaxDocuments.mockReturnValue({ data: MOCK_TAX_DOCS, isLoading: false, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    expect(screen.queryByTestId('download-2026')).not.toBeInTheDocument();
  });

  it('shows "not yet available" message for pending documents', () => {
    mockUseTaxDocuments.mockReturnValue({ data: MOCK_TAX_DOCS, isLoading: false, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    expect(screen.getByText(/not yet available/i)).toBeInTheDocument();
  });

  it('shows request paper copy button for available documents', () => {
    mockUseTaxDocuments.mockReturnValue({ data: MOCK_TAX_DOCS, isLoading: false, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    expect(screen.getByTestId('request-paper-2025')).toBeInTheDocument();
    expect(screen.getByTestId('request-paper-2024')).toBeInTheDocument();
  });

  it('sends paper copy request and shows "Requested" after click', async () => {
    mockUseTaxDocuments.mockReturnValue({ data: MOCK_TAX_DOCS, isLoading: false, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);

    fireEvent.click(screen.getByTestId('request-paper-2025'));

    await waitFor(() => {
      expect(mockCreateChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          member_id: 10001,
          field_name: 'paper_1099r',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('request-paper-2025')).toHaveTextContent('Requested');
    });
  });

  it('shows section heading and description', () => {
    mockUseTaxDocuments.mockReturnValue({ data: MOCK_TAX_DOCS, isLoading: false, error: null });
    renderWithProviders(<TaxDocumentsTab memberId={10001} />);
    expect(screen.getByText('1099-R Tax Forms')).toBeInTheDocument();
    expect(screen.getByText(/forms are typically available/i)).toBeInTheDocument();
  });
});
