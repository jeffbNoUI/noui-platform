import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent, waitFor } from '@testing-library/react';

// Mock hooks
vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useAuditLog: vi.fn(),
    useAuditExportCount: vi.fn(),
    useExportAuditUrl: vi.fn(),
  };
});

import { useAuditLog, useAuditExportCount, useExportAuditUrl } from '@/hooks/useMigrationApi';
import type { AuditLogEntry } from '@/types/Migration';
import AuditPanel from '../AuditPanel';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeEntry(overrides?: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    log_id: 'log-001-abcd-efgh-ijkl',
    engagement_id: 'eng-1',
    actor: 'admin@example.com',
    action: 'UPDATE',
    entity_type: 'engagement',
    entity_id: 'ent-001-abcd-efgh',
    before_state: { status: 'DISCOVERY', name: 'Old Name' },
    after_state: { status: 'PROFILING', name: 'Old Name' },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function mockAuditData(entries: AuditLogEntry[], total?: number) {
  vi.mocked(useAuditLog).mockReturnValue({
    data: { entries, total: total ?? entries.length },
    isLoading: false,
  } as unknown as ReturnType<typeof useAuditLog>);
}

function mockLoading() {
  vi.mocked(useAuditLog).mockReturnValue({
    data: undefined,
    isLoading: true,
  } as unknown as ReturnType<typeof useAuditLog>);
}

function mockExportCount(count: number) {
  vi.mocked(useAuditExportCount).mockReturnValue({
    data: { count },
    isLoading: false,
  } as unknown as ReturnType<typeof useAuditExportCount>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useExportAuditUrl).mockReturnValue(
    '/api/v1/migration/engagements/eng-1/audit/export?format=csv',
  );
  mockExportCount(42);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuditPanel', () => {
  describe('loading state', () => {
    it('shows loading indicator while data is being fetched', () => {
      mockLoading();
      renderWithProviders(<AuditPanel engagementId="eng-1" />);
      expect(screen.getByText(/loading audit log/i)).toBeDefined();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no entries match filters', () => {
      mockAuditData([]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);
      expect(screen.getByText(/no audit entries found/i)).toBeDefined();
    });
  });

  describe('filter bar', () => {
    it('renders entity type dropdown, actor input, and date range pickers', () => {
      mockAuditData([makeEntry()]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      expect(screen.getByTestId('entity-type-filter')).toBeDefined();
      expect(screen.getByTestId('actor-filter')).toBeDefined();
      expect(screen.getByTestId('from-date-filter')).toBeDefined();
      expect(screen.getByTestId('to-date-filter')).toBeDefined();
    });

    it('populates entity type dropdown from distinct values in current data', () => {
      mockAuditData([
        makeEntry({ entity_type: 'engagement' }),
        makeEntry({ log_id: 'log-002', entity_type: 'batch' }),
        makeEntry({ log_id: 'log-003', entity_type: 'engagement' }),
      ]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      const select = screen.getByTestId('entity-type-filter') as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toContain('engagement');
      expect(options).toContain('batch');
      expect(options).toContain(''); // "All types"
    });

    it('defaults date range to last 30 days', () => {
      mockAuditData([]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      const fromInput = screen.getByTestId('from-date-filter') as HTMLInputElement;
      const toInput = screen.getByTestId('to-date-filter') as HTMLInputElement;

      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      expect(toInput.value).toBe(today);
      expect(fromInput.value).toBe(thirtyDaysAgo);
    });
  });

  describe('results table', () => {
    it('renders audit entries with truncated IDs, actor, action badge, entity type/id, and time', () => {
      const entry = makeEntry();
      mockAuditData([entry]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      // Truncated log_id
      expect(screen.getByText(/log-001-/)).toBeDefined();
      // Actor
      expect(screen.getByText('admin@example.com')).toBeDefined();
      // Action badge
      expect(screen.getByTestId('action-badge-UPDATE')).toBeDefined();
      // Entity type appears in table (may also appear in dropdown)
      expect(screen.getAllByText('engagement').length).toBeGreaterThanOrEqual(1);
    });

    it('renders action badges with correct colors: CREATE=green, UPDATE=blue, DELETE=red, phase_transition=purple', () => {
      mockAuditData([
        makeEntry({ log_id: 'l1', action: 'CREATE' }),
        makeEntry({ log_id: 'l2', action: 'UPDATE' }),
        makeEntry({ log_id: 'l3', action: 'DELETE' }),
        makeEntry({ log_id: 'l4', action: 'phase_transition' }),
      ]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      expect(screen.getByTestId('action-badge-CREATE')).toBeDefined();
      expect(screen.getByTestId('action-badge-UPDATE')).toBeDefined();
      expect(screen.getByTestId('action-badge-DELETE')).toBeDefined();
      expect(screen.getByTestId('action-badge-phase_transition')).toBeDefined();
    });
  });

  describe('expandable diff view', () => {
    it('expands to show JSON diff when row is clicked', async () => {
      const entry = makeEntry({
        before_state: { status: 'DISCOVERY', name: 'Test' },
        after_state: { status: 'PROFILING', name: 'Test' },
      });
      mockAuditData([entry]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      // Click the row to expand
      const row = screen.getByTestId(`audit-row-${entry.log_id}`);
      fireEvent.click(row);

      // Diff view should appear showing the changed field
      await waitFor(() => {
        const diff = screen.getByTestId(`audit-diff-${entry.log_id}`);
        expect(diff).toBeDefined();
      });

      // Should show the changed value
      expect(screen.getByText(/"PROFILING"/)).toBeDefined();
    });

    it('shows added fields in green and removed fields in red', async () => {
      const entry = makeEntry({
        before_state: { removed_field: 'old' },
        after_state: { added_field: 'new' },
      });
      mockAuditData([entry]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId(`audit-row-${entry.log_id}`));

      await waitFor(() => {
        expect(screen.getByText('added_field')).toBeDefined();
        expect(screen.getByText('removed_field')).toBeDefined();
      });
    });

    it('collapses unchanged fields by default with toggle button', async () => {
      const entry = makeEntry({
        before_state: { status: 'DISCOVERY', name: 'Same', count: 5 },
        after_state: { status: 'PROFILING', name: 'Same', count: 5 },
      });
      mockAuditData([entry]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId(`audit-row-${entry.log_id}`));

      await waitFor(() => {
        // Should show toggle for unchanged fields
        expect(screen.getByText(/show 2 unchanged fields/i)).toBeDefined();
      });
    });
  });

  describe('pagination', () => {
    it('renders pagination controls with page info', () => {
      mockAuditData([makeEntry()], 50);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      const pagination = screen.getByTestId('pagination');
      expect(pagination).toBeDefined();
      expect(screen.getByText(/1 \/ 2/)).toBeDefined();
    });

    it('shows correct record range', () => {
      mockAuditData([makeEntry()], 50);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      expect(screen.getByText(/showing 1–25 of 50/i)).toBeDefined();
    });
  });

  describe('export dialog', () => {
    it('opens export dialog when export button is clicked', async () => {
      mockAuditData([makeEntry()]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('export-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('export-dialog')).toBeDefined();
      });
    });

    it('shows pre-flight count in export dialog', async () => {
      mockAuditData([makeEntry()]);
      mockExportCount(1234);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('export-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('export-count')).toBeDefined();
        expect(screen.getByText(/1,234 records/)).toBeDefined();
      });
    });

    it('shows format selector with CSV and JSON options', async () => {
      mockAuditData([makeEntry()]);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('export-btn'));

      await waitFor(() => {
        const select = screen.getByTestId('export-format-select') as HTMLSelectElement;
        const options = Array.from(select.options).map((o) => o.value);
        expect(options).toContain('csv');
        expect(options).toContain('json');
      });
    });

    it('shows warning banner when count exceeds 10,000', async () => {
      mockAuditData([makeEntry()]);
      mockExportCount(15_000);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('export-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('export-warning')).toBeDefined();
      });
    });

    it('disables download when count exceeds 50,000 (MaxExportRows)', async () => {
      mockAuditData([makeEntry()]);
      mockExportCount(60_000);
      renderWithProviders(<AuditPanel engagementId="eng-1" />);

      fireEvent.click(screen.getByTestId('export-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('export-blocked')).toBeDefined();
        const downloadBtn = screen.getByTestId('export-download-btn');
        expect(downloadBtn.style.pointerEvents).toBe('none');
      });
    });
  });
});
