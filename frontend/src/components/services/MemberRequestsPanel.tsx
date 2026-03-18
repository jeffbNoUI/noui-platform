import { useState } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useMemberRequests, useResolveRequest } from '@/hooks/useMemberRequests';
import type {
  MemberRequestItem,
  RequestPriority,
  ResolutionAction,
} from '@/hooks/useMemberRequests';
import RequestDetailPanel from './RequestDetailPanel';

// ── Component ────────────────────────────────────────────────────────────────

export default function MemberRequestsPanel() {
  const { data: requests = [], isLoading } = useMemberRequests();
  const resolveRequest = useResolveRequest();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRequest = requests.find((r) => r.id === selectedId);

  const handleResolve = (action: ResolutionAction, staffNote: string) => {
    if (!selectedId) return;
    resolveRequest.mutate(
      { requestId: selectedId, payload: { action, staff_note: staffNote } },
      { onSuccess: () => setSelectedId(null) },
    );
  };

  if (isLoading) {
    return (
      <div data-testid="member-requests-panel" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading member requests...
      </div>
    );
  }

  return (
    <div data-testid="member-requests-panel" style={{ fontFamily: BODY }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.navy,
            fontFamily: DISPLAY,
            margin: '0 0 4px',
          }}
        >
          Member Requests
        </h2>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0 }}>
          Review and resolve member-initiated change requests, data corrections, and beneficiary
          updates.
        </p>
      </div>

      {/* Summary badges */}
      <div data-testid="request-summary" style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Badge label="Total" count={requests.length} color={C.navy} bg={C.cardBg} />
        <Badge
          label="Urgent"
          count={requests.filter((r) => r.priority === 'urgent').length}
          color={C.coral}
          bg={C.coralLight}
        />
        <Badge
          label="High"
          count={requests.filter((r) => r.priority === 'high').length}
          color={C.gold}
          bg={C.goldLight}
        />
      </div>

      {/* Split layout: queue left, detail right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedRequest ? '1fr 1fr' : '1fr',
          gap: 20,
        }}
      >
        {/* Queue list */}
        <div>
          {requests.length === 0 ? (
            <div
              data-testid="empty-queue"
              style={{
                background: C.cardBg,
                border: `1px solid ${C.borderLight}`,
                borderRadius: 10,
                padding: '40px 20px',
                textAlign: 'center',
                color: C.textSecondary,
                fontSize: 14,
              }}
            >
              No pending requests. All caught up!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requests.map((req) => (
                <RequestRow
                  key={req.id}
                  request={req}
                  selected={req.id === selectedId}
                  onClick={() => setSelectedId(req.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedRequest && (
          <div
            style={{
              background: C.cardBg,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              padding: 24,
            }}
          >
            <RequestDetailPanel
              request={selectedRequest}
              onResolve={handleResolve}
              onClose={() => setSelectedId(null)}
              resolving={resolveRequest.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── RequestRow ───────────────────────────────────────────────────────────────

function RequestRow({
  request,
  selected,
  onClick,
}: {
  request: MemberRequestItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      data-testid={`request-row-${request.id}`}
      onClick={onClick}
      style={{
        background: selected ? C.sageLight : C.cardBg,
        border: `1px solid ${selected ? C.sage : C.borderLight}`,
        borderRadius: 10,
        padding: '14px 18px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PriorityBadge priority={request.priority} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.navy, fontFamily: BODY }}>
            {request.field_name}
          </span>
        </div>
        <span style={{ fontSize: 12, color: C.textTertiary }}>
          {new Date(request.created_at).toLocaleDateString()}
        </span>
      </div>
      {request.member_name && (
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4 }}>
          {request.member_name}
        </div>
      )}
      <div style={{ fontSize: 13, color: C.text }}>
        {request.reason.length > 80 ? request.reason.slice(0, 80) + '...' : request.reason}
      </div>
    </div>
  );
}

// ── PriorityBadge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: RequestPriority }) {
  const styles: Record<RequestPriority, { color: string; bg: string }> = {
    urgent: { color: C.coral, bg: C.coralLight },
    high: { color: C.gold, bg: C.goldLight },
    standard: { color: C.textTertiary, bg: C.cardBg },
  };
  const s = styles[priority];
  return (
    <span
      data-testid={`priority-${priority}`}
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '2px 8px',
        borderRadius: 10,
        background: s.bg,
        color: s.color,
        fontFamily: BODY,
      }}
    >
      {priority}
    </span>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

function Badge({
  label,
  count,
  color,
  bg,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 8,
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color, fontFamily: DISPLAY }}>{count}</span>
      <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: BODY }}>{label}</span>
    </div>
  );
}
