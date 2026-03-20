import { usePortalOrganization } from '@/hooks/useCRM';
import {
  useEmployerDQScore,
  useEmployerMemberSummary,
  useEmployerCaseSummary,
  useOrgContacts,
} from '@/hooks/useEmployerOps';
import { dqScoreColor } from '@/lib/employerOpsConfig';

interface OrgBannerProps {
  orgId: string;
  orgName: string;
  onBack: () => void;
}

export default function OrgBanner({ orgId, orgName: nameProp, onBack }: OrgBannerProps) {
  const { data: org, isLoading: orgLoading } = usePortalOrganization(orgId);
  const { data: dq } = useEmployerDQScore(orgId);
  const { data: members } = useEmployerMemberSummary(orgId);
  const { data: cases } = useEmployerCaseSummary(orgId);
  const { data: contactsData } = useOrgContacts(orgId);

  if (orgLoading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
        <div className="h-5 w-48 rounded bg-gray-200" />
        <div className="mt-2 h-4 w-72 rounded bg-gray-100" />
      </div>
    );
  }

  const orgName = org?.orgName ?? nameProp;
  const ein = org?.ein;
  const city = org?.city;
  const stateCode = org?.stateCode;
  const address = [city, stateCode].filter(Boolean).join(', ');

  const dqScore = dq?.overallScore;
  const memberCount = members?.active_count ?? 0;
  const activeCases = cases?.activeCases ?? 0;

  // Find primary contact
  const contacts = contactsData?.items ?? [];
  const primary =
    contacts.find((c) => c.organizationRoles?.some((r) => r.isPrimaryForRole)) ?? contacts[0];

  const primaryName = primary
    ? [primary.firstName, primary.lastName].filter(Boolean).join(' ')
    : null;
  const primaryEmail = primary?.primaryEmail;
  const primaryPhone = primary?.primaryPhone;

  return (
    <div>
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="mb-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        &larr; Back to alerts
      </button>

      {/* Banner card */}
      <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side */}
          <div className="min-w-0 flex-1">
            {/* Name + DQ badge */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900 truncate">{orgName}</h2>
              {dqScore != null && (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: dqScoreColor(dqScore) }}
                >
                  DQ {dqScore}%
                </span>
              )}
            </div>

            {/* Inline details */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              {ein && <span>EIN: {ein}</span>}
              {address && <span>{address}</span>}
              {primaryName && <span className="text-gray-600 font-medium">{primaryName}</span>}
              {primaryEmail && <span>{primaryEmail}</span>}
              {primaryPhone && <span>{primaryPhone}</span>}
            </div>
          </div>

          {/* Right side: stat boxes */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-center px-4 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-xl font-bold text-gray-900 tabular-nums">
                {memberCount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Members</div>
            </div>
            <div className="text-center px-4 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-xl font-bold text-gray-900 tabular-nums">{activeCases}</div>
              <div className="text-xs text-gray-500">Active Cases</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
