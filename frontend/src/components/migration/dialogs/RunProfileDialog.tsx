import { useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import { useProfileEngagement } from '@/hooks/useMigrationApi';

interface RunProfileDialogProps {
  open: boolean;
  engagementId: string;
  onClose: () => void;
  onProfiled: () => void;
}

interface TableEntry {
  table_name: string;
  key_columns: string;
  required_columns: string;
  date_columns: string;
}

const EMPTY_TABLE: TableEntry = {
  table_name: '',
  key_columns: '',
  required_columns: '',
  date_columns: '',
};

export default function RunProfileDialog({
  open,
  engagementId,
  onClose,
  onProfiled,
}: RunProfileDialogProps) {
  const [tables, setTables] = useState<TableEntry[]>([{ ...EMPTY_TABLE }]);
  const profileMutation = useProfileEngagement();

  if (!open) return null;

  const addTable = () => setTables((prev) => [...prev, { ...EMPTY_TABLE }]);

  const removeTable = (idx: number) => setTables((prev) => prev.filter((_, i) => i !== idx));

  const updateTable = (idx: number, field: keyof TableEntry, value: string) =>
    setTables((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));

  const splitCsv = (s: string): string[] =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  const canSubmit = tables.some((t) => t.table_name.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      tables: tables
        .filter((t) => t.table_name.trim())
        .map((t) => ({
          table_name: t.table_name.trim(),
          key_columns: splitCsv(t.key_columns),
          required_columns: splitCsv(t.required_columns),
          date_columns: splitCsv(t.date_columns),
          pattern_checks: [],
          fk_references: [],
          business_rules: [],
        })),
    };

    try {
      await profileMutation.mutateAsync({ engagementId, req: payload });
      setTables([{ ...EMPTY_TABLE }]);
      onProfiled();
    } catch {
      // Error shown via mutation state
    }
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
          width: 540,
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
          Run Quality Profile
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
          Specify which source tables to profile. The profiler analyzes each table across six ISO
          8000 dimensions.
        </p>

        <form onSubmit={handleSubmit}>
          {tables.map((table, idx) => (
            <div
              key={idx}
              style={{
                background: C.pageBg,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.textSecondary,
                  }}
                >
                  Table {idx + 1}
                </span>
                {tables.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTable(idx)}
                    style={{
                      fontFamily: BODY,
                      fontSize: 11,
                      color: C.coral,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <label style={labelStyle}>
                Table Name *
                <input
                  type="text"
                  value={table.table_name}
                  onChange={(e) => updateTable(idx, 'table_name', e.target.value)}
                  placeholder="e.g. members, salary_history"
                  style={inputStyle}
                  autoFocus={idx === 0}
                />
              </label>

              <label style={labelStyle}>
                Key Columns{' '}
                <span style={{ fontWeight: 400, color: C.textTertiary }}>(comma-separated)</span>
                <input
                  type="text"
                  value={table.key_columns}
                  onChange={(e) => updateTable(idx, 'key_columns', e.target.value)}
                  placeholder="e.g. member_id, ssn"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Required Columns{' '}
                <span style={{ fontWeight: 400, color: C.textTertiary }}>(comma-separated)</span>
                <input
                  type="text"
                  value={table.required_columns}
                  onChange={(e) => updateTable(idx, 'required_columns', e.target.value)}
                  placeholder="e.g. first_name, last_name, ssn"
                  style={inputStyle}
                />
              </label>

              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Date Columns{' '}
                <span style={{ fontWeight: 400, color: C.textTertiary }}>(comma-separated)</span>
                <input
                  type="text"
                  value={table.date_columns}
                  onChange={(e) => updateTable(idx, 'date_columns', e.target.value)}
                  placeholder="e.g. hire_date, updated_at"
                  style={inputStyle}
                />
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={addTable}
            style={{
              fontFamily: BODY,
              fontSize: 12,
              fontWeight: 500,
              color: C.sky,
              background: 'none',
              border: `1px dashed ${C.border}`,
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              width: '100%',
              marginBottom: 20,
            }}
          >
            + Add Another Table
          </button>

          {profileMutation.isError && (
            <p style={{ fontSize: 12, color: C.coral, margin: '0 0 12px' }}>
              {profileMutation.error.message}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setTables([{ ...EMPTY_TABLE }]);
                onClose();
              }}
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || profileMutation.isPending}
              style={{
                fontFamily: BODY,
                fontSize: 13,
                fontWeight: 600,
                color: C.textOnDark,
                background: !canSubmit || profileMutation.isPending ? C.textTertiary : C.sky,
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                cursor: !canSubmit || profileMutation.isPending ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {profileMutation.isPending ? 'Profiling...' : 'Run Profile'}
            </button>
          </div>
        </form>
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
  marginBottom: 10,
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
