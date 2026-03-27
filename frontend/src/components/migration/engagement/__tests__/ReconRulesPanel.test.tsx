import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useReconRuleSets: vi.fn(),
    useCreateReconRuleSet: vi.fn(),
    useUpdateReconRuleSet: vi.fn(),
    useActivateReconRuleSet: vi.fn(),
    useArchiveReconRuleSet: vi.fn(),
    useReconRuleSetDiff: vi.fn(),
  };
});

import {
  useReconRuleSets,
  useCreateReconRuleSet,
  useUpdateReconRuleSet,
  useActivateReconRuleSet,
  useArchiveReconRuleSet,
  useReconRuleSetDiff,
} from '@/hooks/useMigrationApi';

import type { ReconRuleSet } from '@/types/Migration';
import ReconRulesPanel from '../ReconRulesPanel';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRuleSet(overrides?: Partial<ReconRuleSet>): ReconRuleSet {
  return {
    ruleset_id: 'rs-001',
    engagement_id: 'eng-1',
    version: 1,
    label: 'Initial rules',
    status: 'DRAFT',
    rules: [
      {
        rule_id: '1_monthly_benefit',
        tier: 1,
        calc_name: 'monthly_benefit',
        comparison_type: 'TOLERANCE_ABS',
        tolerance_value: '0.01',
        priority_if_mismatch: 'P1',
        enabled: true,
      },
    ],
    created_by: 'user-1',
    created_at: '2026-03-26T10:00:00Z',
    activated_at: null,
    superseded_at: null,
    ...overrides,
  };
}

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockActivateMutate = vi.fn();
const mockArchiveMutate = vi.fn();

