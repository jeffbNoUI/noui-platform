import { DISPLAY } from '@/lib/designSystem';
import { Organization } from '@/types/CRM';
import { EC, fmtDate } from './EmployerPortalConstants';

interface EmployerPortalOrgBannerProps {
  org: Organization;
}

export default function EmployerPortalOrgBanner({ org }: EmployerPortalOrgBannerProps) {
  return (
    <div
      style={{
        background: EC.cardBg,
        borderBottom: `1px solid ${EC.border}`,
        padding: '16px 32px',
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: EC.navy }}>
            {org.orgName}
          </h1>
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 4,
              fontSize: 12,
              color: EC.textSecondary,
            }}
          >
            <span>ID: {org.legacyEmployerId}</span>
            <span>{org.memberCount} members</span>
            <span>
              Last contribution:{' '}
              {org.lastContributionDate ? fmtDate(org.lastContributionDate) : '\u2014'}
            </span>
            <span>{org.reportingFrequency} reporting</span>
          </div>
        </div>
        <div
          style={{
            padding: '4px 12px',
            borderRadius: 20,
            background: org.employerStatus === 'active' ? EC.greenLight : EC.amberLight,
            color: org.employerStatus === 'active' ? EC.green : EC.amber,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {org.employerStatus}
        </div>
      </div>
    </div>
  );
}
