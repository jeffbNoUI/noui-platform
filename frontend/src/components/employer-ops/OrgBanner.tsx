import { C, DISPLAY, BODY } from '@/lib/designSystem';
import { usePortalOrganization } from '@/hooks/useCRM';
import { useEmployerDQScore, useEmployerMemberSummary } from '@/hooks/useEmployerOps';
import { dqScoreColor } from '@/lib/employerOpsConfig';

interface OrgBannerProps {
  orgId: string;
}

export default function OrgBanner({ orgId }: OrgBannerProps) {
  const { data: org, isLoading: orgLoading } = usePortalOrganization(orgId);
  const { data: dq, isLoading: dqLoading } = useEmployerDQScore(orgId);
  const { data: members, isLoading: membersLoading } = useEmployerMemberSummary(orgId);

  const isLoading = orgLoading || dqLoading || membersLoading;

  if (isLoading) {
    return (
      <div
        style={{
          padding: '16px 24px',
          background: C.cardBgAccent,
          color: C.textOnDarkMuted,
          fontFamily: BODY,
          fontSize: 14,
        }}
      >
        Loading employer details...
      </div>
    );
  }

  const orgName = org?.orgName ?? orgId;
  const ein = org?.ein;
  const status = org?.employerStatus ?? 'Unknown';
  const activeMembers = members?.active_count ?? 0;
  const dqScore = dq?.overallScore;

  return (
    <div
      style={{
        padding: '16px 24px',
        background: C.cardBgAccent,
      }}
    >
      {/* Top row: org name + status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 20,
            fontWeight: 700,
            color: C.textOnDark,
            margin: 0,
          }}
        >
          {orgName}
        </h2>
        <span
          style={{
            fontFamily: BODY,
            fontSize: 13,
            color: C.textOnDarkMuted,
          }}
        >
          Status: {status}
        </span>
      </div>

      {/* Bottom row: EIN, members, DQ score */}
      <div
        style={{
          fontFamily: BODY,
          fontSize: 13,
          color: C.textOnDarkMuted,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {ein && <span>EIN: {ein}</span>}
        {ein && <span style={{ margin: '0 8px' }}>&middot;</span>}
        <span>{activeMembers.toLocaleString()} active members</span>
        {dqScore != null && (
          <>
            <span style={{ margin: '0 8px' }}>&middot;</span>
            <span>
              DQ Score:{' '}
              <span style={{ color: dqScoreColor(dqScore), fontWeight: 600 }}>{dqScore}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
