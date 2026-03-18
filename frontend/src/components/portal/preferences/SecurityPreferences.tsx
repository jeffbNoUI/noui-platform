import { C, BODY } from '@/lib/designSystem';

interface SecurityPreferencesProps {
  memberId: string;
}

// Clerk URLs for account management — actual paths depend on Clerk configuration.
// In production these would be Clerk component URLs; for now we display status + link out.
const CLERK_ACCOUNT_URL = '/user';

export default function SecurityPreferences({ memberId: _memberId }: SecurityPreferencesProps) {
  return (
    <div data-testid="prefs-security">
      <p style={{ fontFamily: BODY, fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>
        Manage your account security settings. Authentication is managed through our secure identity
        provider.
      </p>

      {/* Password */}
      <div
        data-testid="security-password"
        style={{
          padding: 20,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4
              style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}
            >
              Password
            </h4>
            <p
              style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, margin: '4px 0 0' }}
            >
              Change your account password through our secure identity provider.
            </p>
          </div>
          <a
            href={CLERK_ACCOUNT_URL}
            data-testid="change-password-btn"
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              background: C.sage,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Change Password
          </a>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div
        data-testid="security-2fa"
        style={{
          padding: 20,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4
              style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}
            >
              Two-Factor Authentication
            </h4>
            <p
              style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, margin: '4px 0 0' }}
            >
              Add an extra layer of security to your account with two-factor authentication.
            </p>
          </div>
          <a
            href={CLERK_ACCOUNT_URL}
            data-testid="manage-2fa-btn"
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              background: 'transparent',
              color: C.sage,
              border: `1px solid ${C.sage}`,
              borderRadius: 6,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Manage 2FA
          </a>
        </div>
      </div>

      {/* Active Sessions */}
      <div
        data-testid="security-sessions"
        style={{
          padding: 20,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
          marginBottom: 16,
        }}
      >
        <h4
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            margin: '0 0 8px',
          }}
        >
          Active Sessions
        </h4>
        <p style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, margin: '0 0 12px' }}>
          View and manage your active login sessions. If you don&apos;t recognize a session, you can
          end it from your account management page.
        </p>
        <div
          data-testid="current-session"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            background: 'rgba(91, 138, 114, 0.08)',
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>🖥</span>
          <div>
            <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text }}>
              Current Session
            </div>
            <div style={{ fontFamily: BODY, fontSize: 12, color: C.textSecondary }}>
              This browser &middot; Active now
            </div>
          </div>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 600,
              color: C.sage,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(91, 138, 114, 0.12)',
            }}
          >
            Current
          </span>
        </div>
      </div>

      {/* Last Login */}
      <div
        data-testid="security-last-login"
        style={{
          padding: 20,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.borderLight}`,
        }}
      >
        <h4
          style={{
            fontFamily: BODY,
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            margin: '0 0 8px',
          }}
        >
          Account Activity
        </h4>
        <p style={{ fontFamily: BODY, fontSize: 13, color: C.textSecondary, margin: 0 }}>
          For detailed login history and security events, visit your account management page.
        </p>
      </div>
    </div>
  );
}
