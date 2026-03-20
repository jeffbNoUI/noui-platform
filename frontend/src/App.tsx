import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useMember, useEmployment, useServiceCredit } from '@/hooks/useMember';
import { useBenefitCalculation, useScenario } from '@/hooks/useBenefitCalculation';
import MemberBanner from '@/components/MemberBanner';
import BenefitCalculationPanel from '@/components/BenefitCalculationPanel';
import PaymentOptionsComparison from '@/components/PaymentOptionsComparison';
import ServiceCreditSummary from '@/components/ServiceCreditSummary';
import ScenarioModeler from '@/components/ScenarioModeler';
import DROImpactPanel from '@/components/DROImpactPanel';
import IPRCalculator from '@/components/IPRCalculator';
import DeathBenefitPanel from '@/components/DeathBenefitPanel';
import EmploymentTimeline from '@/components/EmploymentTimeline';
import CommandPalette from '@/components/CommandPalette';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { ViewMode, UserRole } from '@/types/auth';
import { ROLE_DEFAULT_VIEW } from '@/types/auth';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Lazy-load portal entry points — each becomes a separate chunk
const StaffPortal = lazy(() => import('@/components/StaffPortal'));
const MemberPortal = lazy(() => import('@/components/portal/MemberPortal'));
const MemberDashboard = lazy(() => import('@/components/dashboard/MemberDashboard'));
const RetirementApplication = lazy(() => import('@/components/RetirementApplication'));
const CRMWorkspace = lazy(() => import('@/components/CRMWorkspace'));
const EmployerPortalApp = lazy(() => import('@/components/employer-portal/EmployerPortalApp'));
const VendorPortal = lazy(() => import('@/components/portal/VendorPortal'));
const EmployerOpsDesktop = lazy(() => import('@/components/employer-ops/EmployerOpsDesktop'));

function PortalLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );
}

// Demo case members with their retirement dates
const DEMO_CASES = [
  {
    id: 10001,
    name: 'Robert Martinez',
    retDate: '2026-04-01',
    label: 'Case 1: Tier 1, Rule of 75',
  },
  {
    id: 10002,
    name: 'Jennifer Kim',
    retDate: '2026-05-01',
    label: 'Case 2: Tier 2, Early Retirement',
  },
  {
    id: 10003,
    name: 'David Washington',
    retDate: '2026-04-01',
    label: 'Case 3: Tier 3, Early Retirement',
  },
  { id: 10001, name: 'Robert Martinez (DRO)', retDate: '2026-04-01', label: 'Case 4: Tier 1, DRO' },
];

// ── Shared top-level navigation bar ──────────────────────────────────────────

function TopNav({
  viewMode,
  onChangeView,
  canAccess,
}: {
  viewMode: ViewMode;
  onChangeView: (mode: ViewMode) => void;
  canAccess: (mode: ViewMode) => boolean;
}) {
  const tabs: { key: ViewMode; label: string; description: string }[] = [
    { key: 'staff', label: 'Staff Portal', description: 'Work queue and case management' },
    { key: 'portal', label: 'Member Portal', description: 'Self-service member view' },
    { key: 'workspace', label: 'Agent Workspace', description: 'Benefit calculations' },
    { key: 'crm', label: 'CRM', description: 'Contact management' },
    { key: 'employer', label: 'Employer Portal', description: 'Employer self-service' },
    { key: 'employer-ops', label: 'Employer Ops', description: 'Employer operations & monitoring' },
  ];

  const visibleTabs = tabs.filter((t) => canAccess(t.key));

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-iw-navy to-iw-navyLight flex items-center justify-center text-white font-bold text-sm font-display">
                N
              </div>
              <div>
                <div className="text-sm font-bold text-iw-navy font-display leading-none">NoUI</div>
                <div className="text-[9px] text-gray-400 tracking-widest uppercase font-semibold">
                  DERP POC
                </div>
              </div>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex gap-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => onChangeView(tab.key)}
                  title={tab.description}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === tab.key
                      ? 'bg-iw-sageLight text-iw-sage'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-400">Phase 1: Transparent</div>
        </div>
      </div>
    </nav>
  );
}

// ── Dev Role Switcher ─────────────────────────────────────────────────────────

