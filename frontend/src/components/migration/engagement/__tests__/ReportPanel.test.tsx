import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent, waitFor } from '@testing-library/react';

// Mock hooks
vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useGenerateReport: vi.fn(),
    useReportStatus: vi.fn(),
    useReports: vi.fn(),
    useRetentionPolicy: vi.fn(),
    useSetRetentionPolicy: vi.fn(),
    useDownloadReportUrl: vi.fn(),
  };
});

import {
  useGenerateReport,
  useReportStatus,
  useReports,
  useRetentionPolicy,
  useSetRetentionPolicy,
  useDownloadReportUrl,
} from '@/hooks/useMigrationApi';
import type { MigrationReport, RetentionPolicy } from '@/types/Migration';
import ReportPanel from '../ReportPanel';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeReport(overrides?: Partial<MigrationReport>): MigrationReport {
  return {
    report_id: 'rpt-001',
    engagement_id: 'eng-1',
    report_type: 'lineage_traceability',
    status: 'COMPLETED',
    generated_at: '2026-03-26T10:00:00Z',
    error_message: null,
    created_at: '2026-03-26T09:55:00Z',
    ...overrides,
  };
}

const POLICY: RetentionPolicy = {
  engagement_id: 'eng-1',
  event_retention_days: 730,
  audit_retention_days: 1095,
  updated_at: '2026-03-01T00:00:00Z',
};

const mockGenerateMutate = vi.fn();
const mockSetRetentionMutate = vi.fn();

