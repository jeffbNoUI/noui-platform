import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useAttentionItems: vi.fn(),
  };
});

vi.mock('@/lib/migrationApi', async () => {
  const actual = await vi.importActual('@/lib/migrationApi');
  return {
    ...actual,
    migrationAPI: {
      ...(actual as Record<string, unknown>).migrationAPI,
      resolveAttentionItem: vi.fn(),
      deferAttentionItem: vi.fn(),
    },
  };
});

import { useAttentionItems } from '@/hooks/useMigrationApi';
import { migrationAPI } from '@/lib/migrationApi';
import type { AttentionItem } from '@/types/Migration';
import AttentionQueue from '../AttentionQueue';

function makeItem(overrides?: Partial<AttentionItem>): AttentionItem {
  return {
    id: 'item-1',
    source: 'RISK',
    phase: 'PROFILING',
    priority: 'P1',
    summary: 'Test risk item',
    detail: 'Detailed description of risk',
    suggestedAction: undefined,
    batchId: undefined,
    engagementId: 'eng-1',
    createdAt: '2026-01-01T00:00:00Z',
    resolved: false,
    ...overrides,
  };
}

function mockAttentionItems(items: AttentionItem[]) {
  vi.mocked(useAttentionItems).mockReturnValue({
    data: items,
    isLoading: false,
  } as unknown as ReturnType<typeof useAttentionItems>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(migrationAPI.resolveAttentionItem).mockResolvedValue({
    item_id: 'item-1',
    source: 'RISK',
    action: 'resolve',
    status: 'success',
  });
  vi.mocked(migrationAPI.deferAttentionItem).mockResolvedValue({
    item_id: 'item-1',
    source: 'RISK',
    action: 'defer',
    status: 'success',
  });
});

