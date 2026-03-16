import { C, DISPLAY, BODY, MONO } from '@/lib/designSystem';

interface MemberPortalHeaderProps {
  navTabs: { key: string; label: string }[];
  activeView: string;
  setActiveView: (view: string) => void;
  showChat: boolean;
  setShowChat: (fn: (prev: boolean) => boolean) => void;
  onSwitchToWorkspace: () => void;
  onSwitchToCRM: () => void;
  fullName: string;
  memberId: string;
  firstName: string;
  lastName: string;
}

export default function MemberPortalHeader({
  navTabs,
  activeView,
  setActiveView,
  showChat,
  setShowChat,
  onSwitchToWorkspace,
  onSwitchToCRM,
  fullName,
  memberId,
  firstName,
  lastName,
}: MemberPortalHeaderProps) {
  return (
    <div
      style={{
        background: 'rgba(248, 247, 244, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 30,
        padding: '0 32px',
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 60,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              N
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.navy,
                  letterSpacing: '-0.3px',
                  fontFamily: DISPLAY,
                  lineHeight: 1.1,
                }}
              >
                NoUI
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: C.textTertiary,
                  letterSpacing: '1.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase' as const,
                }}
              >
                Pension Services
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 28, background: C.border, margin: '0 4px' }} />

          <div style={{ display: 'flex', gap: 2 }}>
            {navTabs.map((tab) => (
              <button
                key={tab.key}
                className={`portal-nav-btn ${activeView === tab.key ? 'active' : ''}`}
                onClick={() => setActiveView(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onSwitchToWorkspace}
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              background: 'transparent',
              color: C.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
              transition: 'all 0.2s ease',
            }}
          >
            Agent Workspace
          </button>
          <button
            onClick={onSwitchToCRM}
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              background: 'transparent',
              color: C.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
              transition: 'all 0.2s ease',
            }}
          >
            CRM
          </button>
          <button
            onClick={() => setShowChat((c) => !c)}
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: `1.5px solid ${showChat ? C.sage : C.border}`,
              background: showChat ? C.sageLight : 'transparent',
              color: showChat ? C.sage : C.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 14 }}>&#x1F4AC;</span> Ask NoUI
          </button>
          <div style={{ width: 1, height: 24, background: C.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${C.goldLight}, ${C.sageLight})`,
                border: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: C.navy,
              }}
            >
              {firstName[0]}
              {lastName[0]}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{fullName}</div>
              <div style={{ fontSize: 10, fontFamily: MONO, color: C.textTertiary }}>
                {memberId}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
