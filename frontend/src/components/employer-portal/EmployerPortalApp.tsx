import { useState } from 'react';
import { usePortalOrganizations, usePortalOrganization } from '@/hooks/useCRM';
import { useEmployerAlerts } from '@/hooks/useEmployerPortal';
import { C, BODY } from '@/lib/designSystem';
import OrgBanner from './layout/OrgBanner';
import AlertBanner from './layout/AlertBanner';
import PortalNav from './layout/PortalNav';
import type { EmployerTab } from './layout/PortalNav';
import EmployerDashboard from './dashboard/EmployerDashboard';
import TerminationForm from './terminations/TerminationForm';
import CertificationHoldPanel from './terminations/CertificationHold';
import DesignationDashboard from './waret/DesignationDashboard';
import CostQuote from './scp/CostQuote';
import PurchaseRequest from './scp/PurchaseRequest';
import PaymentTracker from './scp/PaymentTracker';

// ── Phase placeholders ──────────────────────────────────────────────────────

const PHASE_MAP: Partial<Record<EmployerTab, number>> = {
  communications: 2,
  reporting: 3,
  enrollment: 3,
};

function PhasePlaceholder({ tab, phase }: { tab: string; phase: number }) {
  return (
    <div
      style={{
        fontFamily: BODY,
        textAlign: 'center',
        padding: '80px 20px',
        color: C.textSecondary,
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>Coming Soon</div>
      <div style={{ fontSize: 15 }}>
        <strong>{tab}</strong> will be available in Phase {phase}.
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function EmployerPortalApp() {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [activeTab, setActiveTab] = useState<EmployerTab>('dashboard');

  const { data: organizations } = usePortalOrganizations();
  const orgList = organizations ?? [];
  const effectiveOrgId = selectedOrgId || (orgList.length > 0 ? orgList[0].orgId : '');
  const { data: org } = usePortalOrganization(effectiveOrgId);
  const { data: alerts } = useEmployerAlerts(effectiveOrgId);

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
  };

  return (
    <div style={{ fontFamily: BODY, background: C.pageBg, color: C.text, minHeight: '100vh' }}>
      {/* ═══ ORG SELECTOR ═══ */}
      <div
        style={{
          background: C.cardBg,
          borderBottom: `1px solid ${C.border}`,
          padding: '12px 32px',
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <label
            htmlFor="org-select"
            style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}
          >
            Organization:
          </label>
          <select
            id="org-select"
            value={effectiveOrgId}
            onChange={(e) => handleOrgChange(e.target.value)}
            style={{
              fontFamily: BODY,
              fontSize: 14,
              padding: '6px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              background: C.cardBg,
              color: C.text,
              minWidth: 280,
            }}
          >
            {orgList.map((o) => (
              <option key={o.orgId} value={o.orgId}>
                {o.orgName}
              </option>
            ))}
            {orgList.length === 0 && <option value="">No organizations</option>}
          </select>
        </div>
      </div>

      {/* ═══ ORG BANNER ═══ */}
      {org && <OrgBanner org={org} />}

      {/* ═══ ALERTS ═══ */}
      <AlertBanner alerts={alerts ?? []} />

      {/* ═══ TAB NAV ═══ */}
      <PortalNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ═══ CONTENT ═══ */}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 32px 60px' }}>
        {activeTab === 'dashboard' && <EmployerDashboard orgId={effectiveOrgId} />}

        {activeTab === 'terminations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <TerminationForm orgId={effectiveOrgId} />
            <CertificationHoldPanel orgId={effectiveOrgId} />
          </div>
        )}

        {activeTab === 'waret' && <DesignationDashboard orgId={effectiveOrgId} />}

        {activeTab === 'scp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <CostQuote orgId={effectiveOrgId} />
            <PurchaseRequest orgId={effectiveOrgId} />
            <PaymentTracker orgId={effectiveOrgId} />
          </div>
        )}

        {activeTab !== 'dashboard' &&
          activeTab !== 'terminations' &&
          activeTab !== 'waret' &&
          activeTab !== 'scp' &&
          PHASE_MAP[activeTab] !== undefined && (
            <PhasePlaceholder
              tab={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              phase={PHASE_MAP[activeTab]!}
            />
          )}
      </div>
    </div>
  );
}
