import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { formatCurrency } from '../MemberPortalUtils';

// ── Types ───────────────────────────────────────────────────────────────────

type ClaimStage = 'notify' | 'documents' | 'review' | 'staff_review' | 'payments_begin';

export interface SurvivorClaim {
  id: string;
  retiree_name: string;
  current_stage: ClaimStage;
  estimated_survivor_benefit: number;
  payment_option_label: string;
  submitted_at: string;
  required_documents: DocumentItem[];
}

interface DocumentItem {
  id: string;
  label: string;
  required: boolean;
  status: 'not_submitted' | 'received' | 'under_review' | 'approved';
}

// ── Props ───────────────────────────────────────────────────────────────────

interface SurvivorClaimViewProps {
  claim: SurvivorClaim;
}

// ── Stage definitions ───────────────────────────────────────────────────────

const STAGES: { key: ClaimStage; label: string }[] = [
  { key: 'notify', label: 'Notification Received' },
  { key: 'documents', label: 'Documents Required' },
  { key: 'review', label: 'Under Review' },
  { key: 'staff_review', label: 'Staff Review' },
  { key: 'payments_begin', label: 'Payments Begin' },
];

function stageIndex(stage: ClaimStage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SurvivorClaimView({ claim }: SurvivorClaimViewProps) {
  const currentIdx = stageIndex(claim.current_stage);

  return (
    <div
      data-testid="survivor-claim-view"
      style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: BODY }}
    >
      {/* ── Claim Header ──────────────────────────────────────────────── */}
      <div>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 24,
            fontWeight: 700,
            color: C.navy,
            margin: '0 0 4px',
          }}
        >
          Survivor Benefit Claim
        </h2>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
          Following the passing of {claim.retiree_name}, your survivor benefit claim is being
          processed.
        </p>
      </div>

      {/* ── Estimated Benefit ─────────────────────────────────────────── */}
      <div
        data-testid="estimated-benefit"
        style={{
          background: C.cardBgWarm,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: C.textTertiary,
            marginBottom: 4,
          }}
        >
          Estimated Monthly Survivor Benefit
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 28,
            fontWeight: 700,
            color: C.navy,
            marginBottom: 4,
          }}
        >
          {formatCurrency(claim.estimated_survivor_benefit)}/mo
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary }}>
          Based on {claim.retiree_name}&apos;s {claim.payment_option_label} payment option
        </div>
      </div>

      {/* ── Stage Tracker ─────────────────────────────────────────────── */}
      <div data-testid="stage-tracker">
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 16px',
          }}
        >
          Claim Progress
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {STAGES.map((stage, idx) => {
            const isComplete = idx < currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div
                key={stage.key}
                data-testid={`stage-${stage.key}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderLeft: `2px solid ${isComplete ? C.sage : isCurrent ? C.navy : C.borderLight}`,
                  paddingLeft: 20,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -7,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: isComplete ? C.sage : isCurrent ? C.navy : C.borderLight,
                    border: `2px solid ${isComplete ? C.sage : isCurrent ? C.navy : C.border}`,
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: isCurrent ? 600 : 400,
                    color: isComplete ? C.sage : isCurrent ? C.navy : C.textTertiary,
                  }}
                >
                  {stage.label}
                  {isComplete && ' \u2713'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Document Checklist ─────────────────────────────────────────── */}
      <div data-testid="document-checklist">
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 12px',
          }}
        >
          Required Documents
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {claim.required_documents.map((doc) => (
            <div
              key={doc.id}
              data-testid={`doc-${doc.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                background: C.cardBg,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DocumentStatusIcon status={doc.status} />
                <span style={{ fontSize: 14, color: C.text }}>{doc.label}</span>
                {doc.required && (
                  <span style={{ fontSize: 11, color: C.coral, fontWeight: 600 }}>Required</span>
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: doc.status === 'approved' ? C.sage : C.textTertiary,
                  textTransform: 'capitalize',
                }}
              >
                {doc.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentStatusIcon({ status }: { status: DocumentItem['status'] }) {
  const color =
    status === 'approved'
      ? C.sage
      : status === 'received' || status === 'under_review'
        ? C.gold
        : C.borderLight;
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
