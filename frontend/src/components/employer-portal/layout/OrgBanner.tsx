import { C, BODY } from '@/lib/designSystem';
import type { Organization } from '@/types/CRM';

interface OrgBannerProps {
  org: Organization;
}

export default function OrgBanner({ org }: OrgBannerProps) {
  const stats = [
    { label: 'Members', value: org.memberCount ?? '—' },
    {
      label: 'Last Contribution',
      value: org.lastContributionDate ? formatDate(org.lastContributionDate) : '—',
    },
    { label: 'Reporting', value: org.reportingFrequency ?? '—' },
    { label: 'Status', value: org.employerStatus ?? '—' },
  ];

  return (
    <div
      style={{
        background: C.cardBgAccent,
        color: C.textOnDark,
        fontFamily: BODY,
        padding: '20px 32px',
      }}
    >
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{org.orgName}</h2>
        {org.orgShortName && (
          <div style={{ fontSize: 13, color: C.textOnDarkMuted, marginTop: 2 }}>
            {org.orgShortName}
          </div>
        )}
        <div style={{ display: 'flex', gap: 32, marginTop: 12 }}>
          {stats.map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontSize: 11,
                  color: C.textOnDarkDim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