function DevRoleSwitcher() {
  const { user, switchRole } = useAuth();
  if (!import.meta.env.DEV) return null;
  const roles: UserRole[] = ['staff', 'admin', 'member', 'employer', 'vendor'];

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white rounded-lg px-3 py-2 text-xs shadow-lg z-50 flex items-center gap-2">
      <span className="text-gray-400">Dev:</span>
      {roles.map((role) => (
        <button
          key={role}
          onClick={() => switchRole(role)}
          className={`px-2 py-0.5 rounded ${
            user.role === role ? 'bg-blue-500' : 'hover:bg-gray-700'
          }`}
        >
          {role}
        </button>
      ))}
    </div>
  );
}

// ── Main App (wraps in AuthProvider) ──────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

// ── App Inner (has access to auth context) ───────────────────────────────────

function AppInner() {
  const { user, canAccess } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(ROLE_DEFAULT_VIEW[user.role]);
  const [memberID, setMemberID] = useState(10001);
  const [retirementDate, setRetirementDate] = useState('2026-04-01');
  const [memberIDInput, setMemberIDInput] = useState('10001');
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // Retirement application state
  const [activeCaseId, setActiveCaseId] = useState('');
  const [caseMemberId, setCaseMemberId] = useState(10001);
  const [caseRetDate, setCaseRetDate] = useState('2026-04-01');
  const [caseFlagsState, setCaseFlagsState] = useState<string[]>([]);
  const [caseDroId, setCaseDroId] = useState<number | undefined>(undefined);

  // Member dashboard state
  const [dashboardMemberId, setDashboardMemberId] = useState(0);

  // CRM context (for cross-screen navigation)
  const [crmInitialMemberId, setCrmInitialMemberId] = useState<number | undefined>(undefined);
  const [crmBackView, setCrmBackView] = useState<ViewMode | undefined>(undefined);

  const handleOpenCase = useCallback(
    (caseId: string, memberId: number, retDate: string, flags?: string[], droId?: number) => {
      if (!canAccess('retirement-app')) {
        console.warn(`Access denied: role "${user.role}" cannot access "retirement-app"`);
        return;
      }
      setActiveCaseId(caseId);
      setCaseMemberId(memberId);
      setCaseRetDate(retDate);
      setCaseFlagsState(flags || []);
      setCaseDroId(droId);
      setViewMode('retirement-app');
    },
    [canAccess, user.role],
  );

  const handleViewMember = useCallback(
    (memberId: number) => {
      if (!canAccess('member-dashboard')) {
        console.warn(`Access denied: role "${user.role}" cannot access "member-dashboard"`);
        return;
      }
      setDashboardMemberId(memberId);
      setViewMode('member-dashboard');
    },
    [canAccess, user.role],
  );

  const handleChangeView = useCallback(
    (mode: ViewMode, context?: { memberId?: number }) => {
      if (!canAccess(mode)) {
        console.warn(`Access denied: role "${user.role}" cannot access "${mode}"`);
        return; // Stay on current view
      }
      const prev = viewMode;
      setViewMode(mode);
      if (mode === 'crm') {
        setCrmInitialMemberId(context?.memberId);
        setCrmBackView(prev);
      } else {
        setCrmInitialMemberId(undefined);
        setCrmBackView(undefined);
      }
    },
    [viewMode, canAccess, user.role],
  );

  // Reset viewMode when role changes (user might be on a view they no longer have access to)
  useEffect(() => {
    if (!canAccess(viewMode)) {
      setViewMode(ROLE_DEFAULT_VIEW[user.role]);
    }
  }, [user.role, canAccess, viewMode]);

  // Global Cmd+K / Ctrl+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Command palette commands
  const commands = useMemo(
    () => [
      {
        id: 'search-member',
        label: 'Search Member',
        icon: '🔍',
        shortcut: 'G M',
        category: 'Navigation',
        action: () => handleChangeView('staff'),
      },
      {
        id: 'open-queue',
        label: 'My Work Queue',
        icon: '📋',
        shortcut: 'G Q',
        category: 'Navigation',
        action: () => handleChangeView('staff'),
      },
      {
        id: 'run-calc',
        label: 'Run Calculation',
        icon: '🧮',
        category: 'Actions',
        action: () => handleChangeView('workspace'),
      },
      {
        id: 'open-crm',
        label: 'Open CRM',
        icon: '💬',
        shortcut: 'G C',
        category: 'Navigation',
        action: () => handleChangeView('crm'),
      },
      {
        id: 'member-portal',
        label: 'Member Portal',
        icon: '👤',
        category: 'Navigation',
        action: () => handleChangeView('portal'),
      },
      {
        id: 'employer-portal',
        label: 'Employer Portal',
        icon: '🏢',
        category: 'Navigation',
        action: () => handleChangeView('employer'),
      },
      {
        id: 'vendor-portal',
        label: 'Vendor Portal',
        icon: '\ud83c\udfe5',
        category: 'Navigation',
        action: () => handleChangeView('vendor'),
      },
      {
        id: 'case-robert',
        label: 'Open Case: Robert Martinez',
        icon: '📂',
        category: 'Cases',
        action: () => handleOpenCase('RET-2026-0147', 10001, '2026-04-01', ['leave-payout']),
      },
      {
        id: 'case-jennifer',
        label: 'Open Case: Jennifer Kim',
        icon: '📂',
        category: 'Cases',
        action: () =>
          handleOpenCase('RET-2026-0152', 10002, '2026-05-01', [
            'early-retirement',
            'purchased-service',
          ]),
      },
    ],
    [handleOpenCase, handleChangeView],
  );

  // Filter commands by role access
  const filteredCommands = useMemo(
    () =>
      commands.filter((cmd) => {
        const cmdViewMap: Record<string, ViewMode> = {
          'search-member': 'staff',
          'open-queue': 'staff',
          'run-calc': 'workspace',
          'open-crm': 'crm',
          'member-portal': 'portal',
          'employer-portal': 'employer',
          'vendor-portal': 'vendor',
          'case-robert': 'retirement-app',
          'case-jennifer': 'retirement-app',
        };
        const requiredView = cmdViewMap[cmd.id];
        return !requiredView || canAccess(requiredView);
      }),
    [commands, canAccess],
  );

  // ── Staff Portal (default landing) ──────────────────────────────────────

  // Command palette is global across all views
  const cmdPalette = (
    <CommandPalette
      commands={filteredCommands}
      isOpen={cmdPaletteOpen}
      onClose={() => setCmdPaletteOpen(false)}
    />
  );

  if (viewMode === 'staff') {
    return (
      <>
        {cmdPalette}
        <ErrorBoundary portalName="Staff Portal">
          <Suspense fallback={<PortalLoading />}>
            <StaffPortal
              onOpenCase={handleOpenCase}
              onViewMember={handleViewMember}
              onChangeView={handleChangeView}
            />
          </Suspense>
        </ErrorBoundary>
        <DevRoleSwitcher />
      </>
    );
  }

  // ── Member Dashboard (from member lookup) ──────────────────────────────

  if (viewMode === 'member-dashboard') {
    return (
      <>
        {cmdPalette}
        <ErrorBoundary portalName="Member Dashboard">
          <Suspense fallback={<PortalLoading />}>
            <MemberDashboard
              memberId={dashboardMemberId}
              onBack={() => handleChangeView('staff')}
              onOpenCase={handleOpenCase}
              onChangeView={handleChangeView}
            />
          </Suspense>
        </ErrorBoundary>
        <DevRoleSwitcher />
      </>
    );
  }

  // ── Retirement Application (from Staff Portal case click) ───────────────

  if (viewMode === 'retirement-app') {
    return (
      <>
        {cmdPalette}
        <ErrorBoundary portalName="Retirement Application">
          <Suspense fallback={<PortalLoading />}>
            <RetirementApplication
              caseId={activeCaseId}
              memberId={caseMemberId}
              retirementDate={caseRetDate}
              caseFlags={caseFlagsState}
              droId={caseDroId}
              onBack={() => handleChangeView('staff')}
              onChangeView={handleChangeView}
            />
          </Suspense>
        </ErrorBoundary>
        <DevRoleSwitcher />
      </>
    );
  }

  // ── Member Portal view ──────────────────────────────────────────────────

  if (viewMode === 'portal') {
    return (
      <>
        {cmdPalette}
        <ErrorBoundary portalName="Member Portal">
          <Suspense fallback={<PortalLoading />}>
            <MemberPortal
              memberID={memberID}
              retirementDate={retirementDate}
              onSwitchToWorkspace={() => handleChangeView('workspace')}
              onSwitchToCRM={() => handleChangeView('crm')}
              onChangeView={handleChangeView}
            />
          </Suspense>
        </ErrorBoundary>
        <DevRoleSwitcher />
      </>
    );
  }

  // ── CRM Workspace view ────────────────────────────────────────────────

  if (viewMode === 'crm') {
    return (
      <>
        {cmdPalette}
        <TopNav viewMode={viewMode} onChangeView={handleChangeView} canAccess={canAccess} />
        <ErrorBoundary portalName="CRM">
          <Suspense fallback={<PortalLoading />}>
            <CRMWorkspace
              initialMemberId={crmInitialMemberId}
              onBack={crmBackView ? () => handleChangeView(crmBackView) : undefined}
            />
          </Suspense>
        </ErrorBoundary>
        <DevRoleSwitcher />
      </>
    );
  }

  // ── Employer Portal view ──────────────────────────────────────────────

  if (viewMode === 'employer') {
    return (
      <>
        {cmdPalette}
        <ErrorBoundary portalName="Employer Portal">
          <Suspense fallback={<PortalLoading />}>
            <EmployerPortalApp />
          </Suspense>
        </ErrorBoundary>
        <DevRoleSwitcher />
      </>
    );
  }

  // ── Employer Ops Desktop view ─────────────────────────────────────

  if (viewMode === 'employer-ops') {
    return (
      <>
        {cmdPalette}
        <TopNav viewMode={viewMode} onChangeView={handleChangeView} canAccess={canAccess} />
        <ErrorBoundary portalName="Employer Ops">
          <Suspense fallback={<PortalLoading />}>
            <EmployerOpsDesktop />
          </Suspense>
        </ErrorBoundary>
        <DevRoleSwitcher />
      </>
    );
  }

  // ── Vendor Portal view ──────────────────────────────────────────────

  if (viewMode === 'vendor') {
    return (
      <>
        {cmdPalette}
        <ErrorBoundary portalName="Vendor Portal">
          <Suspense fallback={<PortalLoading />}>
            <VendorPortal onChangeView={handleChangeView} />
          </Suspense>
        </ErrorBoundary>
        <DevRoleSwitcher />
      </>
    );
  }

  // ── Agent Workspace view (calculations) ───────────────────────────────

  return (
    <>
      {cmdPalette}
      <AgentWorkspace
        memberID={memberID}
        setMemberID={setMemberID}
        retirementDate={retirementDate}
        setRetirementDate={setRetirementDate}
        memberIDInput={memberIDInput}
        setMemberIDInput={setMemberIDInput}
        viewMode={viewMode}
        setViewMode={handleChangeView}
        canAccess={canAccess}
      />
      <DevRoleSwitcher />
    </>
  );
}

