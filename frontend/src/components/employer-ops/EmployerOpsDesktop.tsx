import { useState, useMemo } from 'react';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { usePortalOrganizations } from '@/hooks/useCRM';
import { useEmployerAlerts } from '@/hooks/useEmployerOps';
import type { EmployerOpsTab, EmployerAlert } from '@/types/EmployerOps';
import OrgBanner from './OrgBanner';
import HealthTab from './tabs/HealthTab';
import CasesTab from './tabs/CasesTab';
import CRMTab from './tabs/CRMTab';
import CorrespondenceTab from './tabs/CorrespondenceTab';
import MembersTab from './tabs/MembersTab';

const TABS: { key: EmployerOpsTab; label: string }[] = [
  { key: 'health', label: 'Health' },
  { key: 'cases', label: 'Cases' },
  { key: 'crm', label: 'CRM' },
  { key: 'correspondence', label: 'Correspondence' },
  { key: 'members', label: 'Members' },
];

const SEVERITY_BORDER: Record<EmployerAlert['severity'], string> = {
  critical: C.coral,
  warning: C.gold,
  info: C.sky,
};

export default function EmployerOpsDesktop() {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [activeTab, setActiveTab] = useState<EmployerOpsTab>('health');

  const { data: orgs } = usePortalOrganizations();

  const orgIds = useMemo(() => (orgs ?? []).map((o) => o.orgId), [orgs]);
  const orgNames = useMemo(
    () =>
      (orgs ?? []).reduce<Record<string, string>>((acc, o) => {
        acc[o.orgId] = o.orgName;
        return acc;
      }, {}),
    [orgs],
  );

  const { alerts } = useEmployerAlerts(orgIds, orgNames);

  // Count alerts per org for badges
  const alertCountByOrg = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of alerts) {
      counts[a.orgId] = (counts[a.orgId] ?? 0) + 1;
    }
    return counts;
  }, [alerts]);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: C.pageBg,
        fontFamily: BODY,
      }}
    >
      {/* ── Left Panel: Alert Queue ─────────────────────────────────────── */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          background: C.cardBg,
          overflowY: 'auto',
        }}
      >
        {/* Title */}
        <div style={{ padding: '20px 16px 12px' }}>
          <h1
            style={{
              fontFamily: DISPLAY,
              fontSize: 20,
              fontWeight: 700,
              color: C.navy,
              margin: 0,
            }}
          >
            Employer Ops
          </h1>
        </div>

        {/* Alerts section */}
        <div style={{ padding: '0 16px 16px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            Alerts ({alerts.length})
          </div>
          {alerts.length === 0 && (
            <div style={{ fontSize: 13, color: C.textTertiary, padding: '8px 0' }}>
              No active alerts
            </div>
          )}
          {alerts.map((alert, i) => (
            <button
              key={`${alert.orgId}-${alert.type}-${i}`}
              onClick={() => setSelectedOrgId(alert.orgId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                marginBottom: 4,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                borderLeft: `3px solid ${SEVERITY_BORDER[alert.severity]}`,
                background: selectedOrgId === alert.orgId ? C.sageLight : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 2,
                }}
              >
                {alert.orgName}
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary }}>{alert.message}</div>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.border, margin: '0 16px' }} />

        {/* All Employers section */}
        <div style={{ padding: '16px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            All Employers
          </div>
          {(orgs ?? []).map((org) => {
            const count = alertCountByOrg[org.orgId] ?? 0;
            return (
              <button
                key={org.orgId}
                onClick={() => setSelectedOrgId(org.orgId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  marginBottom: 2,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedOrgId === org.orgId ? C.sageLight : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 13, color: C.text }}>{org.orgName}</span>
                {count > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.coral,
                      background: C.coralMuted,
                      borderRadius: 10,
                      padding: '2px 7px',
                      minWidth: 20,
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel: Content ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedOrgId ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p style={{ fontSize: 15, color: C.textTertiary }}>
              Select an employer from the left panel
            </p>
          </div>
        ) : (
          <>
            {/* Org banner */}
            <OrgBanner orgId={selectedOrgId} />

            {/* Tab bar */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderBottom: `1px solid ${C.border}`,
                background: C.cardBg,
                padding: '0 24px',
              }}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: BODY,
                    color: activeTab === tab.key ? C.navy : C.textSecondary,
                    background: 'transparent',
                    border: 'none',
                    borderBottom:
                      activeTab === tab.key ? `2px solid ${C.sage}` : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, padding: 24 }}>
              {activeTab === 'health' && <HealthTab orgId={selectedOrgId} />}
              {activeTab === 'cases' && <CasesTab orgId={selectedOrgId} />}
              {activeTab === 'crm' && <CRMTab orgId={selectedOrgId} />}
              {activeTab === 'correspondence' && <CorrespondenceTab orgId={selectedOrgId} />}
              {activeTab === 'members' && <MembersTab orgId={selectedOrgId} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
