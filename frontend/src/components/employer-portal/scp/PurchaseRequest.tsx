import { useState } from 'react';
import { C, BODY } from '@/lib/designSystem';
import {
  useSCPRequests,
  useCreateSCPRequest,
  useApproveSCPRequest,
  useDenySCPRequest,
  useCancelSCPRequest,
} from '@/hooks/useEmployerScp';
import type { SCPRequest, SCPServiceType, SCPRequestStatus } from '@/types/Employer';

interface PurchaseRequestProps {
  orgId: string;
}

const SERVICE_TYPE_LABELS: Record<SCPServiceType, string> = {
  REFUNDED_PRIOR_PERA: 'Refunded Prior PERA',
  MILITARY_USERRA: 'Military (USERRA)',
  PRIOR_PUBLIC_EMPLOYMENT: 'Prior Public Employment',
  LEAVE_OF_ABSENCE: 'Leave of Absence',
  PERACHOICE_TRANSFER: 'PERAChoice Transfer',
};

const STATUS_COLORS: Record<SCPRequestStatus, string> = {
  DRAFT: '#6b7280',
  QUOTED: '#3b82f6',
  PENDING_DOCS: '#f59e0b',
  UNDER_REVIEW: '#8b5cf6',
  APPROVED: '#10b981',
  PAYING: '#06b6d4',
  COMPLETED: '#059669',
  EXPIRED: '#9ca3af',
  DENIED: '#ef4444',
  CANCELLED: '#9ca3af',
};

const TIER_OPTIONS = [
  { value: 'TIER_1', label: 'Tier 1' },
  { value: 'TIER_2', label: 'Tier 2' },
  { value: 'TIER_3', label: 'Tier 3' },
];

export default function PurchaseRequest({ orgId }: PurchaseRequestProps) {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useSCPRequests(orgId, statusFilter || undefined);
  const createMutation = useCreateSCPRequest();
  const approveMutation = useApproveSCPRequest();
  const denyMutation = useDenySCPRequest();
  const cancelMutation = useCancelSCPRequest();

  const requests: SCPRequest[] = data?.items ?? [];

  // ─── Form state ────────────────────────────────────────────────────────────
  const [ssnHash, setSSNHash] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [tier, setTier] = useState('');
  const [yearsRequested, setYearsRequested] = useState('');

  const handleSubmit = async () => {
    if (!ssnHash || !firstName || !lastName || !serviceType || !tier || !yearsRequested) {
      return;
    }
    await createMutation.mutateAsync({
      orgId,
      ssnHash,
      firstName,
      lastName,
      serviceType,
      tier,
      yearsRequested,
    });
    setShowForm(false);
    setSSNHash('');
    setFirstName('');
    setLastName('');
    setServiceType('');
    setTier('');
    setYearsRequested('');
  };

  const handleApprove = async (id: string) => {
    await approveMutation.mutateAsync(id);
  };

  const handleDeny = async (id: string) => {
    const reason = prompt('Reason for denial:');
    if (reason) {
      await denyMutation.mutateAsync({ id, reason });
    }
  };

  const handleCancel = async (id: string) => {
    if (confirm('Cancel this purchase request?')) {
      await cancelMutation.mutateAsync(id);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ fontFamily: BODY, fontSize: '18px', fontWeight: 600 }}>Purchase Requests</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="QUOTED">Quoted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PAYING">Paying</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '8px 16px',
              background: C.sage,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: BODY,
              fontWeight: 600,
            }}
          >
            {showForm ? 'Cancel' : 'New Request'}
          </button>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            padding: '16px',
            background: C.cardBg,
            borderRadius: '8px',
            border: `1px solid ${C.border}`,
            marginBottom: '16px',
          }}
        >
          <h3 style={{ fontFamily: BODY, fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
            New Purchase Request
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <label style={{ fontFamily: BODY }}>
              SSN (hashed)
              <input
                value={ssnHash}
                onChange={(e) => setSSNHash(e.target.value)}
                style={inputStyle}
                placeholder="SSN hash"
              />
            </label>
            <label style={{ fontFamily: BODY }}>
              First Name
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ fontFamily: BODY }}>
              Last Name
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ fontFamily: BODY }}>
              Service Type
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select…</option>
                {Object.entries(SERVICE_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontFamily: BODY }}>
              Tier
              <select value={tier} onChange={(e) => setTier(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontFamily: BODY }}>
              Years Requested
              <input
                value={yearsRequested}
                onChange={(e) => setYearsRequested(e.target.value)}
                style={inputStyle}
                placeholder="e.g. 5.00"
              />
            </label>
          </div>

          {/* Exclusion flag notice */}
          <div
            style={{
              padding: '10px 14px',
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              marginBottom: '12px',
              fontFamily: BODY,
              fontSize: '13px',
            }}
          >
            Purchased service credit contributes to benefit calculation only. It does NOT count
            toward Rule of 75/85, IPR, or vesting. These exclusion flags are set automatically and
            cannot be changed.
          </div>

          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            style={{
              padding: '8px 20px',
              background: C.sage,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: BODY,
              fontWeight: 600,
            }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Request'}
          </button>
        </div>
      )}

      {isLoading && <p style={{ fontFamily: BODY }}>Loading…</p>}

      {!isLoading && requests.length === 0 && (
        <p style={{ fontFamily: BODY, color: C.textSecondary }}>No purchase requests found.</p>
      )}

      {requests.map((req) => (
        <div
          key={req.id}
          style={{
            padding: '14px 16px',
            background: C.cardBg,
            borderRadius: '8px',
            border: `1px solid ${C.border}`,
            marginBottom: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontFamily: BODY, fontWeight: 600 }}>
                {req.firstName} {req.lastName}
              </span>
              <span style={{ fontFamily: BODY, color: C.textSecondary, marginLeft: '12px' }}>
                {SERVICE_TYPE_LABELS[req.serviceType] ?? req.serviceType}
              </span>
              <span style={{ fontFamily: BODY, color: C.textSecondary, marginLeft: '12px' }}>
                {req.yearsRequested} yrs
              </span>
              {req.totalCost && (
                <span style={{ fontFamily: BODY, fontWeight: 600, marginLeft: '12px' }}>
                  ${req.totalCost}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: BODY,
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: '#fff',
                  background: STATUS_COLORS[req.requestStatus] ?? C.border,
                }}
              >
                {req.requestStatus}
              </span>
              {req.requestStatus === 'UNDER_REVIEW' && (
                <>
                  <button onClick={() => handleApprove(req.id)} style={actionBtnStyle}>
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(req.id)}
                    style={{ ...actionBtnStyle, color: C.coral }}
                  >
                    Deny
                  </button>
                </>
              )}
              {['DRAFT', 'QUOTED', 'PENDING_DOCS'].includes(req.requestStatus) && (
                <button
                  onClick={() => handleCancel(req.id)}
                  style={{ ...actionBtnStyle, color: C.textSecondary }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '4px',
  padding: '8px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  fontSize: '14px',
  background: C.pageBg,
};

const actionBtnStyle: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: '13px',
  fontWeight: 600,
  padding: '4px 10px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: C.sage,
};
