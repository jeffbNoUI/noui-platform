import { useState, useEffect } from 'react';
import { useMember, useContributions, useBeneficiaries } from '@/hooks/useMember';
import { useBenefitCalculation } from '@/hooks/useBenefitCalculation';
import {
  useContactByMemberId,
  useMemberConversations,
  useMemberPublicInteractions,
  useCreateMemberMessage,
  useCreateMemberConversation,
} from '@/hooks/useCRM';
import { C, DISPLAY, BODY, MONO } from '@/lib/designSystem';
import { ConversationThread, MessageComposer, MEMBER_THEME } from '@/components/crm';
import BenefitProjectionChart from './BenefitProjectionChart';
import type { ProjectionDataPoint } from './BenefitProjectionChart';
import ContributionBars from './ContributionBars';
import type { ContributionDataPoint } from './ContributionBars';
import AIChatPanel from './AIChatPanel';
import MemberCorrespondenceTab from './MemberCorrespondenceTab';

type ViewMode = 'portal' | 'workspace' | 'crm' | 'employer';

interface MemberPortalProps {
  memberID: number;
  retirementDate: string;
  onSwitchToWorkspace: () => void;
  onSwitchToCRM: () => void;
  onChangeView: (mode: ViewMode) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  const d = new Date(normalized);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function yearsOfService(hireDate: string): number {
  const normalized = hireDate.includes('T') ? hireDate : hireDate + 'T00:00:00';
  const hire = new Date(normalized);
  const now = new Date();
  const diff = now.getTime() - hire.getTime();
  return Math.round((diff / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10;
}

function tierName(tier: number): string {
  return `Tier ${tier}`;
}

function isVested(hireDate: string): boolean {
  return yearsOfService(hireDate) >= 5;
}

function vestingYear(hireDate: string): string {
  const normalized = hireDate.includes('T') ? hireDate : hireDate + 'T00:00:00';
  const hire = new Date(normalized);
  hire.setFullYear(hire.getFullYear() + 5);
  return hire.getFullYear().toString();
}

// Generate projection data from current balance + contribution history
function buildProjectionData(
  currentBalance: number,
  annualContribution: number,
  retirementYear: number,
): ProjectionDataPoint[] {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 4;
  const endYear = Math.max(retirementYear + 2, currentYear + 8);
  const points: ProjectionDataPoint[] = [];
  const growthRate = 0.072; // 7.2% projected
  const conservativeRate = 0.05; // 5% conservative

  for (let y = startYear; y <= endYear; y += 2) {
    const yearsFromNow = y - currentYear;
    const projectedGrowth = currentBalance * Math.pow(1 + growthRate, yearsFromNow);
    const futureContributions = yearsFromNow > 0 ? annualContribution * yearsFromNow : 0;
    const projected = Math.round(projectedGrowth + futureContributions * (1 + growthRate / 2));
    const conservativeGrowth = currentBalance * Math.pow(1 + conservativeRate, yearsFromNow);
    const conservative = Math.round(
      conservativeGrowth + futureContributions * (1 + conservativeRate / 2),
    );
    const totalContributed = Math.round(
      currentBalance * 0.41 + (yearsFromNow > 0 ? annualContribution * 0.41 * yearsFromNow : 0),
    );

    points.push({
      year: y.toString(),
      projected: Math.max(projected, 0),
      conservative: Math.max(conservative, 0),
      contributed: Math.max(totalContributed, 0),
    });
  }
  return points;
}

// ── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  sub,
  color = C.sage,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '18px 22px',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: C.textTertiary,
          marginBottom: 6,
          letterSpacing: '0.3px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: DISPLAY,
          color: C.navy,
          letterSpacing: '-0.5px',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

// ── Milestone ────────────────────────────────────────────────────────────────

interface Milestone {
  label: string;
  date: string;
  note: string;
  icon: string;
  done: boolean;
}

function buildMilestones(member: {
  hire_date: string;
  tier_code: number;
  dob: string;
}): Milestone[] {
  const hireNorm = member.hire_date.includes('T')
    ? member.hire_date
    : member.hire_date + 'T00:00:00';
  const dobNorm = member.dob.includes('T') ? member.dob : member.dob + 'T00:00:00';
  const hireYear = new Date(hireNorm).getFullYear();
  const birthYear = new Date(dobNorm).getFullYear();
  const svcYears = yearsOfService(member.hire_date);
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  const milestones: Milestone[] = [];

  // Vesting milestone
  const vestYear = hireYear + 5;
  milestones.push({
    label: 'Fully Vested',
    date: vestYear.toString(),
    note: '5 years of service',
    icon: '\u2713',
    done: vestYear <= currentYear,
  });

  // 10-year service mark
  const tenYear = hireYear + 10;
  milestones.push({
    label: '10-Year Service Mark',
    date: tenYear.toString(),
    note: 'Enhanced benefits tier',
    icon: '\u2713',
    done: tenYear <= currentYear,
  });

  // Rule of 75/85
  if (member.tier_code <= 2) {
    const ruleTarget = 75;
    const minAge = 55;
    // age + service >= 75
    const ruleYear = Math.max(
      hireYear + Math.ceil(ruleTarget - (age + svcYears) + svcYears),
      birthYear + minAge,
    );
    milestones.push({
      label: 'Rule of 75 Eligible',
      date: Math.max(ruleYear, currentYear).toString(),
      note: 'Age + service \u2265 75',
      icon: '\u25C6',
      done: age + svcYears >= ruleTarget && age >= minAge,
    });
  } else {
    const ruleTarget = 85;
    const minAge = 60;
    const ruleYear = Math.max(
      hireYear + Math.ceil(ruleTarget - (age + svcYears) + svcYears),
      birthYear + minAge,
    );
    milestones.push({
      label: 'Rule of 85 Eligible',
      date: Math.max(ruleYear, currentYear).toString(),
      note: 'Age + service \u2265 85',
      icon: '\u25C6',
      done: age + svcYears >= ruleTarget && age >= minAge,
    });
  }

  // Normal retirement at 65
  const normalRetYear = birthYear + 65;
  milestones.push({
    label: 'Normal Retirement',
    date: normalRetYear.toString(),
    note: 'Age 65 with 5 yrs service',
    icon: '\u2605',
    done: age >= 65 && svcYears >= 5,
  });

  // Sort: done items first (by date), then upcoming items (by date)
  milestones.sort((a, b) => {
    if (a.done && !b.done) return 1;
    if (!a.done && b.done) return -1;
    return parseInt(a.date) - parseInt(b.date);
  });

  return milestones;
}

// ── Demo / fallback data (shown when backend is unavailable) ────────────────

const DEMO_MEMBER = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  middle_name: 'A',
  dob: '1968-07-15',
  hire_date: '2000-03-15',
  tier_code: 1,
  status_code: 'A',
  marital_status: 'M',
};

const DEMO_CONTRIBUTIONS = {
  total_ee_contributions: 168420,
  total_er_contributions: 244430,
  current_ee_balance: 168420,
  current_er_balance: 244430,
};

const DEMO_MONTHLY_BENEFIT = 4847;

// ── Main Component ───────────────────────────────────────────────────────────

export default function MemberPortal({
  memberID,
  retirementDate,
  onSwitchToWorkspace,
  onSwitchToCRM,
}: MemberPortalProps) {
  const [loaded, setLoaded] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [showChat, setShowChat] = useState(true);

  const { data: member, isLoading: memberLoading, error: memberError } = useMember(memberID);
  const { data: contributions } = useContributions(memberID);
  const { data: beneficiaries } = useBeneficiaries(memberID);
  const { data: calculation } = useBenefitCalculation(memberID, retirementDate);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 80);
  }, []);

  // Use real data if available, demo data as fallback
  const useDemo = !member && !memberLoading;
  const effectiveMember = member ?? (memberError ? DEMO_MEMBER : null);

  if (memberLoading || !effectiveMember) {
    return (
      <div
        style={{
          fontFamily: BODY,
          background: C.pageBg,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            N
          </div>
          <div style={{ color: C.textSecondary, fontSize: 16, fontFamily: BODY }}>
            Loading member data...
          </div>
        </div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const firstName = effectiveMember.first_name;
  const fullName = `${effectiveMember.first_name}${effectiveMember.middle_name ? ` ${effectiveMember.middle_name.charAt(0)}.` : ''} ${effectiveMember.last_name}`;
  const memberId = `DERP-${String(effectiveMember.member_id).padStart(7, '0')}`;
  const svcYears = yearsOfService(effectiveMember.hire_date);
  const vested = isVested(effectiveMember.hire_date);

  // Benefit calculation data — maximum_benefit is the final monthly amount
  const estimatedMonthly = calculation?.maximum_benefit ?? (useDemo ? DEMO_MONTHLY_BENEFIT : 0);
  const estimatedAnnual = estimatedMonthly * 12;

  // Contribution data
  const effectiveContrib = contributions ?? (useDemo ? DEMO_CONTRIBUTIONS : null);
  const employeeContrib = effectiveContrib?.total_ee_contributions ?? 0;
  const employerContrib = effectiveContrib?.total_er_contributions ?? 0;
  const currentBalance =
    (effectiveContrib?.current_ee_balance ?? 0) + (effectiveContrib?.current_er_balance ?? 0);

  // Annual contribution estimate
  const annualContrib = (employeeContrib + employerContrib) / Math.max(svcYears, 1);

  // Retirement year from the date
  const retirementYear = new Date(retirementDate + 'T00:00:00').getFullYear();

  // Build projection data
  const projectionData = buildProjectionData(currentBalance, annualContrib, retirementYear);

  // Build contribution history (last 6 years estimated)
  const currentYear = new Date().getFullYear();
  const contribHistory: ContributionDataPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const yr = currentYear - i;
    const scale = 1 + (5 - i) * 0.03;
    const empEstimate = Math.round(annualContrib * 0.4 * scale);
    const erEstimate = Math.round(annualContrib * 0.6 * scale);
    contribHistory.push({
      year: `'${(yr % 100).toString().padStart(2, '0')}`,
      employee: empEstimate,
      employer: erEstimate,
    });
  }

  // Milestones
  const milestones = buildMilestones(effectiveMember);

  // Beneficiary
  const primaryBeneficiary = beneficiaries?.[0] ?? null;
  const beneficiaryText = primaryBeneficiary
    ? `${primaryBeneficiary.first_name} ${primaryBeneficiary.last_name} (${primaryBeneficiary.relationship})`
    : 'Not on file';

  // ── Render ───────────────────────────────────────────────────────────────

  const navTabs = [
    { key: 'dashboard', label: 'My Benefits' },
    { key: 'messages', label: 'Messages' },
    { key: 'projections', label: 'Projections' },
    { key: 'history', label: 'History' },
    { key: 'documents', label: 'Documents' },
    { key: 'letters', label: 'Letters' },
  ];

  return (
    <div
      style={{
        fontFamily: BODY,
        background: C.pageBg,
        color: C.text,
        minHeight: '100vh',
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      {/* ═══ TOP NAV ═══ */}
      <div
        style={{
          background: 'rgba(248, 247, 244, 0.88)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${C.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 30,
          padding: '0 32px',
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 60,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                N
              </div>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: C.navy,
                    letterSpacing: '-0.3px',
                    fontFamily: DISPLAY,
                    lineHeight: 1.1,
                  }}
                >
                  NoUI
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: C.textTertiary,
                    letterSpacing: '1.5px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Pension Services
                </div>
              </div>
            </div>

            <div style={{ width: 1, height: 28, background: C.border, margin: '0 4px' }} />

            <div style={{ display: 'flex', gap: 2 }}>
              {navTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`portal-nav-btn ${activeView === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveView(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onSwitchToWorkspace}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                border: `1.5px solid ${C.border}`,
                background: 'transparent',
                color: C.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY,
                transition: 'all 0.2s ease',
              }}
            >
              Agent Workspace
            </button>
            <button
              onClick={onSwitchToCRM}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                border: `1.5px solid ${C.border}`,
                background: 'transparent',
                color: C.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY,
                transition: 'all 0.2s ease',
              }}
            >
              CRM
            </button>
            <button
              onClick={() => setShowChat((c) => !c)}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                border: `1.5px solid ${showChat ? C.sage : C.border}`,
                background: showChat ? C.sageLight : 'transparent',
                color: showChat ? C.sage : C.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 14 }}>&#x1F4AC;</span> Ask NoUI
            </button>
            <div style={{ width: 1, height: 24, background: C.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.goldLight}, ${C.sageLight})`,
                  border: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.navy,
                }}
              >
                {effectiveMember.first_name[0]}
                {effectiveMember.last_name[0]}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{fullName}</div>
                <div style={{ fontSize: 10, fontFamily: MONO, color: C.textTertiary }}>
                  {memberId}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ HERO BANNER ═══ */}
      <div
        style={{
          background: `linear-gradient(135deg, ${C.cardBgAccent} 0%, ${C.cardBgAccentLight} 50%, #2A5478 100%)`,
          padding: '36px 32px 40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.04,
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        <div style={{ maxWidth: 1320, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{ fontSize: 13, color: C.textOnDarkDim, fontWeight: 500, marginBottom: 6 }}
              >
                Denver Employees Retirement Plan
              </div>
              <h1
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 32,
                  fontWeight: 600,
                  color: C.textOnDark,
                  letterSpacing: '-0.5px',
                  lineHeight: 1.15,
                  marginBottom: 8,
                }}
              >
                {getGreeting()}, {firstName}.
              </h1>
              <p style={{ fontSize: 14, color: C.textOnDarkMuted, maxWidth: 480 }}>
                Your retirement is on track. Here's a snapshot of your benefits as of today.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'center',
                padding: '16px 28px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    fontFamily: DISPLAY,
                    color: C.textOnDark,
                  }}
                >
                  {formatCurrency(estimatedMonthly)}
                </div>
                <div style={{ fontSize: 11, color: C.textOnDarkDim, marginTop: 2 }}>
                  Est. Monthly Benefit
                </div>
              </div>
              <div style={{ width: 1, height: 44, background: 'rgba(255,255,255,0.12)' }} />
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    fontFamily: DISPLAY,
                    color: C.textOnDark,
                  }}
                >
                  {svcYears.toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: C.textOnDarkDim, marginTop: 2 }}>
                  Years of Service
                </div>
              </div>
              <div style={{ width: 1, height: 44, background: 'rgba(255,255,255,0.12)' }} />
              <div style={{ textAlign: 'center' }}>
                {vested ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#4ADE80' }}>
                        Fully Vested
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.textOnDarkDim, marginTop: 4 }}>
                      Since {vestingYear(effectiveMember.hire_date)}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>
                      Not Yet Vested
                    </div>
                    <div style={{ fontSize: 11, color: C.textOnDarkDim, marginTop: 4 }}>
                      {(5 - svcYears).toFixed(1)} years remaining
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo mode banner */}
      {useDemo && (
        <div
          style={{
            background: C.goldLight,
            borderBottom: `1px solid ${C.gold}`,
            padding: '10px 32px',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: C.gold,
          }}
        >
          Demo Mode — Showing sample data. Connect backend services for live data.
        </div>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 32px 60px' }}>
        {activeView === 'messages' ? (
          <MemberMessageCenter
            memberID={memberID}
            onNavigateToDashboard={() => setActiveView('dashboard')}
          />
        ) : activeView === 'letters' ? (
          <MemberCorrespondenceTab memberId={memberID} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showChat ? '1fr 360px' : '1fr',
              gap: 20,
              transition: 'all 0.3s ease',
            }}
          >
            {/* Left: Dashboard content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              {/* Stat cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 14,
                  opacity: loaded ? 1 : 0,
                  transform: loaded ? 'none' : 'translateY(8px)',
                  transition: 'all 0.5s ease 0.1s',
                }}
              >
                <StatPill
                  label="Current Account Balance"
                  value={currentBalance > 0 ? `$${(currentBalance / 1000).toFixed(0)}k` : '\u2014'}
                  sub={
                    currentBalance > 0 ? `${tierName(effectiveMember.tier_code)} Member` : undefined
                  }
                />
                <StatPill
                  label="Employee Contributions"
                  value={
                    employeeContrib > 0 ? `$${(employeeContrib / 1000).toFixed(0)}k` : '\u2014'
                  }
                  sub="Lifetime total"
                  color={C.gold}
                />
                <StatPill
                  label="Employer Contributions"
                  value={
                    employerContrib > 0 ? `$${(employerContrib / 1000).toFixed(0)}k` : '\u2014'
                  }
                  sub={
                    employerContrib > 0
                      ? `${(employerContrib / Math.max(employeeContrib, 1)).toFixed(2)}\u00D7 match`
                      : undefined
                  }
                  color={C.navyLight}
                />
                <StatPill
                  label="Est. Annual Benefit"
                  value={
                    estimatedAnnual > 0 ? `$${(estimatedAnnual / 1000).toFixed(0)}k` : '\u2014'
                  }
                  sub={estimatedAnnual > 0 ? `At retirement` : undefined}
                  color={C.sage}
                />
              </div>

              {/* Recent Messages card */}
              <RecentMessagesCard memberID={memberID} onViewAll={() => setActiveView('messages')} />

              {/* Projection chart */}
              <div
                className="portal-card"
                style={{
                  padding: 28,
                  opacity: loaded ? 1 : 0,
                  transition: 'all 0.5s ease 0.25s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontFamily: DISPLAY,
                        fontSize: 18,
                        fontWeight: 600,
                        color: C.navy,
                        marginBottom: 4,
                      }}
                    >
                      Benefit Projection
                    </h3>
                    <p style={{ fontSize: 12, color: C.textTertiary }}>
                      Estimated account growth through normal retirement age
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
                      { color: C.sage, label: 'Projected (7.2%)' },
                      { color: C.textTertiary, label: 'Conservative (5%)', dashed: true },
                      { color: C.gold, label: 'Contributions', dashed: true },
                    ].map((legend, i) => (
                      <div
                        key={i}
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
                            width: 14,
                            height: legend.dashed ? 0 : 3,
                            borderRadius: 1,
                            background: legend.dashed ? 'none' : legend.color,
                            borderTop: legend.dashed ? `2px dashed ${legend.color}` : 'none',
                          }}
                        />
                        {legend.label}
                      </div>
                    ))}
                  </div>
                </div>
                <BenefitProjectionChart data={projectionData} />
              </div>

              {/* Bottom row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                  opacity: loaded ? 1 : 0,
                  transition: 'all 0.5s ease 0.35s',
                }}
              >
                {/* Contribution History */}
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

                {/* Milestones */}
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
                    Retirement Milestones
                  </h3>
                  <p style={{ fontSize: 12, color: C.textTertiary, marginBottom: 20 }}>
                    Key dates on your retirement journey
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {milestones.map((ms, i) => (
                      <div
                        key={i}
                        className="portal-milestone-line"
                        style={{ paddingBottom: i < milestones.length - 1 ? 20 : 0 }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: 1,
                            top: 2,
                            width: 18,
                            height: 18,
                            borderRadius: 6,
                            background: ms.done ? C.sageLight : C.goldLight,
                            border: `2px solid ${ms.done ? C.sage : C.gold}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            color: ms.done ? C.sage : C.gold,
                            fontWeight: 700,
                            zIndex: 1,
                          }}
                        >
                          {ms.icon}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: ms.done ? C.text : C.navy,
                              }}
                            >
                              {ms.label}
                            </span>
                            <span
                              className="portal-tag"
                              style={{
                                background: ms.done ? C.sageLight : C.goldLight,
                                color: ms.done ? C.sage : C.gold,
                              }}
                            >
                              {ms.date}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                            {ms.note}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Personal details footer */}
              <div
                className="portal-card"
                style={{
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 32,
                  opacity: loaded ? 1 : 0,
                  transition: 'all 0.5s ease 0.45s',
                }}
              >
                {[
                  { label: 'Beneficiary', value: beneficiaryText },
                  { label: 'Hire Date', value: formatDate(effectiveMember.hire_date) },
                  { label: 'Retirement Date', value: formatDate(retirementDate) },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 500 }}>
                      {item.label}:
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                      {item.value}
                    </span>
                    {i < 2 && (
                      <div
                        style={{ width: 1, height: 20, background: C.borderLight, marginLeft: 24 }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Phase 1 transparency footer */}
              <div
                style={{
                  padding: '14px 20px',
                  borderRadius: 12,
                  background: C.cardBgWarm,
                  border: `1px solid ${C.borderLight}`,
                  textAlign: 'center',
                }}
              >
                <p
                  style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, marginBottom: 2 }}
                >
                  Phase 1: Transparent
                </p>
                <p style={{ fontSize: 11, color: C.textTertiary }}>
                  The system shows its work. Every calculation is transparent and verifiable. The
                  deterministic rules engine executes certified plan provisions.
                </p>
              </div>
            </div>

            {/* Right: AI Chat Panel */}
            {showChat && <AIChatPanel />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Member Message Center ─────────────────────────────────────────────────────

function MemberMessageCenter({
  memberID,
}: {
  memberID: number;
  onNavigateToDashboard: () => void;
}) {
  const [selectedConvId, setSelectedConvId] = useState('');
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState('');

  const { data: contact } = useContactByMemberId(String(memberID));
  const contactId = contact?.contactId ?? '';
  const { data: conversations } = useMemberConversations(String(memberID));
  const sendMessage = useCreateMemberMessage();
  const createConv = useCreateMemberConversation();

  const convList = conversations ?? [];

  // Auto-select first conversation
  const effectiveConvId = selectedConvId || (convList.length > 0 ? convList[0].conversationId : '');
  const { data: interactions } = useMemberPublicInteractions(effectiveConvId);

  const handleSend = (message: string) => {
    if (composing) {
      // Creating a new conversation
      if (!newSubject.trim()) return;
      createConv.mutate(
        {
          anchorType: 'MEMBER',
          anchorId: String(memberID),
          subject: newSubject.trim(),
          initialMessage: message,
          contactId,
          direction: 'inbound',
        },
        {
          onSuccess: (result) => {
            setComposing(false);
            setNewSubject('');
            setSelectedConvId(result.conversation.conversationId);
          },
        },
      );
    } else if (effectiveConvId) {
      sendMessage.mutate({
        conversationId: effectiveConvId,
        contactId,
        content: message,
        direction: 'inbound',
      });
    }
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    open: { bg: C.sageLight, text: C.sage },
    pending: { bg: C.goldLight, text: C.gold },
    resolved: { bg: '#E8EDF4', text: C.navyLight },
    closed: { bg: '#F1F5F9', text: '#64748B' },
    reopened: { bg: C.coralLight, text: C.coral },
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 16,
        minHeight: 500,
        fontFamily: BODY,
      }}
    >
      {/* Left panel: Thread list */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 16,
              fontWeight: 600,
              color: C.navy,
            }}
          >
            Conversations
          </h3>
          <button
            onClick={() => {
              setComposing(true);
              setSelectedConvId('');
            }}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: `1px solid ${C.sage}`,
              background: C.sageLight,
              color: C.sage,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            + New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' as const }}>
          {convList.map((conv) => {
            const isSelected = conv.conversationId === effectiveConvId && !composing;
            const status = statusColors[conv.status] || statusColors.closed;
            const lastUpdated = formatRelativeDate(conv.updatedAt);

            return (
              <button
                key={conv.conversationId}
                onClick={() => {
                  setSelectedConvId(conv.conversationId);
                  setComposing(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left' as const,
                  padding: '12px 18px',
                  borderBottom: `1px solid ${C.borderLight}`,
                  background: isSelected ? C.sageLight : 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: isSelected ? `3px solid ${C.sage}` : '3px solid transparent',
                  transition: 'all 0.15s ease',
                  fontFamily: BODY,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.navy,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                      flex: 1,
                    }}
                  >
                    {conv.subject || 'Untitled'}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: status.bg,
                      color: status.text,
                      fontSize: 10,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {conv.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 4 }}>
                  {conv.interactionCount} message{conv.interactionCount !== 1 ? 's' : ''} &middot;{' '}
                  {lastUpdated}
                </div>
              </button>
            );
          })}

          {convList.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: C.textTertiary, fontSize: 12 }}>
              No conversations yet. Click "+ New" to start one.
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Thread detail */}
      <div
        style={{
          background: C.cardBg,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {composing ? (
          <>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <h3 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.navy }}>
                New Conversation
              </h3>
              <p style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                Send a secure message to DERP staff
              </p>
            </div>
            <div style={{ flex: 1 }} />
            <MessageComposer
              theme={MEMBER_THEME}
              onSend={handleSend}
              placeholder="Type your message..."
              showSubject
              onSubjectChange={setNewSubject}
            />
          </>
        ) : effectiveConvId ? (
          <>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <h3 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.navy }}>
                {convList.find((c) => c.conversationId === effectiveConvId)?.subject ||
                  'Conversation'}
              </h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 16px' }}>
              <ConversationThread
                interactions={interactions ?? []}
                visibility="public"
                theme={MEMBER_THEME}
                currentContactId={contactId}
              />
            </div>
            <MessageComposer
              theme={MEMBER_THEME}
              onSend={handleSend}
              placeholder="Reply to this conversation..."
            />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.textTertiary,
              fontSize: 13,
            }}
          >
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  );
}

// ── Recent Messages Card (Dashboard) ──────────────────────────────────────────

function RecentMessagesCard({ memberID, onViewAll }: { memberID: number; onViewAll: () => void }) {
  const { data: conversations } = useMemberConversations(String(memberID));

  const recent = (conversations ?? []).slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <div className="portal-card" style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 16,
              fontWeight: 600,
              color: C.navy,
              marginBottom: 2,
            }}
          >
            Recent Messages
          </h3>
          <p style={{ fontSize: 12, color: C.textTertiary }}>
            Your latest conversations with DERP staff
          </p>
        </div>
        <button
          onClick={onViewAll}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: `1px solid ${C.sage}`,
            background: C.sageLight,
            color: C.sage,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BODY,
          }}
        >
          View all
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent.map((conv) => (
          <button
            key={conv.conversationId}
            onClick={onViewAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${C.borderLight}`,
              background: C.cardBgWarm,
              cursor: 'pointer',
              textAlign: 'left' as const,
              width: '100%',
              fontFamily: BODY,
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.navy,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {conv.subject || 'Untitled'}
              </div>
              <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
                {conv.interactionCount} message{conv.interactionCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textTertiary, flexShrink: 0, marginLeft: 12 }}>
              {formatRelativeDate(conv.updatedAt)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatRelativeDate(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
