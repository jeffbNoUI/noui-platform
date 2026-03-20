import { useState, useMemo, useCallback, useEffect } from 'react';
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

  const { data: orgs, isLoading: orgsLoading } = usePortalOrganizations();

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

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!orgs?.length) return;
      const currentIdx = orgs.findIndex((o) => o.orgId === selectedOrgId);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = currentIdx < orgs.length - 1 ? currentIdx + 1 : 0;
        setSelectedOrgId(orgs[nextIdx].orgId);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : orgs.length - 1;
        setSelectedOrgId(orgs[prevIdx].orgId);
      } else if (e.key === 'Escape') {
        setSelectedOrgId('');
      }
    },
    [orgs, selectedOrgId],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
          {orgsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    padding: '8px 12px',
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      height: 14,
                      borderRadius: 4,
                      background: C.border,
                      width: `${60 + (i % 3) * 15}%`,
                    }}
                  />
                </div>
              ))
            : (orgs ?? []).map((org) => {
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
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: C.sageLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              🏢
            </div>
            <p style={{ fontSize: 15, color: C.textSecondary, fontWeight: 500, margin: 0 }}>
              Select an employer from the left panel
            </p>
            <p style={{ fontSize: 13, color: C.textTertiary, margin: 0 }}>
              Use arrow keys to navigate, Escape to deselect
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

            {/* Tab content — key by orgId to reset local state on org switch */}
            <div key={selectedOrgId} style={{ flex: 1, padding: 24 }}>
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
