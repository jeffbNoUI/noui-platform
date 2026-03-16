import { C, DISPLAY } from '@/lib/designSystem';
import ContributionBars from './ContributionBars';
import type { ContributionDataPoint } from './ContributionBars';

interface MemberPortalContributionsProps {
  contribHistory: ContributionDataPoint[];
}

export default function MemberPortalContributions({
  contribHistory,
}: MemberPortalContributionsProps) {
  return (
    <div className="portal-card" style={{ padding: 24 }}>
      <h3
        style={{
          fontFamily: DISPLAY,
          fontSize: 16,
          fontWeight: 600,
          color: C.navy,
          marginBottom: 4,
        }}
      >
        Contribution History
      </h3>
      <p style={{ fontSize: 12, color: C.textTertiary, marginBottom: 16 }}>
        Employee + employer annual contributions
      </p>
      <ContributionBars data={contribHistory} />
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: C.textSecondary,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: C.sage,
              opacity: 0.7,
            }}
          />{' '}
          Employer
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: C.textSecondary,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: C.gold,
              opacity: 0.7,
            }}
          />{' '}
          Employee
        </div>
      </div>
    </div>
  );
}
