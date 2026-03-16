import { DISPLAY, BODY } from '@/lib/designSystem';
import { EC, PortalTab, ViewMode } from './EmployerPortalConstants';

interface PortalOrg {
  orgId: string;
  orgName: string;
  orgShortName?: string;
}

interface EmployerPortalNavProps {
  activeTab: PortalTab;
  onTabChange: (tab: PortalTab) => void;
  onChangeView: (mode: ViewMode) => void;
  effectiveOrgId: string;
  orgList: PortalOrg[];
  onOrgChange: (orgId: string) => void;
}

export default function EmployerPortalNav({
  activeTab,
  onTabChange,
  onChangeView,
  effectiveOrgId,
  orgList,
  onOrgChange,
}: EmployerPortalNavProps) {
  return (
    <div
      style={{
        background: EC.navy,
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              N
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: DISPLAY,
                  lineHeight: 1.1,
                }}
              >
                NoUI
              </div>
              <div
                style={{
                  fontSize: 8,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '1.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase' as const,
                }}
              >
                Employer Portal
              </div>
            </div>
          </div>

          <div
            style={{
              width: 1,
              height: 28,
              background: 'rgba(255,255,255,0.15)',
              margin: '0 4px',
            }}
          />

          <div style={{ display: 'flex', gap: 2 }}>
            {[
              { key: 'communications' as PortalTab, label: 'Communications' },
              { key: 'correspondence' as PortalTab, label: 'Correspondence' },
              { key: 'reporting' as PortalTab, label: 'Reporting' },
              { key: 'enrollment' as PortalTab, label: 'Enrollment' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  background: activeTab === tab.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: BODY,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => onChangeView('portal')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Member Portal
          </button>
          <button
            onClick={() => onChangeView('crm')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Staff CRM
          </button>

          {/* Org selector */}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
          <select
            value={effectiveOrgId}
            onChange={(e) => onOrgChange(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              fontFamily: BODY,
              cursor: 'pointer',
            }}
          >
            {orgList.map((o) => (
              <option key={o.orgId} value={o.orgId} style={{ color: '#000' }}>
                {o.orgShortName || o.orgName}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
