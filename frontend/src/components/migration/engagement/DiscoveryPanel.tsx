import { useState } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { PANEL_HEADING } from '../panelStyles';
import {
  useEngagement,
  useConfigureSource,
  useDiscoverTables,
  useUpdateEngagement,
} from '@/hooks/useMigrationApi';
import type {
  SourceConnection,
  SourceTable,
  SourceDriver,
  EngagementStatus,
} from '@/types/Migration';

interface Props {
  engagementId: string;
  onAdvance?: () => void;
}

const DRIVERS: { value: SourceDriver; label: string }[] = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mssql', label: 'SQL Server' },
];

const CONTRIBUTION_MODELS = [
  { value: 'standard' as const, label: 'Standard' },
  { value: 'employer_paid' as const, label: 'Employer-Paid' },
];

/** Contribution model is editable only during DISCOVERY and PROFILING */
const EDITABLE_PHASES: Set<EngagementStatus> = new Set(['DISCOVERY', 'PROFILING']);

export default function DiscoveryPanel({ engagementId, onAdvance }: Props) {
  const { data: engagement, isLoading: engLoading } = useEngagement(engagementId);
  const configureSource = useConfigureSource();
  const updateEngagement = useUpdateEngagement();

  const [form, setForm] = useState<SourceConnection>({
    driver: 'postgres',
    host: '',
    port: '5432',
    user: '',
    password: '',
    dbname: '',
  });
  const [connectError, setConnectError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const isConnected = engagement?.source_connection != null;

  // Only enable discovery once connected
  const { data: tables, isLoading: tablesLoading } = useDiscoverTables(engagementId, isConnected);

  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  const handleConnect = async () => {
    setConnectError('');
    try {
      await configureSource.mutateAsync({ engagementId, conn: form });
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const toggleTable = (key: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (!tables) return;
    setSelectedTables(new Set(tables.map((t) => `${t.schema_name}.${t.table_name}`)));
  };

  const deselectAll = () => setSelectedTables(new Set());

  const handleFieldChange = (field: keyof SourceConnection, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'driver') {
      setForm((prev) => ({
        ...prev,
        driver: value as SourceDriver,
        port: value === 'mssql' ? '1433' : '5432',
      }));
    }
  };

  const currentModel = engagement?.contribution_model ?? 'standard';
  const modelEditable = engagement ? EDITABLE_PHASES.has(engagement.status) : false;

  const handleModelChange = (model: 'standard' | 'employer_paid') => {
    if (!modelEditable || model === currentModel) return;
    updateEngagement.mutate({ id: engagementId, req: { contribution_model: model } });
  };

  if (engLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          className="animate-pulse"
          style={{ height: 200, borderRadius: 8, background: C.border }}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Engagement Settings */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            ...PANEL_HEADING,
          }}
        >
          Engagement Settings
        </h3>

        <div>
          <label style={labelStyle}>Contribution Model</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {CONTRIBUTION_MODELS.map((m) => {
              const selected = currentModel === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => handleModelChange(m.value)}
                  disabled={!modelEditable}
                  aria-pressed={selected}
                  data-testid={`contrib-model-${m.value}`}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: `1px solid ${selected ? C.sky : C.border}`,
                    background: selected ? C.skyLight : C.cardBg,
                    color: selected ? C.navy : C.textSecondary,
                    fontFamily: BODY,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: modelEditable ? 'pointer' : 'not-allowed',
                    opacity: modelEditable ? 1 : 0.6,
                    transition: 'all 0.15s',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 11,
              color: C.textTertiary,
              lineHeight: 1.4,
            }}
          >
            {modelEditable
              ? 'Select Employer-Paid for systems where the employer pays 100% of contributions (e.g., Nevada PERS, Utah RS Tier 1).'
              : 'Contribution model is locked after profiling. Change the engagement phase to edit.'}
          </p>
        </div>
      </div>

      {/* Connection Section */}
      {!isConnected || showForm ? (
        <div
          style={{
            background: C.cardBg,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h3 style={PANEL_HEADING}>Configure Source Connection</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Driver */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Database Driver</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DRIVERS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => handleFieldChange('driver', d.value)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: `1px solid ${form.driver === d.value ? C.sky : C.border}`,
                      background: form.driver === d.value ? C.skyLight : C.cardBg,
                      color: form.driver === d.value ? C.navy : C.textSecondary,
                      fontFamily: BODY,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Host */}
            <div>
              <label style={labelStyle}>Host</label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => handleFieldChange('host', e.target.value)}
                placeholder="localhost or IP address"
                style={inputStyle}
              />
            </div>

            {/* Port */}
            <div>
              <label style={labelStyle}>Port</label>
              <input
                type="text"
                value={form.port}
                onChange={(e) => handleFieldChange('port', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* User */}
            <div>
              <label style={labelStyle}>User</label>
              <input
                type="text"
                value={form.user}
                onChange={(e) => handleFieldChange('user', e.target.value)}
                placeholder="Database username"
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                placeholder="Database password"
                style={inputStyle}
              />
            </div>

            {/* Database name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Database Name</label>
              <input
                type="text"
                value={form.dbname}
                onChange={(e) => handleFieldChange('dbname', e.target.value)}
                placeholder="Name of the source database"
                style={inputStyle}
              />
            </div>
          </div>

          {connectError && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 6,
                background: C.coralLight,
                color: C.coral,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {connectError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={handleConnect}
              disabled={configureSource.isPending || !form.host || !form.user || !form.dbname}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background:
                  configureSource.isPending || !form.host || !form.user || !form.dbname
                    ? C.border
                    : C.sky,
                color: C.textOnDark,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: BODY,
                cursor:
                  configureSource.isPending || !form.host || !form.user || !form.dbname
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {configureSource.isPending ? 'Connecting...' : 'Test & Connect'}
            </button>
            {isConnected && (
              <button
                onClick={() => setShowForm(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.cardBg,
                  color: C.textSecondary,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: BODY,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Connected status banner */
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 16, color: '#166534' }}>&#10003;</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
              Source connected
            </span>
            <span style={{ fontSize: 12, color: '#15803d', marginLeft: 8 }}>
              {engagement?.source_connection?.driver === 'mssql' ? 'SQL Server' : 'PostgreSQL'}
              {' \u2014 '}
              {engagement?.source_connection?.dbname}
            </span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: C.textSecondary,
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Change
          </button>
        </div>
      )}

      {/* Discovered Tables Section */}
      {isConnected && !showForm && (
        <div
          style={{
            background: C.cardBg,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3 style={{ ...PANEL_HEADING, margin: 0 }}>Discovered Tables</h3>
            {tables && tables.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={selectAll} style={linkButtonStyle}>
                  Select all
                </button>
                <span style={{ color: C.textTertiary, fontSize: 12 }}>|</span>
                <button onClick={deselectAll} style={linkButtonStyle}>
                  Deselect all
                </button>
              </div>
            )}
          </div>

          {tablesLoading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    height: 36,
                    borderRadius: 6,
                    background: C.border,
                    marginBottom: 6,
                  }}
                />
              ))}
            </div>
          ) : tables && tables.length > 0 ? (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {tables.map((t: SourceTable) => {
                const key = `${t.schema_name}.${t.table_name}`;
                const checked = selectedTables.has(key);
                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 16px',
                      borderBottom: `1px solid ${C.borderLight}`,
                      cursor: 'pointer',
                      background: checked ? C.skyLight : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTable(key)}
                      style={{ width: 16, height: 16, accentColor: C.sky }}
                    />
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 13,
                        color: C.text,
                        fontWeight: 500,
                        flex: 1,
                      }}
                    >
                      {key}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: C.textTertiary,
                        fontFamily: MONO,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.row_count.toLocaleString()} rows, {t.column_count} cols
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: C.textSecondary,
                fontSize: 13,
              }}
            >
              No tables discovered. Check the source connection.
            </div>
          )}

          {/* Footer */}
          {tables && tables.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                borderTop: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, color: C.textSecondary }}>
                {selectedTables.size} of {tables.length} tables selected
              </span>
              <button
                onClick={() => onAdvance?.()}
                disabled={selectedTables.size === 0}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: selectedTables.size === 0 ? C.border : C.sage,
                  color: C.textOnDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: BODY,
                  cursor: selectedTables.size === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Select Tables & Continue &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: C.textSecondary,
  fontFamily: BODY,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  fontFamily: BODY,
  color: C.text,
  background: C.cardBg,
  outline: 'none',
  boxSizing: 'border-box',
};

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: 12,
  color: C.sky,
  cursor: 'pointer',
  fontFamily: BODY,
  fontWeight: 500,
};
