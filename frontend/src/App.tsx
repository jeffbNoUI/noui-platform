import { useState, useEffect, useCallback, useMemo } from 'react';
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
import MemberPortal from '@/components/portal/MemberPortal';
import CRMWorkspace from '@/components/CRMWorkspace';
import EmployerPortal from '@/components/portal/EmployerPortal';
import StaffPortal from '@/components/StaffPortal';
import RetirementApplication from '@/components/RetirementApplication';
import CommandPalette from '@/components/CommandPalette';
import VendorPortal from '@/components/portal/VendorPortal';

type ViewMode = 'staff' | 'portal' | 'workspace' | 'crm' | 'employer' | 'vendor' | 'retirement-app';

// Demo case members with their retirement dates
const DEMO_CASES = [
  { id: 10001, name: 'Robert Martinez', retDate: '2026-04-01', label: 'Case 1: Tier 1, Rule of 75' },
  { id: 10002, name: 'Jennifer Kim', retDate: '2026-05-01', label: 'Case 2: Tier 2, Early Retirement' },
  { id: 10003, name: 'David Washington', retDate: '2026-04-01', label: 'Case 3: Tier 3, Early Retirement' },
  { id: 10001, name: 'Robert Martinez (DRO)', retDate: '2026-04-01', label: 'Case 4: Tier 1, DRO' },
];

// ── Shared top-level navigation bar ──────────────────────────────────────────

