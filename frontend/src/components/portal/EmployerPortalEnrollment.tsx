import { DISPLAY, BODY } from '@/lib/designSystem';
import { Organization } from '@/types/CRM';
import { EC, fmtDate } from './EmployerPortalConstants';

interface EmployerPortalEnrollmentProps {
  org: Organization | undefined;
}

export default function EmployerPortalEnrollment({ org }: EmployerPortalEnrollmentProps) {
  return (
    <div>
      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: 'Active Members',
            value: String(org?.memberCount ?? 142),
            sub: 'Currently enrolled',
          },
          { label: 'Pending Actions', value: '0', sub: 'No pending enrollments' },
          {
            label: 'Last Update',
            value: org?.lastContributionDate ? fmtDate(org.lastContributionDate) : '\u2014',
            sub: 'Most recent roster change',
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: EC.cardBg,
              border: `1px solid ${EC.border}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: EC.textTertiary,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                fontWeight: 600,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: EC.navy,
                fontFamily: DISPLAY,
                marginTop: 4,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: EC.textSecondary, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div
        style={{
          background: EC.cardBg,
          border: `1px solid ${EC.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${EC.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: EC.navy }}>
            Enrollment Actions
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {[
            {
              label: 'New Hire Enrollment',
              desc: 'Enroll a newly hired employee into the retirement plan',
              icon: '+',
            },
            {
              label: 'Termination / Separation',
              desc: 'Report an employee separation or retirement',
              icon: '\u2212',
            },
            {
              label: 'Status Change',
              desc: 'Update employment status, hours, or department',
              icon: '\u21c4',
            },
          ].map((action, idx) => (
            <button
              key={action.label}
              style={{
                padding: '24px 20px',
                textAlign: 'left' as const,
                border: 'none',
                borderRight: idx < 2 ? `1px solid ${EC.borderLight}` : 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: BODY,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = EC.accentLight;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: EC.accentLight,
                  border: `1px solid ${EC.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: EC.accent,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {action.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: EC.navy }}>{action.label}</div>
              <div
                style={{
                  fontSize: 12,
                  color: EC.textSecondary,
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                {action.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: '12px 16px',
          borderRadius: 8,
          background: EC.accentLight,
          border: `1px solid ${EC.border}`,
          fontSize: 12,
          color: EC.textSecondary,
          textAlign: 'center',
        }}
      >
        Enrollment submissions are reviewed by plan staff within 2 business days.
      </div>
    </div>
  );
}
