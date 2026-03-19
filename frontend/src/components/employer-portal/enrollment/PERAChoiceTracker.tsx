import { C } from '@/lib/designSystem';
import { usePERAChoicePending, useElectPERAChoice } from '@/hooks/useEmployerEnrollment';
import { useState } from 'react';
import type { PERAChoiceStatus } from '@/types/Employer';

interface PERAChoiceTrackerProps {
  orgId: string;
}

const STATUS_BADGE: Record<PERAChoiceStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: C.goldLight, text: C.gold, label: 'Pending Election' },
  ELECTED_DC: { bg: C.skyLight, text: C.sky, label: 'Elected DC' },
  DEFAULTED_DB: { bg: C.border, text: C.textSecondary, label: 'Defaulted to DB' },
  WAIVED: { bg: C.sageLight, text: C.sage, label: 'Chose DB' },
  INELIGIBLE: { bg: C.border, text: C.textSecondary, label: 'Ineligible' },
};

function daysRemaining(windowCloses: string): number {
  const closes = new Date(windowCloses + 'T23:59:59');
  const now = new Date();
  const diff = closes.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function PERAChoiceTracker({ orgId }: PERAChoiceTrackerProps) {
  const { data: result, isLoading } = usePERAChoicePending(orgId);
  const electMutation = useElectPERAChoice();
  const [error, setError] = useState<string | null>(null);

  const elections = result?.items ?? [];
  const total = result?.pagination?.total ?? 0;

  const handleElect = async (id: string, plan: 'DB' | 'DC') => {
    setError(null);
    try {
      await electMutation.mutateAsync({ id, plan });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record election');
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: C.textSecondary, fontSize: 14 }}>
        Loading PERAChoice elections...
      </div>
    );
  }

  if (total === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: C.textSecondary,
          fontSize: 14,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.border}`,
        }}
      >
        No pending PERAChoice elections.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text }}>
          PERAChoice Elections
        </h3>
        <span style={{ fontSize: 13, color: C.textSecondary }}>
          {total} pending {total === 1 ? 'election' : 'elections'}
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: C.coralLight,
            color: C.coral,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {elections.map((election) => {
        const status = election.electionStatus as PERAChoiceStatus;
        const badge = STATUS_BADGE[status];
        const remaining = daysRemaining(election.windowCloses);
        const isUrgent = remaining <= 7;

        return (
          <div
            key={election.id}
            style={{
              padding: 16,
              background: C.cardBg,
              border: `1px solid ${isUrgent ? C.coral : C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>
                  Hire date: {election.hireDate}
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>
                  Window: {election.windowOpens} to {election.windowCloses}
                </div>
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
              >
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: badge.bg,
                    color: badge.text,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {badge.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isUrgent ? 600 : 400,
                    color: isUrgent ? C.coral : C.textSecondary,
                  }}
                >
                  {remaining > 0 ? `${remaining} days remaining` : 'Window expired'}
                </span>
              </div>
            </div>

            {status === 'PENDING' && remaining > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleElect(election.id, 'DC')}
                  disabled={electMutation.isPending}
                  style={{
                    padding: '6px 14px',
                    background: C.sky,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Elect DC Plan
                </button>
                <button
                  onClick={() => handleElect(election.id, 'DB')}
                  disabled={electMutation.isPending}
                  style={{
                    padding: '6px 14px',
                    background: C.sage,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Keep DB Plan
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.textSecondary }}>
              {election.dcTeamNotified && <span>DC Team notified</span>}
              {election.memberAcknowledged && <span>Member acknowledged</span>}
              {election.reminderSentAt && <span>Reminder sent</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