// ── Agent Workspace (split out for clarity) ──────────────────────────────────

function AgentWorkspace({
  memberID,
  setMemberID,
  retirementDate,
  setRetirementDate,
  memberIDInput,
  setMemberIDInput,
  viewMode,
  setViewMode,
  canAccess,
}: {
  memberID: number;
  setMemberID: (id: number) => void;
  retirementDate: string;
  setRetirementDate: (d: string) => void;
  memberIDInput: string;
  setMemberIDInput: (v: string) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  canAccess: (mode: ViewMode) => boolean;
}) {
  const { data: member, isLoading: memberLoading, error: memberError } = useMember(memberID);
  const { data: employment } = useEmployment(memberID);
  const { data: svcCreditData } = useServiceCredit(memberID);
  const { data: calculation, isLoading: calcLoading } = useBenefitCalculation(
    memberID,
    retirementDate,
  );

  const scenarioDates = [
    retirementDate,
    addYears(retirementDate, 1),
    addYears(retirementDate, 2),
    addYears(retirementDate, 3),
  ];
  const { data: scenario } = useScenario(memberID, scenarioDates);

  const [workspaceTab, setWorkspaceTab] = useState<'summary' | 'detail' | 'options' | 'history'>(
    'summary',
  );

  const isEarlyRetirement = calculation?.eligibility.best_eligible_type === 'EARLY';
  const svcSummary = svcCreditData?.summary;

  const handleLookup = () => {
    const id = parseInt(memberIDInput, 10);
    if (id > 0) setMemberID(id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav
        viewMode={viewMode}
        onChangeView={(mode) => setViewMode(mode)}
        canAccess={canAccess}
      />

      {/* Workspace controls */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Retirement Application Workspace</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={memberIDInput}
                onChange={(e) => setMemberIDInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="Member ID"
                className="w-28 rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
              <input
                type="date"
                value={retirementDate}
                onChange={(e) => setRetirementDate(e.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleLookup}
                className="rounded bg-iw-sage px-4 py-1.5 text-sm font-medium text-white hover:bg-iw-sageDark transition-colors"
              >
                Calculate
              </button>
            </div>
          </div>

          {/* Demo case quick-select */}
          <div className="mt-2 flex gap-2">
            {DEMO_CASES.map((dc, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setMemberID(dc.id);
                  setMemberIDInput(String(dc.id));
                  setRetirementDate(dc.retDate);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
                  ${
                    memberID === dc.id && retirementDate === dc.retDate
                      ? 'bg-iw-sage text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {dc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main workspace content */}
      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {memberLoading && (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500">
            Loading member data...
          </div>
        )}

        {memberError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {memberError.message}
          </div>
        )}

        {member && (
          <>
            <MemberBanner member={member} />

            {calcLoading && (
              <div className="rounded-lg bg-white p-8 text-center text-gray-500">
                Calculating benefit...
              </div>
            )}

            {calculation && (
              <>
                {/* Section tabs */}
                <div className="flex gap-1 border-b border-gray-200 bg-white rounded-t-lg px-2 pt-2">
                  {(
                    [
                      { key: 'summary', label: 'Summary' },
                      { key: 'detail', label: 'Calculation Detail' },
                      { key: 'options', label: 'Payment Options' },
                      { key: 'history', label: 'History & Other' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setWorkspaceTab(tab.key)}
                      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                        workspaceTab === tab.key
                          ? 'bg-iw-sageLight text-iw-sage border-b-2 border-iw-sage'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Summary tab */}
                {workspaceTab === 'summary' && (
                  <div className="space-y-6">
                    {svcSummary && <ServiceCreditSummary summary={svcSummary} />}

                    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
                      <div className="text-center">
                        <p className="text-sm text-gray-500 mb-1">Maximum Monthly Benefit</p>
                        <p className="text-4xl font-bold text-iw-navy tabular-nums">
                          $
                          {calculation.maximum_benefit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {calculation.eligibility.best_eligible_type === 'EARLY'
                            ? 'Early retirement — reduction applied'
                            : 'Normal retirement — no reduction'}
                          {calculation.dro ? ' — DRO in effect' : ''}
                        </p>
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 text-center">
                        <div>
                          <p className="text-xs text-gray-500">AMS</p>
                          <p className="text-lg font-semibold text-gray-900">
                            $
                            {calculation.ams.amount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">100% J&S</p>
                          <p className="text-lg font-semibold text-gray-900">
                            $
                            {(
                              calculation.payment_options.js_100?.member_amount ?? 0
                            ).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">75% J&S</p>
                          <p className="text-lg font-semibold text-gray-900">
                            $
                            {(calculation.payment_options.js_75?.member_amount ?? 0).toLocaleString(
                              'en-US',
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculation Detail tab */}
                {workspaceTab === 'detail' && (
                  <div className="space-y-6">
                    {svcSummary && <ServiceCreditSummary summary={svcSummary} />}
                    <BenefitCalculationPanel calculation={calculation} />
                  </div>
                )}

                {/* Payment Options tab */}
                {workspaceTab === 'options' && (
                  <div className="space-y-6">
                    <PaymentOptionsComparison
                      options={calculation.payment_options}
                      maritalStatus={member.marital_status}
                    />
                    {calculation.dro && <DROImpactPanel dro={calculation.dro} />}
                  </div>
                )}

                {/* History & Other tab */}
                {workspaceTab === 'history' && (
                  <div className="space-y-6">
                    {isEarlyRetirement && scenario && (
                      <ScenarioModeler
                        scenarios={scenario.scenarios}
                        currentRetirementDate={retirementDate}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-6">
                      <DeathBenefitPanel deathBenefit={calculation.death_benefit} />
                      <IPRCalculator ipr={calculation.ipr} medicareFlag={member.medicare_flag} />
                    </div>

                    {employment && employment.length > 0 && (
                      <EmploymentTimeline events={employment} />
                    )}
                  </div>
                )}
              </>
            )}

            {/* Show employment timeline in summary if no calculation yet */}
            {!calculation && !calcLoading && employment && employment.length > 0 && (
              <EmploymentTimeline events={employment} />
            )}
          </>
        )}

        <footer className="rounded-lg bg-gray-100 px-6 py-4 text-center text-xs text-gray-500">
          <p className="font-medium">Phase 1: Transparent</p>
          <p>
            The system shows its work. Every calculation is transparent and verifiable. The
            deterministic rules engine executes certified plan provisions.
          </p>
        </footer>
      </main>
    </div>
  );
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}
