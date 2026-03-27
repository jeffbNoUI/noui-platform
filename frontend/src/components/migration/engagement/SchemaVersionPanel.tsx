import { useState, useCallback, useMemo } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { PANEL_HEADING, SECTION_HEADING } from '../panelStyles';
import {
  useSchemaVersions,
  useSchemaVersion,
  useCreateSchemaVersion,
  useActivateSchemaVersion,
  useSchemaVersionDiff,
} from '@/hooks/useMigrationApi';
import { useEngagement } from '@/hooks/useMigrationApi';
import type {
  SchemaVersion,
  SchemaVersionField,
  SchemaFieldDiff,
  DiffChangeType,
} from '@/types/Migration';

// ─── Constants ──────────────────────────────────────────────────────────────

const DIFF_COLORS: Record<DiffChangeType, { color: string; bg: string; label: string }> = {
  ADDED: { color: C.sage, bg: C.sageLight, label: 'Added' },
  REMOVED: { color: C.coral, bg: C.coralLight, label: 'Removed' },
  CHANGED: { color: C.gold, bg: C.goldLight, label: 'Changed' },
};

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  engagementId: string;
}

export default function SchemaVersionPanel({ engagementId }: Props) {
  const { data: engagement } = useEngagement(engagementId);
  const tenantId = engagement?.tenant_id;
  const { data: versions, isLoading } = useSchemaVersions(tenantId);
  const createVersion = useCreateSchemaVersion();
  const activateVersion = useActivateSchemaVersion();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  // Diff state
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  const { data: expandedVersion } = useSchemaVersion(expandedVersionId ?? undefined);

  const diffV1 = selectedVersions.length >= 2 ? selectedVersions[0] : undefined;
  const diffV2 = selectedVersions.length >= 2 ? selectedVersions[1] : undefined;
  const { data: diffData } = useSchemaVersionDiff(
    showDiff ? diffV1 : undefined,
    showDiff ? diffV2 : undefined,
  );

  const handleCheckbox = useCallback((versionId: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((v) => v !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1], versionId];
      }
      return [...prev, versionId];
    });
    setShowDiff(false);
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedVersions.length === 2) {
      setShowDiff(true);
    }
  }, [selectedVersions]);

  const handleActivate = useCallback(
    (versionId: string) => {
      if (!tenantId) return;
      activateVersion.mutate({ versionId, tenantId });
      setConfirmActivateId(null);
    },
    [activateVersion, tenantId],
  );

  // Group fields by entity for the field inventory
  const fieldsByEntity = useMemo(() => {
    if (!expandedVersion?.fields) return {};
    const grouped: Record<string, SchemaVersionField[]> = {};
    for (const field of expandedVersion.fields) {
      if (!grouped[field.entity]) grouped[field.entity] = [];
      grouped[field.entity].push(field);
    }
    return grouped;
  }, [expandedVersion]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: BODY }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ ...PANEL_HEADING, margin: 0, flex: 1 }}>Schema Versions</h3>

        {selectedVersions.length === 2 && (
          <button
            data-testid="compare-btn"
            onClick={handleCompare}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.sky}`,
              background: C.skyLight,
              color: C.navyLight,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Compare Selected
          </button>
        )}

        <button
          data-testid="create-version-btn"
          onClick={() => setShowCreateDialog(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: `1px solid ${C.sage}`,
            background: C.sage,
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BODY,
          }}
        >
          Create Version
        </button>
      </div>

      {/* Version list */}
      {isLoading ? (
        <div
          className="animate-pulse"
          style={{ height: 120, borderRadius: 8, background: C.border }}
        />
      ) : !versions?.length ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: C.textSecondary,
            fontSize: 13,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
          }}
        >
          No schema versions defined yet. Create a version to get started.
        </div>
      ) : (
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 100px 1fr 80px 80px 160px 100px',
              gap: 0,
              padding: '8px 16px',
              background: C.cardBgWarm,
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 600,
              color: C.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              alignItems: 'center',
            }}
          >
            <span />
            <span>Label</span>
            <span>Description</span>
            <span>Status</span>
            <span>Fields</span>
            <span>Created</span>
            <span>Actions</span>
          </div>

          {/* Rows */}
          {versions.map((version: SchemaVersion) => (
            <div key={version.version_id}>
              <div
                data-testid={`schema-version-${version.version_id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 100px 1fr 80px 80px 160px 100px',
                  gap: 0,
                  padding: '10px 16px',
                  borderBottom: `1px solid ${C.borderLight}`,
                  background: expandedVersionId === version.version_id ? C.skyLight : 'white',
                  alignItems: 'center',
                }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  data-testid={`version-checkbox-${version.version_id}`}
                  checked={selectedVersions.includes(version.version_id)}
                  onChange={() => handleCheckbox(version.version_id)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                {/* Label */}
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.navy,
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setExpandedVersionId(
                      expandedVersionId === version.version_id ? null : version.version_id,
                    )
                  }
                >
                  {version.label}
                </span>
                {/* Description */}
                <span
                  style={{
                    fontSize: 12,
                    color: C.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {version.description}
                </span>
                {/* Active badge */}
                <span>
                  {version.is_active ? (
                    <span
                      data-testid={`active-badge-${version.version_id}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 10,
                        color: C.sage,
                        background: C.sageLight,
                      }}
                    >
                      Active
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 10,
                        color: C.textTertiary,
                        background: C.borderLight,
                      }}
                    >
                      Inactive
                    </span>
                  )}
                </span>
                {/* Field count */}
                <span style={{ fontSize: 13, color: C.text }}>
                  {version.field_count ?? version.fields?.length ?? 0}
                </span>
                {/* Created at */}
                <span style={{ fontSize: 12, color: C.textSecondary }}>
                  {new Date(version.created_at).toLocaleDateString()}
                </span>
                {/* Actions */}
                <div>
                  {!version.is_active && (
                    <button
                      data-testid={`activate-btn-${version.version_id}`}
                      onClick={() => setConfirmActivateId(version.version_id)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 4,
                        border: `1px solid ${C.sage}`,
                        background: 'transparent',
                        color: C.sage,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: BODY,
                      }}
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>

              {/* Field inventory */}
              {expandedVersionId === version.version_id && expandedVersion && (
                <FieldInventory fieldsByEntity={fieldsByEntity} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Diff viewer */}
      {showDiff && diffData && <DiffViewer diff={diffData} />}

      {/* Create Version Dialog */}
      {showCreateDialog && tenantId && (
        <CreateVersionDialog
          tenantId={tenantId}
          onClose={() => setShowCreateDialog(false)}
          onCreate={(req) => {
            createVersion.mutate({ tenantId, req });
            setShowCreateDialog(false);
          }}
          isPending={createVersion.isPending}
        />
      )}

      {/* Activate confirmation dialog */}
      {confirmActivateId && (
        <ConfirmDialog
          title="Activate Schema Version"
          message="Activating this version will supersede the current active version. All new mappings and validations will use this version."
          onConfirm={() => handleActivate(confirmActivateId)}
          onCancel={() => setConfirmActivateId(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FieldInventory({
  fieldsByEntity,
}: {
  fieldsByEntity: Record<string, SchemaVersionField[]>;
}) {
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

  const toggleEntity = (entity: string) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) next.delete(entity);
      else next.add(entity);
      return next;
    });
  };

  const entities = Object.keys(fieldsByEntity).sort();

  return (
    <div
      data-testid="field-inventory"
      style={{
        padding: '12px 16px 12px 48px',
        background: C.pageBg,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <h4 style={{ ...SECTION_HEADING, margin: '0 0 8px' }}>Field Inventory</h4>

      {entities.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textSecondary }}>No fields defined.</div>
      ) : (
        entities.map((entity) => (
          <div key={entity} style={{ marginBottom: 4 }}>
            <div
              data-testid={`entity-section-${entity}`}
              onClick={() => toggleEntity(entity)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                background: expandedEntities.has(entity) ? 'white' : 'transparent',
                border: expandedEntities.has(entity)
                  ? `1px solid ${C.border}`
                  : '1px solid transparent',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: C.textTertiary,
                  transform: expandedEntities.has(entity) ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}
              >
                &#9654;
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{entity}</span>
              <span style={{ fontSize: 11, color: C.textTertiary }}>
                ({fieldsByEntity[entity].length} fields)
              </span>
            </div>

            {expandedEntities.has(entity) && (
              <div style={{ marginLeft: 24, marginTop: 4 }}>
                {fieldsByEntity[entity].map((field) => (
                  <div
                    key={`${field.entity}-${field.field_name}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 8px',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontFamily: MONO, color: C.navy, minWidth: 160 }}>
                      {field.field_name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: C.textSecondary,
                        background: C.borderLight,
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontFamily: MONO,
                      }}
                    >
                      {field.data_type}
                    </span>
                    {field.is_required && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.coral,
                          background: C.coralLight,
                          padding: '1px 6px',
                          borderRadius: 8,
                        }}
                      >
                        Required
                      </span>
                    )}
                    {field.description && (
                      <span style={{ fontSize: 11, color: C.textTertiary }}>
                        {field.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function DiffViewer({ diff }: { diff: import('@/types/Migration').SchemaVersionDiff }) {
  return (
    <div
      data-testid="diff-viewer"
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          background: C.cardBgWarm,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <h4 style={{ ...SECTION_HEADING, margin: 0 }}>
          Schema Diff: {diff.version1.label} vs {diff.version2.label}
        </h4>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 8,
            color: DIFF_COLORS.ADDED.color,
            background: DIFF_COLORS.ADDED.bg,
            fontWeight: 600,
          }}
        >
          +{diff.added_count}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 8,
            color: DIFF_COLORS.REMOVED.color,
            background: DIFF_COLORS.REMOVED.bg,
            fontWeight: 600,
          }}
        >
          -{diff.removed_count}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 8,
            color: DIFF_COLORS.CHANGED.color,
            background: DIFF_COLORS.CHANGED.bg,
            fontWeight: 600,
          }}
        >
          ~{diff.changed_count}
        </span>
      </div>

      {/* Changes */}
      {diff.changes.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: C.textSecondary,
            fontSize: 13,
          }}
        >
          No structural differences found.
        </div>
      ) : (
        <div style={{ padding: 8 }}>
          {diff.changes.map((change: SchemaFieldDiff, i: number) => {
            const ct = DIFF_COLORS[change.change_type] ?? DIFF_COLORS.CHANGED;
            return (
              <div
                key={`${change.entity}-${change.field_name}-${i}`}
                data-testid={`diff-change-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  marginBottom: 4,
                  background: ct.bg,
                  border: `1px solid ${ct.color}20`,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 8,
                    color: ct.color,
                    background: 'white',
                    flexShrink: 0,
                  }}
                >
                  {ct.label}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    color: C.navy,
                    fontWeight: 600,
                  }}
                >
                  {change.entity}.{change.field_name}
                </span>

                {change.change_type === 'CHANGED' && (
                  <span style={{ fontSize: 11, color: C.textSecondary }}>
                    {change.old_data_type && change.new_data_type && (
                      <span>
                        {change.old_data_type}{' '}
                        <span style={{ color: C.gold, fontWeight: 600 }}>&rarr;</span>{' '}
                        {change.new_data_type}
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateVersionDialog({
  tenantId,
  onClose,
  onCreate,
  isPending,
}: {
  tenantId: string;
  onClose: () => void;
  onCreate: (req: import('@/types/Migration').CreateSchemaVersionRequest) => void;
  isPending: boolean;
}) {
  const [label, setLabel] = useState('v');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<SchemaVersionField[]>([]);
  const [csvInput, setCsvInput] = useState('');
  const [showCsvImport, setShowCsvImport] = useState(false);

  const isLabelValid = /^v\d/.test(label);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { entity: '', field_name: '', data_type: 'VARCHAR', is_required: false, description: '' },
    ]);
  };

  const updateField = (index: number, updates: Partial<SchemaVersionField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCsvImport = () => {
    const lines = csvInput.trim().split('\n');
    const imported: SchemaVersionField[] = [];
    for (const line of lines) {
      const parts = line.split(',').map((s) => s.trim());
      if (parts.length >= 3) {
        imported.push({
          entity: parts[0],
          field_name: parts[1],
          data_type: parts[2],
          is_required: parts[3]?.toLowerCase() === 'true',
          description: parts[4] ?? '',
        });
      }
    }
    setFields((prev) => [...prev, ...imported]);
    setCsvInput('');
    setShowCsvImport(false);
  };

  const handleSubmit = () => {
    onCreate({ label, description, fields });
  };

  // suppress unused var
  void tenantId;

  return (
    <div
      data-testid="create-version-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 24,
          maxWidth: 720,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={PANEL_HEADING}>Create Schema Version</h3>

        {/* Label + Description */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: '0 0 120px' }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textSecondary,
                display: 'block',
                marginBottom: 4,
              }}
            >
              Label
            </label>
            <input
              data-testid="version-label-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="v1.0"
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 4,
                border: `1px solid ${isLabelValid || label === 'v' ? C.border : C.coral}`,
                fontSize: 13,
                fontFamily: MONO,
              }}
            />
            {!isLabelValid && label !== 'v' && (
              <span style={{ fontSize: 10, color: C.coral }}>Must start with v and a number</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textSecondary,
                display: 'block',
                marginBottom: 4,
              }}
            >
              Description
            </label>
            <input
              data-testid="version-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Schema version description"
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 4,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                fontFamily: BODY,
              }}
            />
          </div>
        </div>

        {/* Fields */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>
              Field Definitions ({fields.length})
            </label>
            <button
              data-testid="add-field-btn"
              onClick={addField}
              style={{
                padding: '2px 10px',
                borderRadius: 4,
                border: `1px solid ${C.sage}`,
                background: C.sageLight,
                color: C.sage,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY,
              }}
            >
              + Add Field
            </button>
            <button
              data-testid="csv-import-btn"
              onClick={() => setShowCsvImport(!showCsvImport)}
              style={{
                padding: '2px 10px',
                borderRadius: 4,
                border: `1px solid ${C.sky}`,
                background: C.skyLight,
                color: C.navyLight,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY,
              }}
            >
              CSV Import
            </button>
          </div>

          {showCsvImport && (
            <div
              data-testid="csv-import-section"
              style={{
                padding: 12,
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: C.pageBg,
                marginBottom: 8,
              }}
            >
              <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 8px' }}>
                Paste CSV: entity,field_name,data_type,is_required,description (one per line)
              </p>
              <textarea
                data-testid="csv-textarea"
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                  fontSize: 12,
                  fontFamily: MONO,
                  resize: 'vertical',
                }}
              />
              <button
                data-testid="csv-import-apply"
                onClick={handleCsvImport}
                disabled={!csvInput.trim()}
                style={{
                  marginTop: 8,
                  padding: '4px 12px',
                  borderRadius: 4,
                  border: `1px solid ${C.sage}`,
                  background: C.sage,
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: !csvInput.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: BODY,
                }}
              >
                Import
              </button>
            </div>
          )}

          {/* Field table editor */}
          {fields.length > 0 && (
            <div
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 100px 70px 1fr 32px',
                  gap: 0,
                  padding: '6px 8px',
                  background: C.cardBgWarm,
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.textSecondary,
                  textTransform: 'uppercase',
                }}
              >
                <span>Entity</span>
                <span>Field</span>
                <span>Type</span>
                <span>Req?</span>
                <span>Description</span>
                <span />
              </div>
              {fields.map((field, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 100px 70px 1fr 32px',
                    gap: 4,
                    padding: '4px 8px',
                    borderBottom: `1px solid ${C.borderLight}`,
                    alignItems: 'center',
                  }}
                >
                  <input
                    value={field.entity}
                    onChange={(e) => updateField(idx, { entity: e.target.value })}
                    placeholder="members"
                    style={{
                      padding: '3px 6px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 3,
                      fontSize: 11,
                      fontFamily: MONO,
                    }}
                  />
                  <input
                    value={field.field_name}
                    onChange={(e) => updateField(idx, { field_name: e.target.value })}
                    placeholder="field_name"
                    style={{
                      padding: '3px 6px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 3,
                      fontSize: 11,
                      fontFamily: MONO,
                    }}
                  />
                  <input
                    value={field.data_type}
                    onChange={(e) => updateField(idx, { data_type: e.target.value })}
                    placeholder="VARCHAR"
                    style={{
                      padding: '3px 6px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 3,
                      fontSize: 11,
                      fontFamily: MONO,
                    }}
                  />
                  <input
                    type="checkbox"
                    checked={field.is_required}
                    onChange={(e) => updateField(idx, { is_required: e.target.checked })}
                    style={{ width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <input
                    value={field.description}
                    onChange={(e) => updateField(idx, { description: e.target.value })}
                    placeholder="Description"
                    style={{
                      padding: '3px 6px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 3,
                      fontSize: 11,
                      fontFamily: BODY,
                    }}
                  />
                  <button
                    onClick={() => removeField(idx)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: `1px solid ${C.border}`,
                      background: 'transparent',
                      color: C.coral,
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: '24px',
                      padding: 0,
                    }}
                    title="Remove field"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'white',
              color: C.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Cancel
          </button>
          <button
            data-testid="create-version-submit"
            onClick={handleSubmit}
            disabled={!isLabelValid || isPending}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.sage}`,
              background: C.sage,
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: !isLabelValid || isPending ? 'not-allowed' : 'pointer',
              opacity: !isLabelValid || isPending ? 0.6 : 1,
              fontFamily: BODY,
            }}
          >
            {isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      data-testid="confirm-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={SECTION_HEADING}>{title}</h3>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 20px', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            data-testid="confirm-cancel"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'white',
              color: C.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Cancel
          </button>
          <button
            data-testid="confirm-ok"
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.sage}`,
              background: C.sage,
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
