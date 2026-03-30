import { useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import { useConfigureSource, useDiscoverTables } from '@/hooks/useMigrationApi';
import type { SourceConnection, SourceTable, SourceDriver } from '@/types/Migration';

interface ConfigureSourceDialogProps {
  open: boolean;
  engagementId: string;
  existingConnection: SourceConnection | null;
  onClose: () => void;
  onConnected: (tables: SourceTable[]) => void;
}

const DRIVERS: { value: SourceDriver; label: string; defaultPort: string }[] = [
  { value: 'mssql', label: 'SQL Server', defaultPort: '1433' },
  { value: 'postgres', label: 'PostgreSQL', defaultPort: '5432' },
];

export default function ConfigureSourceDialog({
  open,
  engagementId,
  existingConnection,
  onClose,
  onConnected,
}: ConfigureSourceDialogProps) {
  const [driver, setDriver] = useState<SourceDriver>(existingConnection?.driver ?? 'mssql');
  const [host, setHost] = useState(existingConnection?.host ?? '');
  const [port, setPort] = useState(existingConnection?.port ?? '1433');
  const [user, setUser] = useState(existingConnection?.user ?? '');
  const [password, setPassword] = useState(existingConnection?.password ?? '');
  const [dbname, setDbname] = useState(existingConnection?.dbname ?? '');
  const [connected, setConnected] = useState(false);

  const configureMutation = useConfigureSource();
  const {
    data: tables,
    isLoading: tablesLoading,
    refetch: refetchTables,
  } = useDiscoverTables(engagementId, connected);

  if (!open) return null;

  const canConnect = host.trim() && user.trim() && dbname.trim();

  const handleDriverChange = (newDriver: SourceDriver) => {
    setDriver(newDriver);
    const driverDef = DRIVERS.find((d) => d.value === newDriver);
    if (driverDef) setPort(driverDef.defaultPort);
    setConnected(false);
  };

  const handleConnect = async () => {
    const conn: SourceConnection = {
      driver,
      host: host.trim(),
      port: port.trim() || (DRIVERS.find((d) => d.value === driver)?.defaultPort ?? '5432'),
      user: user.trim(),
      password,
      dbname: dbname.trim(),
    };
    try {
      await configureMutation.mutateAsync({ engagementId, conn });
      setConnected(true);
      refetchTables();
    } catch {
      setConnected(false);
    }
  };

  const handleUseSelected = () => {
    if (tables) onConnected(tables);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: C.cardBg,
          borderRadius: 16,
          padding: 32,
          width: 580,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 6px',
          }}
        >
          Connect to Source Database
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.textSecondary,
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          Connect to the legacy system database to discover tables for migration.
        </p>

        {/* Driver selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Database Type</label>
          <div className="flex gap-2" style={{ marginTop: 4 }}>
            {DRIVERS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => handleDriverChange(d.value)}
                style={{
                  fontFamily: BODY,
                  fontSize: 13,
                  fontWeight: driver === d.value ? 600 : 400,
                  color: driver === d.value ? C.navy : C.textSecondary,
                  background: driver === d.value ? C.skyLight : 'transparent',
                  border: `1px solid ${driver === d.value ? C.sky : C.border}`,
                  borderRadius: 8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Connection fields */}
        <div className="flex gap-3" style={{ marginBottom: 12 }}>
          <div style={{ flex: 3 }}>
            <label style={labelStyle}>Host *</label>
            <input
              type="text"
              value={host}
              onChange={(e) => {
                setHost(e.target.value);
                setConnected(false);
              }}
              placeholder={
                driver === 'mssql' ? 'e.g. db-server.corp.local' : 'e.g. legacy-db.internal'
              }
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Port</label>
            <input
              type="text"
              value={port}
              onChange={(e) => {
                setPort(e.target.value);
                setConnected(false);
              }}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Database Name *</label>
          <input
            type="text"
            value={dbname}
            onChange={(e) => {
              setDbname(e.target.value);
              setConnected(false);
            }}
            placeholder={driver === 'mssql' ? 'e.g. PensionAdmin_Prod' : 'e.g. pension_legacy'}
            style={inputStyle}
          />
        </div>

        <div className="flex gap-3" style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Username *</label>
            <input
              type="text"
              value={user}
              onChange={(e) => {
                setUser(e.target.value);
                setConnected(false);
              }}
              placeholder="e.g. migration_reader"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setConnected(false);
              }}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Connect button */}
        {!connected && (
          <button
            onClick={handleConnect}
            disabled={!canConnect || configureMutation.isPending}
            style={{
              width: '100%',
              fontFamily: BODY,
              fontSize: 14,
              fontWeight: 600,
              color: C.textOnDark,
              background: !canConnect || configureMutation.isPending ? C.textTertiary : C.sky,
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              cursor: !canConnect || configureMutation.isPending ? 'not-allowed' : 'pointer',
              marginBottom: 12,
              transition: 'background 0.15s',
            }}
          >
            {configureMutation.isPending ? 'Connecting...' : 'Test Connection'}
          </button>
        )}

        {configureMutation.isError && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 12,
            }}
          >
            <p style={{ fontSize: 13, color: C.coral, margin: 0 }}>
              Connection failed: {configureMutation.error.message}
            </p>
          </div>
        )}

        {/* Connected — show discovered tables */}
        {connected && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 16 }}>&#10003;</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                Connected to {dbname} ({DRIVERS.find((d) => d.value === driver)?.label})
              </span>
            </div>

            <h3
              style={{
                fontFamily: DISPLAY,
                fontSize: 16,
                fontWeight: 600,
                color: C.navy,
                margin: '0 0 8px',
              }}
            >
              Discovered Tables
            </h3>

            {tablesLoading ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <span style={{ fontSize: 13, color: C.textSecondary }}>Discovering tables...</span>
              </div>
            ) : tables && tables.length > 0 ? (
              <div
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  maxHeight: 300,
                  overflowY: 'auto',
                  marginBottom: 16,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                      <th style={thStyle}>Schema</th>
                      <th style={thStyle}>Table</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Columns</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Rows (approx)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.map((t) => (
                      <tr
                        key={`${t.schema_name}.${t.table_name}`}
                        style={{ borderBottom: `1px solid ${C.borderLight}` }}
                      >
                        <td style={{ ...tdStyle, color: C.textSecondary }}>{t.schema_name}</td>
                        <td style={{ ...tdStyle, fontFamily: MONO, fontWeight: 500 }}>
                          {t.table_name}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{t.column_count}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {t.row_count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: C.textSecondary, margin: '8px 0 16px' }}>
                No tables found in the source database.
              </p>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3" style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 500,
              color: C.textSecondary,
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 18px',
              cursor: 'pointer',
            }}
          >
            {connected ? 'Close' : 'Cancel'}
          </button>
          {connected && tables && tables.length > 0 && (
            <button
              type="button"
              onClick={handleUseSelected}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 600,
                color: C.textOnDark,
                background: C.navy,
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              Continue with {tables.length} tables
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: '#3d4f5f',
  marginBottom: 2,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #e2e5e9',
  outline: 'none',
  color: '#1a2b3c',
  background: '#ffffff',
  boxSizing: 'border-box',
  marginTop: 4,
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontFamily: 'Inter, system-ui, sans-serif',
  color: '#3d4f5f',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  color: '#1a2b3c',
  fontFamily: 'Inter, system-ui, sans-serif',
};
