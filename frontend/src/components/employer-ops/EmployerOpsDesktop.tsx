import { useState, useMemo } from 'react';
import { usePortalOrganizations } from '@/hooks/useCRM';
import {
  useEmployerAlerts,
  useEmployerDQScore,
  useEmployerCaseSummary,
  useEmployerMemberSummary,
  useOrgContacts,
  useEmployerActivity,
  useEmployerTemplates,
} from '@/hooks/useEmployerOps';
import { dqScoreColor } from '@/lib/employerOpsConfig';

import AlertTable from './AlertTable';
import AllEmployersList from './AllEmployersList';
import EmployerSearch from './EmployerSearch';
import OrgBanner from './OrgBanner';
import SummaryCard from './SummaryCard';
import SummaryCardGrid from './SummaryCardGrid';
import ActivityFeed from './ActivityFeed';
import CreateCaseDialog from './actions/CreateCaseDialog';
import LogInteractionDialog from './actions/LogInteractionDialog';
import GenerateLetterDialog from './actions/GenerateLetterDialog';

type ViewState = 'triage' | 'profile';
type DialogState = 'none' | 'case' | 'interaction' | 'letter';

export default function EmployerOpsDesktop() {
  const [view, setView] = useState<ViewState>('triage');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>('none');

  // ── Global data ───────────────────────────────────────────────────────
  const { data: orgs } = usePortalOrganizations();
  const orgList = orgs ?? [];

  const orgIds = useMemo(() => orgList.map((o) => o.orgId), [orgList]);
  const orgNames = useMemo(
    () =>
      orgList.reduce<Record<string, string>>((acc, o) => {
        acc[o.orgId] = o.orgName;
        return acc;
      }, {}),
    [orgList],
  );

  const { alerts, isLoading: alertsLoading } = useEmployerAlerts(orgIds, orgNames);

  // ── Search data ───────────────────────────────────────────────────────
  const searchOrgs = useMemo(
    () =>
      orgList.map((o) => ({
        orgId: o.orgId,
        name: o.orgName,
        memberCount: o.memberCount,
      })),
    [orgList],
  );

  // ── Org-scoped data (safe to call with '' — hooks have enabled: !!orgId) ──
  const activeOrgId = selectedOrgId ?? '';
  const { data: dq } = useEmployerDQScore(activeOrgId);
  const { data: cases } = useEmployerCaseSummary(activeOrgId);
  const { data: members } = useEmployerMemberSummary(activeOrgId);
  const { data: contactsData } = useOrgContacts(activeOrgId);
  // DQ issues and cases are fetched by useEmployerActivity internally
  const { events: activityEvents } = useEmployerActivity(activeOrgId);
  const { data: templates } = useEmployerTemplates();

  // ── Derived metrics ───────────────────────────────────────────────────
  const dqScore = dq?.overallScore;
  const dqScoreStr = dqScore != null ? `${dqScore}%` : '--';
  const openIssues = dq?.openIssues ?? 0;
  const criticalIssues = dq?.criticalIssues ?? 0;

  const activeCases = cases?.activeCases ?? 0;
  const atRiskCases = cases?.atRiskCases ?? 0;
  const completedCases = cases?.completedCases ?? 0;

  const totalMembers = members?.active_count ?? 0;
  const tier1 = members?.tier1_count ?? 0;
  const tier2 = members?.tier2_count ?? 0;
  const tier3 = members?.tier3_count ?? 0;

  const contactCount = contactsData?.items?.length ?? 0;

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleSelectEmployer(orgId: string) {
    setSelectedOrgId(orgId);
    setView('profile');
    setDialog('none');
  }

  function handleShowAlerts() {
    setView('triage');
    setSelectedOrgId(null);
    setDialog('none');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Search bar — always visible ─────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3">
        <EmployerSearch
          orgs={searchOrgs}
          contacts={[]}
          alertCount={alerts.length}
          onSelectEmployer={handleSelectEmployer}
          onShowAlerts={handleShowAlerts}
        />
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        {view === 'triage' && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-gray-900">Employer Ops</h1>
            <AlertTable
              alerts={alerts}
              isLoading={alertsLoading}
              onSelectEmployer={handleSelectEmployer}
            />
            <AllEmployersList
              orgs={orgList.map((o) => ({ orgId: o.orgId, name: o.orgName }))}
              alerts={alerts}
              onSelectEmployer={handleSelectEmployer}
            />
          </div>
        )}

        {view === 'profile' && selectedOrgId && (
          <div key={selectedOrgId} className="space-y-6">
            <OrgBanner
              orgId={selectedOrgId}
              orgName={orgNames[selectedOrgId] ?? selectedOrgId}
              onBack={handleShowAlerts}
            />

            <SummaryCardGrid>
              {/* 1. DQ Health */}
              <SummaryCard
                title="DQ Health"
                metrics={[
                  {
                    label: 'Score',
                    value: dqScoreStr,
                    color: dqScore != null ? `text-[${dqScoreColor(dqScore)}]` : undefined,
                  },
                  { label: 'Open Issues', value: openIssues },
                  {
                    label: 'Critical',
                    value: criticalIssues,
                    color: criticalIssues > 0 ? 'text-red-600' : undefined,
                  },
                ]}
                linkLabel="View Details"
                onLink={() => {}}
              />

              {/* 2. Cases */}
              <SummaryCard
                title="Cases"
                metrics={[
                  { label: 'Active', value: activeCases },
                  {
                    label: 'At Risk',
                    value: atRiskCases,
                    color: atRiskCases > 0 ? 'text-amber-600' : undefined,
                  },
                  { label: 'Completed', value: completedCases },
                ]}
                linkLabel="View All Cases"
                onLink={() => {}}
              />

              {/* 3. Members */}
              <SummaryCard
                title="Members"
                metrics={[
                  { label: 'Total', value: totalMembers.toLocaleString() },
                  { label: 'Tier 1', value: tier1.toLocaleString() },
                  { label: 'Tier 2', value: tier2.toLocaleString() },
                  { label: 'Tier 3', value: tier3.toLocaleString() },
                ]}
                linkLabel="View Roster"
                onLink={() => {}}
              />

              {/* 4. Contacts & Users */}
              <SummaryCard
                title="Contacts & Users"
                metrics={[{ label: 'Contacts', value: contactCount }]}
                linkLabel="View Contacts"
                onLink={() => {}}
              />

              {/* 5. Correspondence */}
              <SummaryCard
                title="Correspondence"
                metrics={[{ label: 'Recent', value: 0 }]}
                linkLabel="View Letters"
                onLink={() => {}}
              />

              {/* 6. Contributions */}
              <SummaryCard title="Contributions" metrics={[]} comingSoon />

              {/* 7. Balances */}
              <SummaryCard title="Balances" metrics={[]} comingSoon />

              {/* 8. Actions */}
              <SummaryCard title="Actions" metrics={[]}>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog('interaction')}
                    className="w-full text-left text-sm px-3 py-1.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700"
                  >
                    {'\u{1F4DE}'} Log Interaction
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog('case')}
                    className="w-full text-left text-sm px-3 py-1.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700"
                  >
                    {'\u{1F4CB}'} Create Case
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog('letter')}
                    className="w-full text-left text-sm px-3 py-1.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700"
                  >
                    {'\u{2709}\u{FE0F}'} Send Letter
                  </button>
                </div>
              </SummaryCard>
            </SummaryCardGrid>

            <ActivityFeed events={activityEvents} />
          </div>
        )}
      </main>

      {/* ── Action dialogs ──────────────────────────────────────────── */}
      {dialog === 'case' && selectedOrgId && (
        <CreateCaseDialog orgId={selectedOrgId} onClose={() => setDialog('none')} />
      )}
      {dialog === 'interaction' && selectedOrgId && (
        <LogInteractionDialog orgId={selectedOrgId} onClose={() => setDialog('none')} />
      )}
      {dialog === 'letter' && selectedOrgId && templates?.items?.[0] && (
        <GenerateLetterDialog
          orgId={selectedOrgId}
          template={templates.items[0]}
          onClose={() => setDialog('none')}
        />
      )}
    </div>
  );
}
