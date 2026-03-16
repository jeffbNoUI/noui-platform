import { DISPLAY } from '@/lib/designSystem';
import { EC } from './EmployerPortalConstants';

export default function EmployerPortalReporting() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        background: EC.cardBg,
        border: `1px solid ${EC.border}`,
        borderRadius: 12,
        padding: 48,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: EC.accentLight,
          border: `1px solid ${EC.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          marginBottom: 20,
        }}
      >
        {'\ud83d\udcca'}
      </div>
      <h2
        style={{
          fontFamily: DISPLAY,
          fontSize: 22,
          fontWeight: 700,
          color: EC.navy,
          marginBottom: 8,
        }}
      >
        Contribution Reporting
      </h2>
      <p
        style={{
          fontSize: 14,
          color: EC.textSecondary,
          maxWidth: 420,
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        Online contribution reporting is coming soon. You will be able to submit, track, and review
        contribution reports directly from this portal.
      </p>
      <div
        style={{
          padding: '8px 20px',
          borderRadius: 20,
          background: EC.accentLight,
          border: `1px solid ${EC.border}`,
          color: EC.accent,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Coming Soon
      </div>
    </div>
  );
}
