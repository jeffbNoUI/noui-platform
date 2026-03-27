import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/helpers';
import { screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useMigrationApi', async () => {
  const actual = await vi.importActual('@/hooks/useMigrationApi');
  return {
    ...actual,
    useEngagement: vi.fn(),
    useSchemaVersions: vi.fn(),
    useSchemaVersion: vi.fn(),
    useCreateSchemaVersion: vi.fn(),
    useActivateSchemaVersion: vi.fn(),
    useSchemaVersionDiff: vi.fn(),
  };
});

import {
  useEngagement,
  useSchemaVersions,
  useSchemaVersion,
  useCreateSchemaVersion,
  useActivateSchemaVersion,
  useSchemaVersionDiff,
} from '@/hooks/useMigrationApi';
import type { SchemaVersion, MigrationEngagement } from '@/types/Migration';

import SchemaVersionPanel from '../SchemaVersionPanel';

const baseMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

function makeEngagement(overrides?: Partial<MigrationEngagement>): MigrationEngagement {
  return {
    engagement_id: 'eng-1',
    tenant_id: 'tenant-1',
    source_system_name: 'Test System',
    canonical_schema_version: '1.0',
    status: 'GO_LIVE',
    source_platform_type: null,
    contribution_model: 'standard',
    quality_baseline_approved_at: null,
    source_connection: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeVersion(overrides?: Partial<SchemaVersion>): SchemaVersion {
  return {
    version_id: 'ver-1',
    tenant_id: 'tenant-1',
    label: 'v1.0',
    description: 'Initial schema version',
    is_active: true,
    fields: [
      {
        entity: 'members',
        field_name: 'member_id',
        data_type: 'UUID',
        is_required: true,
        description: 'Primary key',
      },
      {
        entity: 'members',
        field_name: 'last_name',
        data_type: 'VARCHAR',
        is_required: true,
        description: 'Member last name',
      },
      {
        entity: 'salary',
        field_name: 'amount',
        data_type: 'DECIMAL',
        is_required: true,
        description: 'Salary amount',
      },
    ],
    field_count: 3,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useEngagement).mockReturnValue({
    data: makeEngagement(),
    isLoading: false,
  } as unknown as ReturnType<typeof useEngagement>);

  vi.mocked(useSchemaVersions).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useSchemaVersions>);

  vi.mocked(useSchemaVersion).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useSchemaVersion>);

  vi.mocked(useCreateSchemaVersion).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useCreateSchemaVersion>,
  );

  vi.mocked(useActivateSchemaVersion).mockReturnValue(
    baseMutation as unknown as ReturnType<typeof useActivateSchemaVersion>,
  );

  vi.mocked(useSchemaVersionDiff).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as unknown as ReturnType<typeof useSchemaVersionDiff>);
});

