import type { ProjectionDataPoint } from './BenefitProjectionChart';

// ── Shared Types ─────────────────────────────────────────────────────────────

export type ViewMode = 'portal' | 'workspace' | 'crm' | 'employer';

export interface MemberPortalProps {
  memberID: number;
  retirementDate: string;
  onSwitchToWorkspace: () => void;
  onSwitchToCRM: () => void;
  onChangeView: (mode: ViewMode) => void;
}

export interface Milestone {
  label: string;
  date: string;
  note: string;
  icon: string;
  done: boolean;
}

// ── Demo / Fallback Data ─────────────────────────────────────────────────────

export const DEMO_MEMBER = {
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

export const DEMO_CONTRIBUTIONS = {
  total_ee_contributions: 168420,
  total_er_contributions: 244430,
  current_ee_balance: 168420,
  current_er_balance: 244430,
};

export const DEMO_MONTHLY_BENEFIT = 4847;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  const d = new Date(normalized);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function yearsOfService(hireDate: string): number {
  const normalized = hireDate.includes('T') ? hireDate : hireDate + 'T00:00:00';
  const hire = new Date(normalized);
  const now = new Date();
  const diff = now.getTime() - hire.getTime();
  return Math.round((diff / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10;
}

export function tierName(tier: number): string {
  return `Tier ${tier}`;
}

export function isVested(hireDate: string): boolean {
  return yearsOfService(hireDate) >= 5;
}

export function vestingYear(hireDate: string): string {
  const normalized = hireDate.includes('T') ? hireDate : hireDate + 'T00:00:00';
  const hire = new Date(normalized);
  hire.setFullYear(hire.getFullYear() + 5);
  return hire.getFullYear().toString();
}

export function formatRelativeDate(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Generate projection data from current balance + contribution history
export function buildProjectionData(
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

// Build milestones from member data
export function buildMilestones(member: {
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
