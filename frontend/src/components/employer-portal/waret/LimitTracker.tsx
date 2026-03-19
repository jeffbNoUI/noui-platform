import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import { useWaretTracking, useYTDSummary, useRecordWorkDay } from '@/hooks/useEmployerWaret';
import type { WaretTracking, WaretYTDSummary } from '@/types/Employer';

interface LimitTrackerProps {
  designationId: string;
  orgId: string;
}

function ProgressBar({
  current,
  limit,
  label,
}: {
  current: number;
  limit: number | null;
  label: string;
}) {
  if (limit == null) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>
          {label}: {current} (unlimited)
        </div>
        <div
          style={{
            height: 8,
            background: '#dbeafe',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '100%', height: '100%', background: '#3b82f6', borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  const pct = Math.min((current / limit) * 100, 100);
  const overLimit = current > limit;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}
      >
        <span style={{ color: C.textSecondary }}>{label}</span>
        <span style={{ fontWeight: 600, color: overLimit ? '#ef4444' : C.text }}>
          {current} / {limit} {overLimit && '⚠ OVER LIMIT'}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: C.border,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: overLimit ? '#ef4444' : pct > 80 ? '#f59e0b' : '#10b981',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

export default function LimitTracker({ designationId, orgId }: LimitTrackerProps) {
  const { data: summary } = useYTDSummary(designationId);
  const { data: trackingData, isLoading: trackingLoading } = useWaretTracking(designationId);
  const recordMutation = useRecordWorkDay();

  const [showEntry, setShowEntry] = useState(false);
  const [form, setForm] = useState({ workDate: '', hoursWorked: '', notes: '' });
  const [error, setError] = useState<string | null>(null);

  const records: WaretTracking[] = trackingData?.items ?? [];
  const ytd: WaretYTDSummary | undefined = summary ?? undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.workDate || !form.hoursWorked) {
      setError('Work date and hours are required');
      return;
    }

    try {
      await recordMutation.mutateAsync({
        designationId,
        orgId,
        workDate: form.workDate,
        hoursWorked: form.hoursWorked,
        notes: form.notes || undefined,
      });
      setForm({ workDate: '', hoursWorked: '', notes: '' });
      setShowEntry(false);
    } catch {
      setError('Failed to record work day');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    fontSize: 14,
    fontFamily: BODY,
    background: C.cardBg,
    color: C.text,
  };

  return (
    <div style={{ fontFamily: BODY }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Limit Tracker</h3>
        <button
          onClick={() => setShowEntry(!showEntry)}
          style={{
            padding: '6px 16px',
            background: C.navy,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showEntry ? 'Cancel' : '+ Record Work Day'}
        </button>
      </div>

      {/* YTD Summary */}
      {ytd && (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: C.textSecondary,
              marginBottom: 12,
              textTransform: 'uppercase',
            }}
          >
            {ytd.calendarYear} Year-to-Date
            {ytd.orpExempt && (
              <span
                style={{
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  padding: '2px 6px',
                  borderRadius: 4,
                  marginLeft: 8,
                  fontSize: 10,
                }}
              >
                ORP EXEMPT
              </span>
            )}
          </div>
          <ProgressBar current={ytd.totalDays} limit={ytd.dayLimit} label="Days" />
          <ProgressBar current={parseFloat(ytd.totalHours)} limit={ytd.hourLimit} label="Hours" />
        </div>
      )}

      {/* Entry Form */}
      {showEntry && (
        <div
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  color: '#dc2626',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.textSecondary,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Work Date *
                </label>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.workDate}
                  onChange={(e) => setForm((p) => ({ ...p, workDate: e.target.value }))}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.textSecondary,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Hours Worked *
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  style={inputStyle}
                  value={form.hoursWorked}
                  onChange={(e) => setForm((p) => ({ ...p, hoursWorked: e.target.value }))}
                  placeholder="e.g. 6.5"
                />
                <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                  &gt;4 hours = 1 full day
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={recordMutation.isPending}
              style={{
                padding: '8px 20px',
                background: C.navy,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: recordMutation.isPending ? 'wait' : 'pointer',
              }}
            >
              {recordMutation.isPending ? 'Recording...' : 'Record'}
            </button>
          </form>
        </div>
      )}

      {/* Recent Records */}
      {trackingLoading && <div style={{ color: C.textSecondary, fontSize: 13 }}>Loading...</div>}

      {records.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {['Date', 'Hours', 'Day?', 'YTD Days', 'YTD Hours', 'Status'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    color: C.textSecondary,
                    fontSize: 11,
                    textTransform: 'uppercase',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 12px' }}>{r.workDate}</td>
                <td style={{ padding: '8px 12px' }}>{r.hoursWorked}</td>
                <td style={{ padding: '8px 12px' }}>{r.countsAsDay ? 'Yes' : 'No'}</td>
                <td style={{ padding: '8px 12px' }}>{r.ytdDays}</td>
                <td style={{ padding: '8px 12px' }}>{r.ytdHours}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: r.entryStatus === 'VERIFIED' ? '#d1fae5' : '#f3f4f6',
                      color: r.entryStatus === 'VERIFIED' ? '#059669' : '#6b7280',
                    }}
                  >
                    {r.entryStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
