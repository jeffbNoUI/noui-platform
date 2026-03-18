import { useEmployment } from '@/hooks/useMember';
import type { EmploymentEvent } from '@/types/Member';
import { C, BODY } from '@/lib/designSystem';
import { formatDate, formatCurrency } from '../MemberPortalUtils';

// ── Props ───────────────────────────────────────────────────────────────────

interface EmploymentHistoryTabProps {
  memberId: number;
  onFlagIssue?: (context: {
    entityType: string;
    entityId: string;
    label: string;
    currentValue: string;
  }) => void;
}

// ── Event type display ──────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  HIRE: 'Hired',
  REHIRE: 'Rehired',
  PROMOTION: 'Promotion',
  TRANSFER: 'Transfer',
  SALARY_CHANGE: 'Salary Change',
  SEPARATION: 'Separation',
  LEAVE: 'Leave of Absence',
  RETURN: 'Return from Leave',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  HIRE: C.sage,
  REHIRE: C.sage,
  PROMOTION: C.sky,
  TRANSFER: C.sky,
  SALARY_CHANGE: C.gold,
  SEPARATION: C.coral,
  LEAVE: C.textTertiary,
  RETURN: C.sage,
};

// ── Component ───────────────────────────────────────────────────────────────

export default function EmploymentHistoryTab({ memberId, onFlagIssue }: EmploymentHistoryTabProps) {
  const { data: events, isLoading } = useEmployment(memberId);

  if (isLoading) {
    return (
      <div
        data-testid="employment-history-tab"
        style={{ fontFamily: BODY, color: C.textSecondary }}
      >
        Loading employment history...
      </div>
    );
  }

  const eventList = events ?? [];
  const sorted = [...eventList].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
  );

  return (
    <div data-testid="employment-history-tab">
      {sorted.length === 0 && (
        <div style={{ fontFamily: BODY, color: C.textSecondary, textAlign: 'center', padding: 20 }}>
          No employment history on file.
        </div>
      )}

      <div style={{ position: 'relative', paddingLeft: 32 }}>
        {/* Timeline line */}
        {sorted.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 11,
              top: 8,
              bottom: 8,
              width: 2,
              background: C.borderLight,
            }}
          />
        )}

        {sorted.map((event: EmploymentEvent) => {
          const color = EVENT_TYPE_COLORS[event.event_type] ?? C.textTertiary;
          const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;

          return (
            <div
              key={event.event_id}
              data-testid={`event-${event.event_id}`}
              style={{
                position: 'relative',
                marginBottom: 16,
                background: C.cardBg,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 10,
                padding: '16px 20px',
                fontFamily: BODY,
              }}
            >
              {/* Timeline dot */}
              <div
                style={{
                  position: 'absolute',
                  left: -27,
                  top: 20,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: color,
                  border: `2px solid ${C.cardBg}`,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {label}
                    </span>
                    <span style={{ fontSize: 13, color: C.textSecondary }}>
                      {formatDate(event.event_date)}
                    </span>
                  </div>
                  {event.annual_salary != null && (
                    <div style={{ fontSize: 14, color: C.text }}>
                      Annual Salary: {formatCurrency(event.annual_salary)}
                    </div>
                  )}
                  {event.dept_code && (
                    <div style={{ fontSize: 13, color: C.textSecondary }}>
                      Department: {event.dept_code}
                    </div>
                  )}
                  {event.separation_reason && (
                    <div style={{ fontSize: 13, color: C.textSecondary }}>
                      Reason: {event.separation_reason}
                    </div>
                  )}
                </div>

                {onFlagIssue && (
                  <button
                    data-testid={`flag-event-${event.event_id}`}
                    onClick={() =>
                      onFlagIssue({
                        entityType: 'employment_event',
                        entityId: String(event.event_id),
                        label: `${label} — ${formatDate(event.event_date)}`,
                        currentValue: JSON.stringify(event),
                      })
                    }
                    style={{
                      fontFamily: BODY,
                      fontSize: 12,
                      color: C.coral,
                      background: C.coralLight,
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    Flag Issue
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