describe('SchemaVersionPanel', () => {
  it('renders empty state when no versions exist', () => {
    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    expect(screen.getByText(/No schema versions defined yet/)).toBeInTheDocument();
  });

  it('renders Create Version button', () => {
    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    expect(screen.getByTestId('create-version-btn')).toBeInTheDocument();
  });

  it('renders version list with label, description, and active badge', () => {
    const version = makeVersion();
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [version],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);

    expect(screen.getByTestId(`schema-version-${version.version_id}`)).toBeInTheDocument();
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getByText('Initial schema version')).toBeInTheDocument();
    expect(screen.getByTestId(`active-badge-${version.version_id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`active-badge-${version.version_id}`).textContent).toBe('Active');
  });

  it('renders field count in version list', () => {
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [makeVersion()],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows Activate button for inactive versions', () => {
    const inactive = makeVersion({
      version_id: 'ver-2',
      label: 'v2.0',
      is_active: false,
    });
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [inactive],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    expect(screen.getByTestId(`activate-btn-${inactive.version_id}`)).toBeInTheDocument();
  });

  it('does not show Activate button for active version', () => {
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [makeVersion()],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    expect(screen.queryByTestId('activate-btn-ver-1')).not.toBeInTheDocument();
  });

  it('shows confirmation dialog when Activate is clicked', () => {
    const inactive = makeVersion({
      version_id: 'ver-2',
      label: 'v2.0',
      is_active: false,
    });
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [inactive],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId(`activate-btn-${inactive.version_id}`));

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/supersede the current active version/)).toBeInTheDocument();
  });

  it('calls activateVersion mutation when confirmation is confirmed', () => {
    const mutateFn = vi.fn();
    vi.mocked(useActivateSchemaVersion).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useActivateSchemaVersion>);

    const inactive = makeVersion({
      version_id: 'ver-2',
      label: 'v2.0',
      is_active: false,
    });
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [inactive],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId(`activate-btn-${inactive.version_id}`));
    fireEvent.click(screen.getByTestId('confirm-ok'));

    expect(mutateFn).toHaveBeenCalledWith({
      versionId: 'ver-2',
      tenantId: 'tenant-1',
    });
  });

  it('dismisses confirmation dialog on cancel', () => {
    const inactive = makeVersion({
      version_id: 'ver-2',
      is_active: false,
    });
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [inactive],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId(`activate-btn-${inactive.version_id}`));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-cancel'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('opens Create Version dialog', () => {
    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('create-version-btn'));
    expect(screen.getByTestId('create-version-dialog')).toBeInTheDocument();
  });

  it('validates label must start with v and a number', () => {
    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('create-version-btn'));

    const labelInput = screen.getByTestId('version-label-input') as HTMLInputElement;
    // Default is 'v' — submit should be disabled
    const submitBtn = screen.getByTestId('create-version-submit');
    expect(submitBtn).toBeDisabled();

    // Type a valid label
    fireEvent.change(labelInput, { target: { value: 'v2.0' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls createSchemaVersion mutation on submit', () => {
    const mutateFn = vi.fn();
    vi.mocked(useCreateSchemaVersion).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useCreateSchemaVersion>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('create-version-btn'));

    fireEvent.change(screen.getByTestId('version-label-input'), {
      target: { value: 'v2.0' },
    });
    fireEvent.change(screen.getByTestId('version-description-input'), {
      target: { value: 'New version' },
    });

    fireEvent.click(screen.getByTestId('create-version-submit'));

    expect(mutateFn).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      req: {
        label: 'v2.0',
        description: 'New version',
        fields: [],
      },
    });
  });

  it('supports adding fields in create dialog', () => {
    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('create-version-btn'));
    fireEvent.click(screen.getByTestId('add-field-btn'));

    // Should show the field editor row with input placeholders
    expect(screen.getByPlaceholderText('members')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('field_name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('VARCHAR')).toBeInTheDocument();
  });

  it('supports CSV import in create dialog', () => {
    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('create-version-btn'));
    fireEvent.click(screen.getByTestId('csv-import-btn'));

    expect(screen.getByTestId('csv-import-section')).toBeInTheDocument();
    expect(screen.getByTestId('csv-textarea')).toBeInTheDocument();
  });

  it('imports CSV data correctly', () => {
    const mutateFn = vi.fn();
    vi.mocked(useCreateSchemaVersion).mockReturnValue({
      ...baseMutation,
      mutate: mutateFn,
    } as unknown as ReturnType<typeof useCreateSchemaVersion>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByTestId('create-version-btn'));
    fireEvent.click(screen.getByTestId('csv-import-btn'));

    fireEvent.change(screen.getByTestId('csv-textarea'), {
      target: { value: 'members,first_name,VARCHAR,true,First name' },
    });
    fireEvent.click(screen.getByTestId('csv-import-apply'));

    // Now submit
    fireEvent.change(screen.getByTestId('version-label-input'), {
      target: { value: 'v3.0' },
    });
    fireEvent.click(screen.getByTestId('create-version-submit'));

    expect(mutateFn).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      req: {
        label: 'v3.0',
        description: '',
        fields: [
          {
            entity: 'members',
            field_name: 'first_name',
            data_type: 'VARCHAR',
            is_required: true,
            description: 'First name',
          },
        ],
      },
    });
  });

  it('renders version checkboxes for comparison', () => {
    const v1 = makeVersion();
    const v2 = makeVersion({
      version_id: 'ver-2',
      label: 'v2.0',
      is_active: false,
    });
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [v1, v2],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    expect(screen.getByTestId('version-checkbox-ver-1')).toBeInTheDocument();
    expect(screen.getByTestId('version-checkbox-ver-2')).toBeInTheDocument();
  });

  it('shows Compare button when two versions are selected', () => {
    const v1 = makeVersion();
    const v2 = makeVersion({
      version_id: 'ver-2',
      label: 'v2.0',
      is_active: false,
    });
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [v1, v2],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);

    // Select two versions
    fireEvent.click(screen.getByTestId('version-checkbox-ver-1'));
    fireEvent.click(screen.getByTestId('version-checkbox-ver-2'));

    expect(screen.getByTestId('compare-btn')).toBeInTheDocument();
  });

  it('renders diff viewer when Compare is clicked', () => {
    const v1 = makeVersion();
    const v2 = makeVersion({
      version_id: 'ver-2',
      label: 'v2.0',
      is_active: false,
    });
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [v1, v2],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);
    vi.mocked(useSchemaVersionDiff).mockReturnValue({
      data: {
        version1: { version_id: 'ver-1', label: 'v1.0' },
        version2: { version_id: 'ver-2', label: 'v2.0' },
        changes: [
          {
            entity: 'members',
            field_name: 'email',
            change_type: 'ADDED' as const,
          },
          {
            entity: 'members',
            field_name: 'legacy_id',
            change_type: 'REMOVED' as const,
          },
          {
            entity: 'salary',
            field_name: 'amount',
            change_type: 'CHANGED' as const,
            old_data_type: 'DECIMAL(10,2)',
            new_data_type: 'DECIMAL(12,2)',
          },
        ],
        added_count: 1,
        removed_count: 1,
        changed_count: 1,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersionDiff>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByTestId('version-checkbox-ver-1'));
    fireEvent.click(screen.getByTestId('version-checkbox-ver-2'));
    fireEvent.click(screen.getByTestId('compare-btn'));

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.getByText(/v1.0 vs v2.0/)).toBeInTheDocument();
  });

  it('renders diff changes with correct labels', () => {
    const v1 = makeVersion();
    const v2 = makeVersion({
      version_id: 'ver-2',
      label: 'v2.0',
      is_active: false,
    });
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [v1, v2],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);
    vi.mocked(useSchemaVersionDiff).mockReturnValue({
      data: {
        version1: { version_id: 'ver-1', label: 'v1.0' },
        version2: { version_id: 'ver-2', label: 'v2.0' },
        changes: [
          {
            entity: 'members',
            field_name: 'email',
            change_type: 'ADDED' as const,
          },
        ],
        added_count: 1,
        removed_count: 0,
        changed_count: 0,
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersionDiff>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);

    fireEvent.click(screen.getByTestId('version-checkbox-ver-1'));
    fireEvent.click(screen.getByTestId('version-checkbox-ver-2'));
    fireEvent.click(screen.getByTestId('compare-btn'));

    expect(screen.getByTestId('diff-change-0')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('members.email')).toBeInTheDocument();
  });

  it('expands field inventory when version label is clicked', () => {
    const version = makeVersion();
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [version],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);
    vi.mocked(useSchemaVersion).mockReturnValue({
      data: version,
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersion>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByText('v1.0'));

    expect(screen.getByTestId('field-inventory')).toBeInTheDocument();
    expect(screen.getByText('Field Inventory')).toBeInTheDocument();
  });

  it('field inventory groups fields by entity', () => {
    const version = makeVersion();
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [version],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);
    vi.mocked(useSchemaVersion).mockReturnValue({
      data: version,
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersion>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    fireEvent.click(screen.getByText('v1.0'));

    expect(screen.getByTestId('entity-section-members')).toBeInTheDocument();
    expect(screen.getByTestId('entity-section-salary')).toBeInTheDocument();
    expect(screen.getByText('(2 fields)')).toBeInTheDocument();
    expect(screen.getByText('(1 fields)')).toBeInTheDocument();
  });

  it('expands entity section to show fields', () => {
    const version = makeVersion();
    vi.mocked(useSchemaVersions).mockReturnValue({
      data: [version],
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersions>);
    vi.mocked(useSchemaVersion).mockReturnValue({
      data: version,
      isLoading: false,
    } as unknown as ReturnType<typeof useSchemaVersion>);

    renderWithProviders(<SchemaVersionPanel engagementId="eng-1" />);
    // Expand version
    fireEvent.click(screen.getByText('v1.0'));
    // Expand entity
    fireEvent.click(screen.getByTestId('entity-section-members'));

    expect(screen.getByText('member_id')).toBeInTheDocument();
    expect(screen.getByText('last_name')).toBeInTheDocument();
    expect(screen.getByText('UUID')).toBeInTheDocument();
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
  });
});