function mockDefaults() {
  vi.mocked(useGenerateReport).mockReturnValue({
    mutate: mockGenerateMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useGenerateReport>);

  vi.mocked(useReportStatus).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useReportStatus>);

  vi.mocked(useReports).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useReports>);

  vi.mocked(useRetentionPolicy).mockReturnValue({
    data: POLICY,
    isLoading: false,
  } as unknown as ReturnType<typeof useRetentionPolicy>);

  vi.mocked(useSetRetentionPolicy).mockReturnValue({
    mutate: mockSetRetentionMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useSetRetentionPolicy>);

  vi.mocked(useDownloadReportUrl).mockReturnValue(
    '/api/v1/migration/engagements/eng-1/reports/rpt-001/download',
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDefaults();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReportPanel', () => {
  describe('report types', () => {
    it('renders both report type cards with descriptions', () => {
      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      expect(screen.getByTestId('report-card-lineage_traceability')).toBeDefined();
      expect(screen.getByTestId('report-card-reconciliation_summary')).toBeDefined();
      expect(screen.getByText('Lineage Traceability Report')).toBeDefined();
      expect(screen.getByText('Reconciliation Summary Report')).toBeDefined();
    });

    it('shows generate button for each report type', () => {
      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      expect(screen.getByTestId('generate-btn-lineage_traceability')).toBeDefined();
      expect(screen.getByTestId('generate-btn-reconciliation_summary')).toBeDefined();
    });
  });

  describe('report generation', () => {
    it('calls generateReport mutation when Generate button is clicked', () => {
      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('generate-btn-lineage_traceability'));

      expect(mockGenerateMutate).toHaveBeenCalledWith(
        { engagementId: 'eng-1', reportType: 'lineage_traceability' },
        expect.any(Object),
      );
    });

    it('disables generate button while generating', () => {
      vi.mocked(useGenerateReport).mockReturnValue({
        mutate: mockGenerateMutate,
        isPending: true,
      } as unknown as ReturnType<typeof useGenerateReport>);

      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      const btn = screen.getByTestId('generate-btn-lineage_traceability') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('Generating');
    });

    it('shows status badge when report status is available', () => {
      vi.mocked(useReportStatus).mockReturnValue({
        data: makeReport({ status: 'GENERATING' }),
        isLoading: false,
      } as unknown as ReturnType<typeof useReportStatus>);

      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      // Status badges should appear
      const badges = screen.getAllByText(/generating/i);
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('shows Preview and Download buttons when report is completed', () => {
      vi.mocked(useReportStatus).mockReturnValue({
        data: makeReport({ status: 'COMPLETED' }),
        isLoading: false,
      } as unknown as ReturnType<typeof useReportStatus>);

      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      expect(screen.getAllByTestId('report-preview-btn').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByTestId('report-download-btn').length).toBeGreaterThanOrEqual(1);
    });

    it('shows error message when report generation fails', () => {
      vi.mocked(useReportStatus).mockReturnValue({
        data: makeReport({ status: 'FAILED', error_message: 'Timeout exceeded' }),
        isLoading: false,
      } as unknown as ReturnType<typeof useReportStatus>);

      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      // Both report cards share the same mock, so error appears twice
      expect(screen.getAllByText('Timeout exceeded').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('report history', () => {
    it('renders report history table with previously generated reports', () => {
      vi.mocked(useReports).mockReturnValue({
        data: [
          makeReport({
            report_id: 'rpt-1',
            report_type: 'lineage_traceability',
            status: 'COMPLETED',
          }),
          makeReport({
            report_id: 'rpt-2',
            report_type: 'reconciliation_summary',
            status: 'FAILED',
          }),
        ],
        isLoading: false,
      } as unknown as ReturnType<typeof useReports>);

      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      expect(screen.getByText('Report History')).toBeDefined();
      // Names appear in both report cards and history table
      expect(screen.getAllByText('Lineage Traceability Report').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Reconciliation Summary Report').length).toBeGreaterThanOrEqual(2);
    });

    it('shows empty message when no reports exist', () => {
      vi.mocked(useReports).mockReturnValue({
        data: [],
        isLoading: false,
      } as unknown as ReturnType<typeof useReports>);

      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      expect(screen.getByText(/no reports generated yet/i)).toBeDefined();
    });
  });

  describe('retention policy', () => {
    it('displays current retention policy values', () => {
      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      expect(screen.getByTestId('retention-policy-section')).toBeDefined();
      expect(screen.getByText(/730 days/)).toBeDefined();
      expect(screen.getByText(/1095 days/)).toBeDefined();
    });

    it('opens edit form when Edit button is clicked', async () => {
      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('edit-retention-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('event-retention-input')).toBeDefined();
        expect(screen.getByTestId('audit-retention-input')).toBeDefined();
      });
    });

    it('validates minimum retention of 365 days', async () => {
      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('edit-retention-btn'));

      const eventInput = screen.getByTestId('event-retention-input') as HTMLInputElement;
      fireEvent.change(eventInput, { target: { value: '100' } });

      fireEvent.click(screen.getByTestId('save-retention-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('retention-validation-error')).toBeDefined();
        expect(screen.getByText(/minimum retention period is 365 days/i)).toBeDefined();
      });

      // Should not call mutation with invalid value
      expect(mockSetRetentionMutate).not.toHaveBeenCalled();
    });

    it('calls setRetentionPolicy mutation with valid values', async () => {
      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('edit-retention-btn'));

      const eventInput = screen.getByTestId('event-retention-input') as HTMLInputElement;
      const auditInput = screen.getByTestId('audit-retention-input') as HTMLInputElement;

      fireEvent.change(eventInput, { target: { value: '500' } });
      fireEvent.change(auditInput, { target: { value: '800' } });

      fireEvent.click(screen.getByTestId('save-retention-btn'));

      expect(mockSetRetentionMutate).toHaveBeenCalledWith(
        {
          engagementId: 'eng-1',
          req: { event_retention_days: 500, audit_retention_days: 800 },
        },
        expect.any(Object),
      );
    });
  });

  describe('download', () => {
    it('uses blob URL for report download (not inline Base64)', () => {
      vi.mocked(useReportStatus).mockReturnValue({
        data: makeReport({ status: 'COMPLETED' }),
        isLoading: false,
      } as unknown as ReturnType<typeof useReportStatus>);

      renderWithProviders(<ReportPanel engagementId="eng-1" />);

      const downloadLinks = screen.getAllByTestId('report-download-btn');
      expect(downloadLinks.length).toBeGreaterThanOrEqual(1);
      const link = downloadLinks[0] as HTMLAnchorElement;
      // Should point to an API endpoint, not a data: URL
      expect(link.href).toContain('/api/v1/migration/');
      expect(link.href).not.toContain('data:');
    });
  });
});
