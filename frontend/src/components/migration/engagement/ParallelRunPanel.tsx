import { useState } from 'react';
import { C, BODY, MONO } from '@/lib/designSystem';
import { PANEL_HEADING } from '../panelStyles';
import {
  useReconciliationSummary,
  useP1Issues,
  useCertification,
  useCertifyEngagement,
} from '@/hooks/useMigrationApi';

interface Props {
  engagementId: string;
  onCertifyComplete?: () => void;
}

interface ChecklistItem {
  key: string;
  label: string;
  auto: boolean;
}

const CHECKLIST: ChecklistItem[] = [
  { key: 'recon_score', label: 'Weighted reconciliation \u2265 95%', auto: true },
  { key: 'p1_resolved', label: 'Zero unresolved P1 items', auto: true },
  { key: 'parallel_duration', label: 'Parallel run duration \u2265 2 pay periods', auto: false },
  { key: 'stakeholder_signoff', label: 'Stakeholder sign-off obtained', auto: false },
  { key: 'rollback_plan', label: 'Rollback plan documented', auto: false },
];

export default function ParallelRunPanel({ engagementId, onCertifyComplete }: Props) {
  const { data: reconSummary } = useReconciliationSummary(engagementId);
  const { data: p1Issues } = useP1Issues(engagementId);
  const { data: existingCert } = useCertification(engagementId);
  const certifyMutation = useCertifyEngagement();

  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({
    parallel_duration: false,
    stakeholder_signoff: false,
    rollback_plan: false,
  });
  const [prevCertId, setPrevCertId] = useState<string | null>(null);
  const [certifyError, setCertifyError] = useState<string | null>(null);
  const [certifySuccess, setCertifySuccess] = useState(false);

  // Restore manual check states from existing certification (replaces useEffect)
  const certId = existingCert
    ? (((existingCert as Record<string, unknown>).id as string) ?? 'exists')
    : null;
  if (certId && certId !== prevCertId) {
    setPrevCertId(certId);
    const checklist = (existingCert as Record<string, unknown>).checklist_json as
      | Record<string, boolean>
      | undefined;
    if (checklist) {
      setManualChecks((prev) => ({
        ...prev,
        parallel_duration: checklist.parallel_duration ?? prev.parallel_duration,
        stakeholder_signoff: checklist.stakeholder_signoff ?? prev.stakeholder_signoff,
        rollback_plan: checklist.rollback_plan ?? prev.rollback_plan,
      }));
    }
  }

  const isCertified = !!existingCert;

  // Auto-computed checks
  const gateScore = reconSummary?.gate_score ?? 0;
  const p1Count = p1Issues?.filter((i) => !i.resolved).length ?? 0;
  const autoChecks: Record<string, boolean> = {
    recon_score: gateScore >= 0.95,
    p1_resolved: p1Count === 0,
  };

  const allChecked = CHECKLIST.every((item) =>
    item.auto ? autoChecks[item.key] : manualChecks[item.key],
  );

  const toggleManual = (key: string) => {
    if (isCertified) return;
    setManualChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCertify = () => {
    setCertifyError(null);
    const checklist: Record<string, boolean> = { ...autoChecks, ...manualChecks };
    certifyMutation.mutate(
      {
        engagementId,
        body: {
          gate_score: gateScore,
          p1_count: p1Count,
          checklist,
        },
      },
      {
        onSuccess: () => {
          setCertifySuccess(true);
          onCertifyComplete?.();
        },
        onError: (err) => {
          setCertifyError(err.message || 'Certification failed');
        },
      },
    );
  };

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Already-certified banner */}
      {isCertified && (
        <div
          style={{
            background: C.sageLight,
            border: `1px solid ${C.sage}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: C.sage,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          Already Certified
          {!!(existingCert as Record<string, unknown>).certified_by && (
            <span style={{ fontWeight: 400, marginLeft: 8 }}>
              by {String((existingCert as Record<string, unknown>).certified_by)}
            </span>
          )}
          {!!(existingCert as Record<string, unknown>).certified_at && (
            <span style={{ fontWeight: 400, marginLeft: 8 }}>
              on{' '}
              {new Date(
                String((existingCert as Record<string, unknown>).certified_at),
              ).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* Status card */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: 20,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: C.goldLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={C.gold} strokeWidth="2" />
            <path d="M12 6V12L16 14" stroke={C.gold} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h3
            style={{
              ...PANEL_HEADING,
              margin: 0,
            }}
          >
            Parallel Run
          </h3>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: '4px 0 0' }}>
            {isCertified
              ? 'Parallel run certification complete.'
              : 'Parallel run not yet started. Complete the Go/No-Go checklist below to certify.'}
          </p>
        </div>
      </div>

      {/* Go/No-Go Checklist */}
      <div
        style={{
          background: C.cardBg,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <h3
            style={{
              ...PANEL_HEADING,
              margin: 0,
            }}
          >
            Go / No-Go Checklist
          </h3>
        </div>

        <div>
          {CHECKLIST.map((item) => {
            const isChecked = item.auto ? autoChecks[item.key] : manualChecks[item.key];
            const isAuto = item.auto;
            const isDisabled = isAuto || isCertified;

            return (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: `1px solid ${C.borderLight}`,
                  cursor: isDisabled ? 'default' : 'pointer',
                  background: isChecked ? C.sageLight : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => !isDisabled && toggleManual(item.key)}
                  disabled={isDisabled}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: C.sage,
                    cursor: isDisabled ? 'default' : 'pointer',
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: isChecked ? C.sage : C.text,
                    flex: 1,
                  }}
                >
                  {item.label}
                </span>
                {/* Show actual value for auto-checks */}
                {item.key === 'recon_score' && (
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: MONO,
                      fontWeight: 600,
                      color: gateScore >= 0.95 ? C.sage : C.coral,
                    }}
                  >
                    {(gateScore * 100).toFixed(1)}%
                  </span>
                )}
                {item.key === 'p1_resolved' && (
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: MONO,
                      fontWeight: 600,
                      color: p1Count === 0 ? C.sage : C.coral,
                    }}
                  >
                    {p1Count} unresolved
                  </span>
                )}
                {isAuto && (
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textTertiary,
                      fontWeight: 500,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.04em',
                    }}
                  >
                    Auto
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Info note */}
      <div
        style={{
          background: C.hintBg,
          border: `1px solid ${C.hintBorder}`,
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
          color: C.textSecondary,
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        CDC sync and continuous comparison will be available in a future release. For now, parallel
        run verification is manual.
      </div>

      {/* Success/Error feedback */}
      {certifySuccess && !isCertified && (
        <div
          style={{
            background: C.sageLight,
            border: `1px solid ${C.sage}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: C.sage,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          Certification recorded successfully.
        </div>
      )}
      {certifyError && (
        <div
          style={{
            background: '#FEF2F2',
            border: `1px solid ${C.coral}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: C.coral,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          {certifyError}
        </div>
      )}

      {/* Certify button */}
      <button
        onClick={handleCertify}
        disabled={!allChecked || isCertified || certifyMutation.isPending}
        style={{
          padding: '12px 28px',
          borderRadius: 8,
          border: 'none',
          background: allChecked && !isCertified ? C.sage : C.border,
          color: C.textOnDark,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: BODY,
          cursor: allChecked && !isCertified ? 'pointer' : 'not-allowed',
          width: '100%',
        }}
      >
        {certifyMutation.isPending
          ? 'Certifying...'
          : isCertified
            ? 'Already Certified'
            : 'Certify Complete'}
      </button>
    </div>
  );
}
