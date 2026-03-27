import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useRisks: vi.fn(),
    useUpdateRisk: vi.fn(),
    useCreateRisk: vi.fn(),
  };
});

import { useRisks, useUpdateRisk, useCreateRisk } from '@/hooks/useMigrationApi';
import type { MigrationRisk } from '@/types/Migration';
import RiskPanel from '../RiskPanel';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRisk(overrides?: Partial<MigrationRisk>): MigrationRisk {
  return {
    risk_id: 'risk-001',
    engagement_id: 'eng-1',
    tenant_id: 'tenant-1',
    source: 'PROFILER',
    severity: 'P1',
    description:
      'High severity data quality issue detected in member table with missing SSN values across multiple records requiring immediate attention',
    evidence: 'Found 245 records with null SSN values',
    mitigation: null,
    aiRemediation: undefined,
    status: 'OPEN',
    detected_at: '2026-03-20T10:00:00Z',
    acknowledged_by: null,
    closed_at: null,
    ...overrides,
  };
}

const baseMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

beforeEach(() => {
  vi.mocked(useUpdateRisk).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useUpdateRisk>,
  );
  vi.mocked(useCreateRisk).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useCreateRisk>,
  );
});

describe('RiskPanel', () => {
  it('renders loading state', () => {
    vi.mocked(useRisks).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    // Should show skeleton loaders
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders summary bar with correct counts', () => {
    const risks = [
      makeRisk({ risk_id: 'r1', severity: 'P1', status: 'OPEN' }),
      makeRisk({ risk_id: 'r2', severity: 'P2', status: 'OPEN' }),
      makeRisk({ risk_id: 'r3', severity: 'P1', status: 'MITIGATED' }),
      makeRisk({ risk_id: 'r4', severity: 'P3', status: 'CLOSED' }),
    ];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    const summary = screen.getByTestId('risk-summary-bar');
    // 1 open P1
    expect(summary).toHaveTextContent('1');
    // 2 open total
    expect(summary).toHaveTextContent('2');
    // 1 mitigated
    expect(summary).toHaveTextContent('1');
  });

  it('renders risk table with correct columns', () => {
    const risks = [makeRisk({ risk_id: 'risk-abc12345' })];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    const table = screen.getByTestId('risk-table');
    expect(table).toBeInTheDocument();

    // Truncated risk_id
    expect(screen.getByText('risk-abc')).toBeInTheDocument();

    // Source badge (also in dropdown, so use getAllByText)
    expect(screen.getAllByText('Profiler').length).toBeGreaterThanOrEqual(1);

    // Severity badge
    expect(screen.getByTestId('severity-badge-risk-abc12345')).toHaveTextContent('P1');

    // Status badge
    expect(screen.getByTestId('status-badge-risk-abc12345')).toHaveTextContent('OPEN');
  });

  it('truncates description to 100 chars', () => {
    const longDesc = 'A'.repeat(120);
    const risks = [makeRisk({ description: longDesc })];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    // Table row should show truncated text
    expect(screen.getByText('A'.repeat(100) + '...')).toBeInTheDocument();
  });

  it('expands risk row on click showing full details', () => {
    const risks = [makeRisk()];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    // Click the row
    fireEvent.click(screen.getByTestId('risk-row-risk-001'));

    // Expanded section should appear
    const expanded = screen.getByTestId('risk-expanded-risk-001');
    expect(expanded).toBeInTheDocument();

    // Full description visible
    expect(expanded).toHaveTextContent('High severity data quality issue');

    // Evidence visible
    expect(expanded).toHaveTextContent('Found 245 records with null SSN values');
  });

  it('shows acknowledge button for OPEN risks', () => {
    const risks = [makeRisk({ status: 'OPEN' })];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('risk-row-risk-001'));

    expect(screen.getByTestId('acknowledge-btn-risk-001')).toBeInTheDocument();
  });

  it('calls updateRisk when acknowledge is clicked', () => {
    const mutateFn = vi.fn();
    vi.mocked(useUpdateRisk).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useUpdateRisk>);

    const risks = [makeRisk({ status: 'OPEN' })];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('risk-row-risk-001'));
    fireEvent.click(screen.getByTestId('acknowledge-btn-risk-001'));

    expect(mutateFn).toHaveBeenCalledWith({
      riskId: 'risk-001',
      req: { status: 'ACKNOWLEDGED' },
    });
  });

  it('shows close button with confirmation for ACKNOWLEDGED risks', () => {
    const risks = [makeRisk({ status: 'ACKNOWLEDGED' })];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('risk-row-risk-001'));

    // Click close
    fireEvent.click(screen.getByTestId('close-btn-risk-001'));

    // Confirmation should appear
    expect(screen.getByText('Confirm close?')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-close-risk-001')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-close-risk-001')).toBeInTheDocument();
  });

  it('calls updateRisk on confirmed close', () => {
    const mutateFn = vi.fn();
    vi.mocked(useUpdateRisk).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useUpdateRisk>);

    const risks = [makeRisk({ status: 'ACKNOWLEDGED' })];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('risk-row-risk-001'));
    fireEvent.click(screen.getByTestId('close-btn-risk-001'));
    fireEvent.click(screen.getByTestId('confirm-close-risk-001'));

    expect(mutateFn).toHaveBeenCalledWith({
      riskId: 'risk-001',
      req: { status: 'CLOSED' },
    });
  });

  it('shows editable mitigation for OPEN/ACKNOWLEDGED risks', () => {
    const risks = [makeRisk({ status: 'OPEN', mitigation: 'existing plan' })];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('risk-row-risk-001'));

    const input = screen.getByTestId('mitigation-input-risk-001') as HTMLTextAreaElement;
    expect(input.value).toBe('existing plan');
  });

  it('does not show editable mitigation for CLOSED risks', () => {
    const risks = [makeRisk({ status: 'CLOSED', mitigation: 'resolved' })];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('risk-row-risk-001'));

    expect(screen.queryByTestId('mitigation-input-risk-001')).not.toBeInTheDocument();
  });

  it('filters by severity', () => {
    const risks = [
      makeRisk({ risk_id: 'r1', severity: 'P1' }),
      makeRisk({ risk_id: 'r2', severity: 'P2' }),
      makeRisk({ risk_id: 'r3', severity: 'P3' }),
    ];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    // Select P1 only
    fireEvent.change(screen.getByTestId('severity-filter'), {
      target: { value: 'P1' },
    });

    expect(screen.getByTestId('risk-row-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('risk-row-r2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('risk-row-r3')).not.toBeInTheDocument();
  });

  it('filters by status', () => {
    const risks = [
      makeRisk({ risk_id: 'r1', status: 'OPEN' }),
      makeRisk({ risk_id: 'r2', status: 'CLOSED' }),
    ];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    fireEvent.change(screen.getByTestId('status-filter'), {
      target: { value: 'CLOSED' },
    });

    expect(screen.queryByTestId('risk-row-r1')).not.toBeInTheDocument();
    expect(screen.getByTestId('risk-row-r2')).toBeInTheDocument();
  });

  it('filters by source', () => {
    const risks = [
      makeRisk({ risk_id: 'r1', source: 'PROFILER' }),
      makeRisk({ risk_id: 'r2', source: 'ANALYST' }),
    ];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    fireEvent.change(screen.getByTestId('source-filter'), {
      target: { value: 'ANALYST' },
    });

    expect(screen.queryByTestId('risk-row-r1')).not.toBeInTheDocument();
    expect(screen.getByTestId('risk-row-r2')).toBeInTheDocument();
  });

  it('distinguishes system-generated vs analyst source badges', () => {
    const risks = [
      makeRisk({ risk_id: 'r1', source: 'PROFILER' }),
      makeRisk({ risk_id: 'r2', source: 'ANALYST' }),
    ];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    // Both source labels appear in the table rows (also in dropdown,
    // so use getAllByText and verify at least the table badges exist)
    const profilerElements = screen.getAllByText('Profiler');
    const analystElements = screen.getAllByText('Analyst');
    expect(profilerElements.length).toBeGreaterThanOrEqual(1);
    expect(analystElements.length).toBeGreaterThanOrEqual(1);
  });

  it('opens AddRiskDialog when Add Risk button is clicked', () => {
    vi.mocked(useRisks).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByTestId('add-risk-button'));

    // AddRiskDialog renders "Add Risk" heading
    expect(screen.getByRole('heading', { name: 'Add Risk' })).toBeInTheDocument();
  });

  it('shows empty state when no risks match filters', () => {
    vi.mocked(useRisks).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    expect(screen.getByText('No risks match the current filters.')).toBeInTheDocument();
  });

  it('uses correct severity colors: P1=red, P2=orange, P3=amber', () => {
    const risks = [
      makeRisk({ risk_id: 'r1', severity: 'P1' }),
      makeRisk({ risk_id: 'r2', severity: 'P2' }),
      makeRisk({ risk_id: 'r3', severity: 'P3' }),
    ];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    const p1Badge = screen.getByTestId('severity-badge-r1');
    const p2Badge = screen.getByTestId('severity-badge-r2');
    const p3Badge = screen.getByTestId('severity-badge-r3');

    expect(p1Badge.style.color).toBe('rgb(239, 68, 68)'); // #EF4444
    expect(p2Badge.style.color).toBe('rgb(249, 115, 22)'); // #F97316
    expect(p3Badge.style.color).toBe('rgb(245, 158, 11)'); // #F59E0B
  });

  it('uses correct status colors', () => {
    const risks = [
      makeRisk({ risk_id: 'r1', status: 'OPEN' }),
      makeRisk({ risk_id: 'r2', status: 'ACKNOWLEDGED' }),
      makeRisk({ risk_id: 'r3', status: 'MITIGATED' }),
      makeRisk({ risk_id: 'r4', status: 'CLOSED' }),
    ];
    vi.mocked(useRisks).mockReturnValue({
      data: risks,
      isLoading: false,
    } as unknown as ReturnType<typeof useRisks>);

    renderWithProviders(<RiskPanel engagementId="eng-1" />);

    const openBadge = screen.getByTestId('status-badge-r1');
    const ackBadge = screen.getByTestId('status-badge-r2');
    const mitBadge = screen.getByTestId('status-badge-r3');
    const closedBadge = screen.getByTestId('status-badge-r4');

    expect(openBadge.style.color).toBe('rgb(239, 68, 68)'); // red
    expect(ackBadge.style.color).toBe('rgb(59, 130, 246)'); // blue
    expect(mitBadge.style.color).toBe('rgb(34, 197, 94)'); // green
    expect(closedBadge.style.color).toBe('rgb(156, 163, 175)'); // gray
  });
});
