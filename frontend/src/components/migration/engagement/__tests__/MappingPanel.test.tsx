import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent, within } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useMappings: vi.fn(),
    useCodeMappings: vi.fn(),
    useUpdateMapping: vi.fn(),
    useGenerateMappings: vi.fn(),
    useAcknowledgeWarning: vi.fn(),
    useMappingCorpusContext: vi.fn(),
    useEngagement: vi.fn(),
  };
});

import {
  useMappings,
  useCodeMappings,
  useUpdateMapping,
  useGenerateMappings,
  useAcknowledgeWarning,
  useMappingCorpusContext,
  useEngagement,
} from '@/hooks/useMigrationApi';
import type { FieldMapping } from '@/types/Migration';

import MappingPanel from '../MappingPanel';

const baseMutation = { mutate: vi.fn(), isPending: false };

function makeMappings(overrides?: Partial<FieldMapping>[]): FieldMapping[] {
  const defaults: FieldMapping = {
    mapping_id: 'map-1',
    engagement_id: 'eng-1',
    mapping_version: 'v1',
    source_table: 'svc_credit',
    source_column: 'years_of_service',
    canonical_table: 'service_credit',
    canonical_column: 'credited_years_total',
    template_confidence: 0.9,
    signal_confidence: 0.85,
    agreement_status: 'AGREED',
    approval_status: 'PROPOSED',
    approved_by: null,
    approved_at: null,
  };
  if (!overrides) return [defaults];
  return overrides.map((o, i) => ({ ...defaults, mapping_id: `map-${i + 1}`, ...o }));
}

beforeEach(() => {
  vi.mocked(useMappings).mockReturnValue({
    data: makeMappings(),
    isLoading: false,
  } as unknown as ReturnType<typeof useMappings>);
  vi.mocked(useCodeMappings).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof useCodeMappings>);
  vi.mocked(useUpdateMapping).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useUpdateMapping>,
  );
  vi.mocked(useGenerateMappings).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useGenerateMappings>,
  );
  vi.mocked(useAcknowledgeWarning).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useAcknowledgeWarning>,
  );
  vi.mocked(useMappingCorpusContext).mockReturnValue({
    data: undefined,
  } as unknown as ReturnType<typeof useMappingCorpusContext>);
  vi.mocked(useEngagement).mockReturnValue({
    data: { contribution_model: 'standard' },
  } as unknown as ReturnType<typeof useEngagement>);
});

describe('MappingPanel — false cognate warnings', () => {
  it('shows warning badge when mapping has warnings', () => {
    vi.mocked(useMappings).mockReturnValue({
      data: makeMappings([
        {
          source_column: 'membership_service',
          warnings: [
            {
              term: 'membership_service',
              warning: 'May refer to membership status period',
              risk: 'HIGH',
            },
          ],
        },
      ]),
      isLoading: false,
    } as unknown as ReturnType<typeof useMappings>);

    renderWithProviders(<MappingPanel engagementId="eng-1" />);
    expect(screen.getByTestId('warning-badge')).toBeTruthy();
  });

  it('does not show warning badge when mapping has no warnings', () => {
    renderWithProviders(<MappingPanel engagementId="eng-1" />);
    expect(screen.queryByTestId('warning-badge')).toBeNull();
  });

  it('disables approve button when warnings are unacknowledged', () => {
    vi.mocked(useMappings).mockReturnValue({
      data: makeMappings([
        {
          source_column: 'membership_service',
          approval_status: 'PROPOSED',
          warnings: [
            {
              term: 'membership_service',
              warning: 'May refer to membership status period',
              risk: 'HIGH',
            },
          ],
        },
      ]),
      isLoading: false,
    } as unknown as ReturnType<typeof useMappings>);

    renderWithProviders(<MappingPanel engagementId="eng-1" />);
    const approveBtn = screen.getByText('Approve');
    expect(approveBtn).toBeDisabled();
  });

  it('enables approve button when warnings are acknowledged (server state)', () => {
    vi.mocked(useMappings).mockReturnValue({
      data: makeMappings([
        {
          source_column: 'membership_service',
          approval_status: 'PROPOSED',
          acknowledged: true,
          warnings: [
            {
              term: 'membership_service',
              warning: 'May refer to membership status period',
              risk: 'HIGH',
            },
          ],
        },
      ]),
      isLoading: false,
    } as unknown as ReturnType<typeof useMappings>);

    renderWithProviders(<MappingPanel engagementId="eng-1" />);

    const approveBtn = screen.getByText('Approve');
    expect(approveBtn).not.toBeDisabled();
  });

  it('shows warning details in popover', () => {
    vi.mocked(useMappings).mockReturnValue({
      data: makeMappings([
        {
          source_column: 'membership_service',
          warnings: [
            {
              term: 'membership_service',
              warning: 'May refer to membership status period',
              risk: 'HIGH',
            },
          ],
        },
      ]),
      isLoading: false,
    } as unknown as ReturnType<typeof useMappings>);

    renderWithProviders(<MappingPanel engagementId="eng-1" />);

    // Open popover
    fireEvent.click(screen.getByTestId('warning-badge'));

    const popover = screen.getByTestId('warning-popover');
    expect(within(popover).getByText('membership_service')).toBeTruthy();
    expect(within(popover).getByText('May refer to membership status period')).toBeTruthy();
    expect(within(popover).getByText('HIGH')).toBeTruthy();
  });
});

describe('MappingPanel — employer-paid badge', () => {
  it('shows employer-paid badge for ee_amount when contribution_model is employer_paid', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: { contribution_model: 'employer_paid' },
    } as unknown as ReturnType<typeof useEngagement>);
    vi.mocked(useMappings).mockReturnValue({
      data: makeMappings([
        {
          canonical_column: 'ee_amount',
          source_column: 'emp_contrib',
        },
      ]),
      isLoading: false,
    } as unknown as ReturnType<typeof useMappings>);

    renderWithProviders(<MappingPanel engagementId="eng-1" />);
    expect(screen.getByTestId('employer-paid-badge')).toBeTruthy();
    expect(screen.getByText('Employer-paid — zero contributions expected')).toBeTruthy();
  });

  it('does not show employer-paid badge when contribution_model is standard', () => {
    vi.mocked(useEngagement).mockReturnValue({
      data: { contribution_model: 'standard' },
    } as unknown as ReturnType<typeof useEngagement>);
    vi.mocked(useMappings).mockReturnValue({
      data: makeMappings([
        {
          canonical_column: 'ee_amount',
          source_column: 'emp_contrib',
        },
      ]),
      isLoading: false,
    } as unknown as ReturnType<typeof useMappings>);

    renderWithProviders(<MappingPanel engagementId="eng-1" />);
    expect(screen.queryByTestId('employer-paid-badge')).toBeNull();
  });
});