function TopNav({
  viewMode,
  onChangeView,
}: {
  viewMode: ViewMode;
  onChangeView: (mode: ViewMode) => void;
}) {
  const tabs: { key: ViewMode; label: string; description: string }[] = [
    { key: 'staff', label: 'Staff Portal', description: 'Work queue and case management' },
    { key: 'portal', label: 'Member Portal', description: 'Self-service member view' },
    { key: 'workspace', label: 'Agent Workspace', description: 'Benefit calculations' },
    { key: 'crm', label: 'CRM', description: 'Contact management' },
    { key: 'employer', label: 'Employer Portal', description: 'Employer self-service' },
  ];

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
                <div className="text-[9px] text-gray-400 tracking-widest uppercase font-semibold">DERP POC</div>
              </div>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex gap-1">
              {tabs.map((tab) => (
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

          <div className="text-xs text-gray-400">
            Phase 1: Transparent
          </div>
        </div>
      </div>
    </nav>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('staff');
  const [memberID, setMemberID] = useState(10001);
  const [retirementDate, setRetirementDate] = useState('2026-04-01');
  const [memberIDInput, setMemberIDInput] = useState('10001');
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // Retirement application state
  const [activeCaseId, setActiveCaseId] = useState('');
  const [caseMemberId, setCaseMemberId] = useState(10001);
  const [caseRetDate, setCaseRetDate] = useState('2026-04-01');
  const [caseFlagsState, setCaseFlagsState] = useState<string[]>([]);

  const handleOpenCase = useCallback((caseId: string, memberId: number, retDate: string, flags?: string[]) => {
    setActiveCaseId(caseId);
    setCaseMemberId(memberId);
    setCaseRetDate(retDate);
    setCaseFlagsState(flags || []);
    setViewMode('retirement-app');
  }, []);

  const handleChangeView = useCallback((mode: string) => {
    setViewMode(mode as ViewMode);
  }, []);

  // Global ⌘K / Ctrl+K handler
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
  const commands = useMemo(() => [
    { id: 'search-member', label: 'Search Member', icon: '🔍', shortcut: 'G M', category: 'Navigation', action: () => setViewMode('staff') },
    { id: 'open-queue', label: 'My Work Queue', icon: '📋', shortcut: 'G Q', category: 'Navigation', action: () => setViewMode('staff') },
    { id: 'run-calc', label: 'Run Calculation', icon: '🧮', category: 'Actions', action: () => setViewMode('workspace') },
    { id: 'open-crm', label: 'Open CRM', icon: '💬', shortcut: 'G C', category: 'Navigation', action: () => setViewMode('crm') },
    { id: 'member-portal', label: 'Member Portal', icon: '👤', category: 'Navigation', action: () => setViewMode('portal') },
    { id: 'employer-portal', label: 'Employer Portal', icon: '🏢', category: 'Navigation', action: () => setViewMode('employer') },
    { id: 'vendor-portal', label: 'Vendor Portal', icon: '\ud83c\udfe5', category: 'Navigation', action: () => setViewMode('vendor') },
    { id: 'case-robert', label: 'Open Case: Robert Martinez', icon: '📂', category: 'Cases', action: () => handleOpenCase('RET-2026-0147', 10001, '2026-04-01', ['leave-payout']) },
    { id: 'case-jennifer', label: 'Open Case: Jennifer Kim', icon: '📂', category: 'Cases', action: () => handleOpenCase('RET-2026-0152', 10002, '2026-05-01', ['early-retirement', 'purchased-service']) },
  ], [handleOpenCase]);

  // ── Staff Portal (default landing) ──────────────────────────────────────

  // Command palette is global across all views
  const cmdPalette = <CommandPalette commands={commands} isOpen={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />;

  if (viewMode === 'staff') {
    return (
      <>
        {cmdPalette}
        <StaffPortal
          onOpenCase={handleOpenCase}
          onChangeView={handleChangeView}
        />
      </>
    );
  }

  // ── Retirement Application (from Staff Portal case click) ───────────────

  if (viewMode === 'retirement-app') {
    return (
      <>
        {cmdPalette}
        <RetirementApplication
          caseId={activeCaseId}
          memberId={caseMemberId}
          retirementDate={caseRetDate}
          caseFlags={caseFlagsState}
          onBack={() => setViewMode('staff')}
          onChangeView={handleChangeView}
        />
      </>
    );
  }

  // ── Member Portal view ──────────────────────────────────────────────────

  if (viewMode === 'portal') {
    return (
      <>
      {cmdPalette}
      <MemberPortal
        memberID={memberID}
        retirementDate={retirementDate}
        onSwitchToWorkspace={() => setViewMode('workspace')}
        onSwitchToCRM={() => setViewMode('crm')}
        onChangeView={handleChangeView}
      />
      </>
    );
  }

  // ── CRM Workspace view ────────────────────────────────────────────────

  if (viewMode === 'crm') {
    return (
      <>
        {cmdPalette}
        <TopNav viewMode={viewMode} onChangeView={handleChangeView} />
        <CRMWorkspace />
      </>
    );
  }

  // ── Employer Portal view ──────────────────────────────────────────────

  if (viewMode === 'employer') {
    return <>{cmdPalette}<EmployerPortal onChangeView={handleChangeView} /></>;
  }

  // ── Vendor Portal view ──────────────────────────────────────────────

  if (viewMode === 'vendor') {
    return <>{cmdPalette}<VendorPortal onChangeView={handleChangeView} /></>;
  }

  // ── Agent Workspace view (calculations) ───────────────────────────────

  return <>{cmdPalette}<AgentWorkspace
    memberID={memberID}
    setMemberID={setMemberID}
    retirementDate={retirementDate}
    setRetirementDate={setRetirementDate}
    memberIDInput={memberIDInput}
    setMemberIDInput={setMemberIDInput}
    viewMode={viewMode}
    setViewMode={handleChangeView}
  /></>;
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
}: {
  memberID: number;
  setMemberID: (id: number) => void;
  retirementDate: string;
  setRetirementDate: (d: string) => void;
  memberIDInput: string;
  setMemberIDInput: (v: string) => void;
  viewMode: ViewMode;
  setViewMode: (m: string) => void;
}) {
  const { data: member, isLoading: memberLoading, error: memberError } = useMember(memberID);
  const { data: employment } = useEmployment(memberID);
  const { data: svcCreditData } = useServiceCredit(memberID);
  const { data: calculation, isLoading: calcLoading } = useBenefitCalculation(memberID, retirementDate);

  const scenarioDates = [
    retirementDate,
    addYears(retirementDate, 1),
    addYears(retirementDate, 2),
    addYears(retirementDate, 3),
  ];
  const { data: scenario } = useScenario(memberID, scenarioDates);

  const isEarlyRetirement = calculation?.eligibility.best_eligible_type === 'EARLY';
  const svcSummary = svcCreditData?.summary;

  const handleLookup = () => {
    const id = parseInt(memberIDInput, 10);
    if (id > 0) setMemberID(id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav viewMode={viewMode} onChangeView={(mode) => setViewMode(mode)} />

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
                  ${memberID === dc.id && retirementDate === dc.retDate
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

            {svcSummary && <ServiceCreditSummary summary={svcSummary} />}

            {calcLoading && (
              <div className="rounded-lg bg-white p-8 text-center text-gray-500">
                Calculating benefit...
              </div>
            )}

            {calculation && (
              <>
                <BenefitCalculationPanel calculation={calculation} />

                <PaymentOptionsComparison
                  options={calculation.payment_options}
                  maritalStatus={member.marital_status}
                />

                {calculation.dro && <DROImpactPanel dro={calculation.dro} />}

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
              </>
            )}

            {employment && employment.length > 0 && (
              <EmploymentTimeline events={employment} />
            )}
          </>
        )}

        <footer className="rounded-lg bg-gray-100 px-6 py-4 text-center text-xs text-gray-500">
          <p className="font-medium">Phase 1: Transparent</p>
          <p>
            The system shows its work. Every calculation is transparent and verifiable.
            The deterministic rules engine executes certified plan provisions.
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