function setupDefaultMocks(ruleSets: ReconRuleSet[] = []) {
  vi.mocked(useReconRuleSets).mockReturnValue({
    data: ruleSets,
    isLoading: false,
  } as ReturnType<typeof useReconRuleSets>);

  vi.mocked(useCreateReconRuleSet).mockReturnValue({
    mutate: mockCreateMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateReconRuleSet>);

  vi.mocked(useUpdateReconRuleSet).mockReturnValue({
    mutate: mockUpdateMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateReconRuleSet>);

  vi.mocked(useActivateReconRuleSet).mockReturnValue({
    mutate: mockActivateMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useActivateReconRuleSet>);

  vi.mocked(useArchiveReconRuleSet).mockReturnValue({
    mutate: mockArchiveMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useArchiveReconRuleSet>);

  vi.mocked(useReconRuleSetDiff).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as ReturnType<typeof useReconRuleSetDiff>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReconRulesPanel', () => {
  it('shows empty state when no rule sets exist', () => {
    setupDefaultMocks([]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);
    expect(screen.getByText(/No rule sets defined yet/)).toBeTruthy();
  });

  it('shows loading state', () => {
    vi.mocked(useReconRuleSets).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useReconRuleSets>);
    vi.mocked(useCreateReconRuleSet).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateReconRuleSet>);
    vi.mocked(useUpdateReconRuleSet).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateReconRuleSet>);
    vi.mocked(useActivateReconRuleSet).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useActivateReconRuleSet>);
    vi.mocked(useArchiveReconRuleSet).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useArchiveReconRuleSet>);
    vi.mocked(useReconRuleSetDiff).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useReconRuleSetDiff>);

    const { container } = renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders version list table with correct columns', () => {
    const draftSet = makeRuleSet();
    const activeSet = makeRuleSet({
      ruleset_id: 'rs-002',
      version: 2,
      label: 'v2 rules',
      status: 'ACTIVE',
      activated_at: '2026-03-26T12:00:00Z',
    });
    setupDefaultMocks([draftSet, activeSet]);

    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    expect(screen.getByText('v1')).toBeTruthy();
    expect(screen.getByText('v2')).toBeTruthy();
    expect(screen.getByText('Initial rules')).toBeTruthy();
    expect(screen.getByText('v2 rules')).toBeTruthy();
  });

  it('shows DRAFT status badge with correct color (#3B82F6)', () => {
    setupDefaultMocks([makeRuleSet()]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    const badge = screen.getByText('DRAFT');
    expect(badge.style.color).toBe('rgb(59, 130, 246)'); // #3B82F6
  });

  it('shows ACTIVE status badge with correct color (#10B981)', () => {
    setupDefaultMocks([makeRuleSet({ status: 'ACTIVE' })]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    const badge = screen.getByText('ACTIVE');
    expect(badge.style.color).toBe('rgb(16, 185, 129)'); // #10B981
  });

  it('shows SUPERSEDED status badge with correct color (#6B7280)', () => {
    setupDefaultMocks([makeRuleSet({ status: 'SUPERSEDED' })]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    const badge = screen.getByText('SUPERSEDED');
    expect(badge.style.color).toBe('rgb(107, 114, 128)'); // #6B7280
  });

  it('shows ARCHIVED status badge with correct color (#D1D5DB)', () => {
    setupDefaultMocks([makeRuleSet({ status: 'ARCHIVED' })]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    const badge = screen.getByText('ARCHIVED');
    expect(badge.style.color).toBe('rgb(209, 213, 219)'); // #D1D5DB
  });

  it('shows rule count in version list', () => {
    setupDefaultMocks([
      makeRuleSet({
        rules: [
          {
            rule_id: '1_a',
            tier: 1,
            calc_name: 'a',
            comparison_type: 'EXACT',
            tolerance_value: '0',
            priority_if_mismatch: 'P1',
            enabled: true,
          },
          {
            rule_id: '2_b',
            tier: 2,
            calc_name: 'b',
            comparison_type: 'EXACT',
            tolerance_value: '0',
            priority_if_mismatch: 'P2',
            enabled: true,
          },
        ],
      }),
    ]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);
    // The rule count column should show "2"
    const cells = screen.getAllByText('2');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Edit and Activate buttons only for DRAFT versions', () => {
    setupDefaultMocks([
      makeRuleSet({ status: 'DRAFT', ruleset_id: 'rs-draft' }),
      makeRuleSet({ status: 'ACTIVE', ruleset_id: 'rs-active', version: 2 }),
    ]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons).toHaveLength(1);
    const activateButtons = screen.getAllByText('Activate');
    expect(activateButtons).toHaveLength(1);
  });

  it('shows Archive button only for SUPERSEDED versions', () => {
    setupDefaultMocks([
      makeRuleSet({ status: 'SUPERSEDED', ruleset_id: 'rs-sup' }),
      makeRuleSet({ status: 'ACTIVE', ruleset_id: 'rs-active', version: 2 }),
    ]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    const archiveButtons = screen.getAllByText('Archive');
    expect(archiveButtons).toHaveLength(1);
  });

  it('opens create dialog when Create New Version is clicked', () => {
    setupDefaultMocks([]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Create New Version'));
    expect(screen.getByText('Create New Rule Set')).toBeTruthy();
    expect(screen.getByPlaceholderText(/adjusted tier 2/i)).toBeTruthy();
  });

  it('opens edit dialog when Edit button is clicked', () => {
    setupDefaultMocks([makeRuleSet()]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Rule Set')).toBeTruthy();
    // Should populate with existing data
    expect(screen.getByDisplayValue('Initial rules')).toBeTruthy();
  });

  it('shows activation confirmation dialog with supersession warning', () => {
    setupDefaultMocks([makeRuleSet()]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Activate'));
    expect(screen.getByText('Activate Rule Set?')).toBeTruthy();
    expect(screen.getByText(/supersede the current active version/)).toBeTruthy();
    expect(screen.getByText('Confirm Activate')).toBeTruthy();
  });

  it('calls activate mutation on confirm', () => {
    setupDefaultMocks([makeRuleSet()]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Activate'));
    fireEvent.click(screen.getByText('Confirm Activate'));

    expect(mockActivateMutate).toHaveBeenCalledWith(
      { engagementId: 'eng-1', rulesetId: 'rs-001' },
      expect.any(Object),
    );
  });

  it('validates that rules array is non-empty', () => {
    setupDefaultMocks([]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Create New Version'));
    // Remove the default rule
    const removeBtn = screen.getByTitle('Remove rule');
    fireEvent.click(removeBtn);

    // Fill label
    const labelInput = screen.getByPlaceholderText(/adjusted tier 2/i);
    fireEvent.change(labelInput, { target: { value: 'Test label' } });

    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText(/At least one rule is required/)).toBeTruthy();
  });

  it('validates tolerance_value is a valid decimal string', () => {
    setupDefaultMocks([]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Create New Version'));

    const labelInput = screen.getByPlaceholderText(/adjusted tier 2/i);
    fireEvent.change(labelInput, { target: { value: 'Test' } });

    // Fill calc_name
    const calcInput = screen.getByPlaceholderText('monthly_benefit');
    fireEvent.change(calcInput, { target: { value: 'test_calc' } });

    // Set invalid tolerance
    const tolInput = screen.getByDisplayValue('0.01');
    fireEvent.change(tolInput, { target: { value: 'abc' } });

    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText(/Invalid tolerance value/)).toBeTruthy();
  });

  it('validates no duplicate tier_calc_name combinations', () => {
    setupDefaultMocks([]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Create New Version'));

    const labelInput = screen.getByPlaceholderText(/adjusted tier 2/i);
    fireEvent.change(labelInput, { target: { value: 'Test' } });

    // Fill first rule
    const calcInput = screen.getByPlaceholderText('monthly_benefit');
    fireEvent.change(calcInput, { target: { value: 'test_calc' } });

    // Add second rule with same tier + calc_name
    fireEvent.click(screen.getByText('+ Add Rule'));
    const calcInputs = screen.getAllByPlaceholderText('monthly_benefit');
    fireEvent.change(calcInputs[1], { target: { value: 'test_calc' } });

    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText(/Duplicate rule/)).toBeTruthy();
  });

  it('calls create mutation with correct payload on valid submit', () => {
    setupDefaultMocks([]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Create New Version'));

    const labelInput = screen.getByPlaceholderText(/adjusted tier 2/i);
    fireEvent.change(labelInput, { target: { value: 'My rules' } });

    const calcInput = screen.getByPlaceholderText('monthly_benefit');
    fireEvent.change(calcInput, { target: { value: 'monthly_benefit' } });

    fireEvent.click(screen.getByText('Create'));

    expect(mockCreateMutate).toHaveBeenCalledWith(
      {
        engagementId: 'eng-1',
        req: {
          label: 'My rules',
          rules: [
            {
              tier: 1,
              calc_name: 'monthly_benefit',
              comparison_type: 'TOLERANCE_ABS',
              tolerance_value: '0.01',
              priority_if_mismatch: 'P2',
              enabled: true,
            },
          ],
        },
      },
      expect.any(Object),
    );
  });

  it('calls archive mutation when Archive button is clicked', () => {
    setupDefaultMocks([makeRuleSet({ status: 'SUPERSEDED' })]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Archive'));
    expect(mockArchiveMutate).toHaveBeenCalledWith(
      { engagementId: 'eng-1', rulesetId: 'rs-001' },
      expect.any(Object),
    );
  });

  it('opens diff viewer when Compare Versions is clicked', () => {
    setupDefaultMocks([
      makeRuleSet({ version: 1, ruleset_id: 'rs-1' }),
      makeRuleSet({ version: 2, ruleset_id: 'rs-2', label: 'v2 rules', status: 'ACTIVE' }),
    ]);
    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByText('Compare Versions'));
    expect(screen.getByText('Version Diff')).toBeTruthy();
    // Should have two "From"/"To" selects
    expect(screen.getByText('From')).toBeTruthy();
    expect(screen.getByText('To')).toBeTruthy();
  });

  it('renders diff items when diff data is present', () => {
    setupDefaultMocks([
      makeRuleSet({ version: 1, ruleset_id: 'rs-1' }),
      makeRuleSet({ version: 2, ruleset_id: 'rs-2', label: 'v2', status: 'ACTIVE' }),
    ]);

    vi.mocked(useReconRuleSetDiff).mockReturnValue({
      data: {
        from_version: 1,
        to_version: 2,
        added: [],
        removed: [],
        modified: [
          {
            rule_id: '1_monthly_benefit',
            change: 'modified',
            fields: {
              tolerance_value: { old: '0.01', new: '0.02' },
            },
          },
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useReconRuleSetDiff>);

    renderWithProviders(<ReconRulesPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByText('Compare Versions'));

    // Select versions to trigger diff
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'rs-1' } });
    fireEvent.change(selects[1], { target: { value: 'rs-2' } });

    // Diff should show modified item
    expect(screen.getByText('Modified')).toBeTruthy();
    expect(screen.getByText('1_monthly_benefit')).toBeTruthy();
  });
});
