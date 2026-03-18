import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import DocumentArchive from '../DocumentArchive';
import type { DocumentUpload } from '@/types/MemberPortal';

// ── Test Data ────────────────────────────────────────────────────────────────

const UPLOADED_DOC: DocumentUpload = {
  id: 'doc-001',
  document_type: 'proof_of_age',
  filename: 'birth_cert.pdf',
  status: 'received',
  uploaded_at: '2026-03-15T10:00:00Z',
};

const PLAN_DOC: DocumentUpload = {
  id: 'doc-002',
  document_type: '1099_r',
  filename: '1099-R-2025.pdf',
  status: 'received',
  uploaded_at: '2026-01-31T12:00:00Z',
  context: 'plan_generated',
};

const DRO_DOC: DocumentUpload = {
  id: 'doc-003',
  document_type: 'dro_court_order',
  filename: 'dro_order_2024.pdf',
  status: 'received',
  uploaded_at: '2024-06-01T09:00:00Z',
};

const ALL_DOCS = [UPLOADED_DOC, PLAN_DOC, DRO_DOC];

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockList = vi.fn<(id: number) => Promise<DocumentUpload[]>>();
const mockDownload = vi.fn();

vi.mock('@/lib/memberPortalApi', () => ({
  documentAPI: {
    list: (...args: unknown[]) => mockList(...(args as [number])),
    download: (...args: unknown[]) => mockDownload(...args),
  },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DocumentArchive', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockDownload.mockReset();
  });

  it('shows loading state', () => {
    mockList.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<DocumentArchive memberId="10001" />);
    expect(screen.getByTestId('archive-loading')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    mockList.mockRejectedValue(new Error('network fail'));
    renderWithProviders(<DocumentArchive memberId="10001" />);
    await waitFor(() => {
      expect(screen.getByTestId('archive-error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no documents', async () => {
    mockList.mockResolvedValue([]);
    renderWithProviders(<DocumentArchive memberId="10001" />);
    await waitFor(() => {
      expect(screen.getByTestId('archive-empty')).toBeInTheDocument();
    });
  });

  it('renders documents grouped into categories', async () => {
    mockList.mockResolvedValue(ALL_DOCS);
    renderWithProviders(<DocumentArchive memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByTestId('document-archive')).toBeInTheDocument();
    });

    // Uploaded by member
    expect(screen.getByTestId('archive-group-uploaded')).toBeInTheDocument();
    expect(screen.getByTestId('archive-row-doc-001')).toHaveTextContent('birth_cert.pdf');

    // From plan
    expect(screen.getByTestId('archive-group-from_plan')).toBeInTheDocument();
    expect(screen.getByTestId('archive-row-doc-002')).toHaveTextContent('1099-R-2025.pdf');

    // DRO
    expect(screen.getByTestId('archive-group-dro')).toBeInTheDocument();
    expect(screen.getByTestId('archive-row-doc-003')).toHaveTextContent('dro_order_2024.pdf');
  });

  it('shows Download button for regular documents', async () => {
    mockList.mockResolvedValue([UPLOADED_DOC]);
    renderWithProviders(<DocumentArchive memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByTestId('download-doc-001')).toBeInTheDocument();
    });
    expect(screen.getByTestId('download-doc-001')).toHaveTextContent('Download');
  });

  it('shows Request Copy button for DRO documents (security rule)', async () => {
    mockList.mockResolvedValue([DRO_DOC]);
    renderWithProviders(<DocumentArchive memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByTestId('request-copy-doc-003')).toBeInTheDocument();
    });
    expect(screen.getByTestId('request-copy-doc-003')).toHaveTextContent('Request Copy');
    // No download button for DRO
    expect(screen.queryByTestId('download-doc-003')).not.toBeInTheDocument();
  });

  it('calls download API and opens URL when download clicked', async () => {
    mockList.mockResolvedValue([UPLOADED_DOC]);
    mockDownload.mockResolvedValue({ download_url: 'https://ecm.example.com/file/123' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithProviders(<DocumentArchive memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByTestId('download-doc-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('download-doc-001'));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith('doc-001');
    });
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('https://ecm.example.com/file/123', '_blank');
    });

    openSpy.mockRestore();
  });

  it('filters by document type', async () => {
    mockList.mockResolvedValue(ALL_DOCS);
    renderWithProviders(<DocumentArchive memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByTestId('document-archive')).toBeInTheDocument();
    });

    // Initially shows all 3
    expect(screen.getByTestId('archive-row-doc-001')).toBeInTheDocument();
    expect(screen.getByTestId('archive-row-doc-002')).toBeInTheDocument();
    expect(screen.getByTestId('archive-row-doc-003')).toBeInTheDocument();

    // Filter to proof_of_age
    fireEvent.change(screen.getByTestId('archive-type-filter'), {
      target: { value: 'proof_of_age' },
    });

    expect(screen.getByTestId('archive-row-doc-001')).toBeInTheDocument();
    expect(screen.queryByTestId('archive-row-doc-002')).not.toBeInTheDocument();
    expect(screen.queryByTestId('archive-row-doc-003')).not.toBeInTheDocument();
  });

  it('shows status badges', async () => {
    mockList.mockResolvedValue([UPLOADED_DOC]);
    renderWithProviders(<DocumentArchive memberId="10001" />);

    await waitFor(() => {
      expect(screen.getByTestId('status-doc-001')).toHaveTextContent('received');
    });
  });
});
