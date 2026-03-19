import { C, BODY } from '@/lib/designSystem';
import { useCertificationHolds, useEscalateHold } from '@/hooks/useEmployerTerminations';
import type { CertificationHold as CertHold, HoldStatus } from '@/types/Employer';

interface CertificationHoldProps {
  orgId: string;
}

const STATUS_COLORS: Record<HoldStatus, string> = {
  PENDING: '#f59e0b',
  REMINDER_SENT: '#f97316',
  ESCALATED: '#ef4444',
  RESOLVED: '#10b981',
  CANCELLED: '#6b7280',
  EXPIRED: '#6b7280',
};

function HoldStatusBadge({ status }: { status: HoldStatus }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        background: STATUS_COLORS[status] || '#6b7280',
      }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function daysRemaining(expiresAt: string): number {
  const now = new Date();
  const exp = new Date(expiresAt);
  return Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function CertificationHoldPanel({ orgId }: CertificationHoldProps) {
  const { data, isLoading, error } = useCertificationHolds(orgId);
  const escalateHold = useEscalateHold();

  const holds: CertHold[] = (data as unknown as { items?: CertHold[] })?.items ?? [];

  if (isLoading) return <div style={{ padding: 20, color: C.textSecondary }}>Loading holds...</div>;
  if (error) return <div style={{ padding: 20, color: '#991b1b' }}>Failed to load holds</div>;
  if (holds.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.textSecondary, fontSize: 14 }}>
        No active certification holds
      </div>
    );
  }

  return (
    <div>
      <h3
        style={{ fontFamily: BODY, fontSize: 18, fontWeight: 600, marginBottom: 16, color: C.text }}
      >
        Certification Holds ({holds.length})
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {holds.map((hold) => (
          <div
            key={hold.id}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 16,
              background: hold.holdStatus === 'ESCALATED' ? '#fef2f2' : '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text }}>
                Hold for {hold.ssnHash.slice(0, 8)}...
              </span>
              <HoldStatusBadge status={hold.holdStatus} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                fontSize: 13,
                color: C.textSecondary,
              }}
            >
              <div>Reason: {hold.holdReason.replace(/_/g, ' ')}</div>
              <div>Days remaining: {daysRemaining(hold.expiresAt)}</div>
              <div>Created: {new Date(hold.createdAt).toLocaleDateString()}</div>
            </div>

            {['PENDING', 'REMINDER_SENT', 'ESCALATED'].includes(hold.holdStatus) && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                {hold.holdStatus !== 'ESCALATED' && (
                  <button
                    onClick={() => escalateHold.mutate(hold.id)}
                    disabled={escalateHold.isPending}
                    style={{
                      padding: '6px 14px',
                      fontSize: 12,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      background: '#fff',
                      cursor: 'pointer',
                      color: C.text,
                    }}
                  >
                    Escalate
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