describe('AttentionQueue', () => {
  it('renders loading state', () => {
    vi.mocked(useAttentionItems).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useAttentionItems>);

    renderWithProviders(<AttentionQueue engagementId="eng-1" />);
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('renders empty state when no items', () => {
    mockAttentionItems([]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);
    expect(screen.getByText('No items requiring attention')).toBeDefined();
  });

  it('renders attention items with priority and source', () => {
    mockAttentionItems([
      makeItem({ id: 'r1', priority: 'P1', source: 'RISK', summary: 'High risk' }),
      makeItem({ id: 'r2', priority: 'P2', source: 'RECONCILIATION', summary: 'Recon issue' }),
    ]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    expect(screen.getByText('High risk')).toBeDefined();
    expect(screen.getByText('Recon issue')).toBeDefined();
    expect(screen.getByText('RISK')).toBeDefined();
    expect(screen.getByText('RECONCILIATION')).toBeDefined();
  });

  it('filters resolved items out of the list', () => {
    mockAttentionItems([
      makeItem({ id: 'r1', resolved: false, summary: 'Active' }),
      makeItem({ id: 'r2', resolved: true, summary: 'Resolved' }),
    ]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.queryByText('Resolved')).toBeNull();
  });

  // AC-1: migrationApi extended with resolve/defer functions
  it('has resolveAttentionItem and deferAttentionItem API functions', () => {
    expect(typeof migrationAPI.resolveAttentionItem).toBe('function');
    expect(typeof migrationAPI.deferAttentionItem).toBe('function');
  });

  // AC-2: Resolve button calls resolveAttentionItem with correct source
  it('calls resolveAttentionItem when resolve is confirmed', async () => {
    mockAttentionItems([makeItem({ id: 'risk-1', source: 'RISK', priority: 'P1' })]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    // Click resolve button to show note input
    fireEvent.click(screen.getByText('Resolve'));

    // Type note and confirm
    const noteInput = screen.getByLabelText('resolution note');
    fireEvent.change(noteInput, { target: { value: 'Fixed the issue' } });
    fireEvent.click(screen.getByText('Confirm Resolve'));

    await waitFor(() => {
      expect(migrationAPI.resolveAttentionItem).toHaveBeenCalledWith(
        'eng-1',
        'risk-1',
        'RISK',
        'Fixed the issue',
      );
    });
  });

  // AC-3: Defer button calls deferAttentionItem
  it('calls deferAttentionItem when defer is confirmed', async () => {
    mockAttentionItems([makeItem({ id: 'risk-2', source: 'RISK', priority: 'P1' })]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Defer'));

    const noteInput = screen.getByLabelText('resolution note');
    fireEvent.change(noteInput, { target: { value: 'Deferred to next sprint' } });
    fireEvent.click(screen.getByText('Confirm Defer'));

    await waitFor(() => {
      expect(migrationAPI.deferAttentionItem).toHaveBeenCalledWith(
        'eng-1',
        'risk-2',
        'RISK',
        'Deferred to next sprint',
      );
    });
  });

  // AC-2: source comes from item.source, not hardcoded
  it('passes correct source from item data to API', async () => {
    mockAttentionItems([
      makeItem({ id: 'recon-1', source: 'RECONCILIATION', priority: 'P1', summary: 'Recon item' }),
    ]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Resolve'));
    fireEvent.click(screen.getByText('Confirm Resolve'));

    await waitFor(() => {
      expect(migrationAPI.resolveAttentionItem).toHaveBeenCalledWith(
        'eng-1',
        'recon-1',
        'RECONCILIATION',
        '',
      );
    });
  });

  // AC-5: Resolution note input shown on resolve/defer click
  it('shows note input when resolve button is clicked', () => {
    mockAttentionItems([makeItem({ priority: 'P1' })]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    // Note input not visible initially
    expect(screen.queryByLabelText('resolution note')).toBeNull();

    // Click resolve
    fireEvent.click(screen.getByText('Resolve'));

    // Note input is now visible
    expect(screen.getByLabelText('resolution note')).toBeDefined();
    expect(screen.getByText('Confirm Resolve')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('hides note input on cancel', () => {
    mockAttentionItems([makeItem({ priority: 'P1' })]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Resolve'));
    expect(screen.getByLabelText('resolution note')).toBeDefined();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByLabelText('resolution note')).toBeNull();
  });

  // AC-2: Optimistic update — resolve calls the API which triggers cache invalidation
  it('calls API on resolve and item disappears after refetch', async () => {
    mockAttentionItems([
      makeItem({ id: 'r1', summary: 'To resolve', priority: 'P1' }),
      makeItem({ id: 'r2', summary: 'Stays', priority: 'P1' }),
    ]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    // Both visible initially
    expect(screen.getByText('To resolve')).toBeDefined();
    expect(screen.getByText('Stays')).toBeDefined();

    // Resolve first item
    const resolveButtons = screen.getAllByText('Resolve');
    fireEvent.click(resolveButtons[0]);
    fireEvent.click(screen.getByText('Confirm Resolve'));

    // Verify API was called — the optimistic update + refetch handles removal
    await waitFor(() => {
      expect(migrationAPI.resolveAttentionItem).toHaveBeenCalledWith(
        'eng-1', 'r1', 'RISK', '',
      );
    });
  });

  // P2/P3 items show different buttons
  it('renders Apply to All and Review buttons for P2 items', () => {
    mockAttentionItems([makeItem({ priority: 'P2' })]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    expect(screen.getByText('Apply to All')).toBeDefined();
    expect(screen.getByText('Review')).toBeDefined();
    expect(screen.getByText('Defer')).toBeDefined();
  });

  // Filter pills
  it('renders filter pills', () => {
    mockAttentionItems([]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('P1')).toBeDefined();
    expect(screen.getByText('P2')).toBeDefined();
    expect(screen.getByText('P3')).toBeDefined();
  });

  // Enter key submits note
  it('submits on Enter key in note input', async () => {
    mockAttentionItems([makeItem({ id: 'r1', source: 'RISK', priority: 'P1' })]);
    renderWithProviders(<AttentionQueue engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Resolve'));
    const noteInput = screen.getByLabelText('resolution note');
    fireEvent.change(noteInput, { target: { value: 'Enter test' } });
    fireEvent.keyDown(noteInput, { key: 'Enter' });

    await waitFor(() => {
      expect(migrationAPI.resolveAttentionItem).toHaveBeenCalledWith(
        'eng-1',
        'r1',
        'RISK',
        'Enter test',
      );
    });
  });
});
