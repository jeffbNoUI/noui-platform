import { useCaseStats } from '@/hooks/useCaseStats';
import { useCases } from '@/hooks/useCaseManagement';
import SupervisorDashboardTeamTable from '@/components/staff/SupervisorDashboardTeamTable';
import type { TeamMember } from '@/components/staff/SupervisorDashboardTeamTable';

// Stage colors for the horizontal bar chart — follows design system palette
const STAGE_COLORS: Record<string, string> = {
  'Intake Review': 'bg-blue-400',
  'Employment Verification': 'bg-cyan-400',
  'Eligibility Determination': 'bg-emerald-400',
  'Marital Share / DRO': 'bg-amber-400',
  'Benefit Calculation': 'bg-orange-400',
  'Election & Enrollment': 'bg-iw-sage',
  'Final Certification': 'bg-iw-navy',
};

// SLA target baseline for efficiency calculation (standard priority = 90 days)
const SLA_BASELINE_DAYS = 90;

function computeEfficiency(avgDaysOpen: number): number {
  const eff = Math.round(Math.max(0, Math.min(100, (1 - avgDaysOpen / SLA_BASELINE_DAYS) * 100)));
  return eff;
}

function deriveProficiency(efficiency: number): 'Expert' | 'Assisted' | 'Guided' {
  if (efficiency >= 90) return 'Expert';
  if (efficiency >= 70) return 'Assisted';
  return 'Guided';
}

function deriveSignal(proficiency: 'Expert' | 'Assisted' | 'Guided', efficiency: number): string {
  if (proficiency === 'Expert') return 'Expert — high efficiency';
  if (proficiency === 'Assisted' && efficiency >= 85) return 'Near Expert threshold';
  if (proficiency === 'Assisted') return 'Ready for Expert';
  if (efficiency >= 55) return 'On track';
  return 'Needs mentoring';
}

export default function SupervisorDashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useCaseStats();
  const { data: certCases = [] } = useCases({ stage: 'certification' });

  // Derive KPI values from live stats, fallback to 0 during loading
  const totalCases = stats?.totalActive ?? 0;
  const completedMTD = stats?.completedMTD ?? 0;
  const atRisk = stats?.atRiskCount ?? 0;
  const caseloadByStage = stats?.caseloadByStage ?? [];
  const maxStageCount = Math.max(1, ...caseloadByStage.map((s) => s.count));

  // Derive team performance from live assignee stats
  const teamMembers: TeamMember[] = (stats?.casesByAssignee ?? []).map((a) => {
    const efficiency = computeEfficiency(a.avgDaysOpen);
    const proficiency = deriveProficiency(efficiency);
    return {
      name: a.assignedTo,
      cases: a.count,
      proficiency,
      avgDays: Math.round(a.avgDaysOpen * 10) / 10,
      efficiency,
      signal: deriveSignal(proficiency, efficiency),
    };
  });

  // Approval queue: cases at certification stage
  const approvalQueue = certCases.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* API error notice — subtle, doesn't block dashboard */}
      {statsError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="text-amber-600 text-xs font-semibold">Stats unavailable</span>
          <span className="text-amber-500 text-[10px]">{statsError.message}</span>
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Cases', value: totalCases, color: 'text-iw-navy' },
          { label: 'At Risk', value: atRisk, color: 'text-amber-600' },
          { label: 'Completed (MTD)', value: completedMTD, color: 'text-emerald-600' },
          { label: 'Pending Approval', value: approvalQueue.length, color: 'text-blue-600' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              {m.label}
            </div>
            <div className={`text-2xl font-bold mt-1 ${m.color}`}>
              {statsLoading ? (
                <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
              ) : (
                m.value
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Team performance table (2/3) */}
        <SupervisorDashboardTeamTable teamMembers={teamMembers} isLoading={statsLoading} />

        {/* Caseload by stage (1/3) — live from API */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700">Caseload by Stage</h3>
          </div>
          <div className="p-4 space-y-3">
            {statsLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-full" />
                </div>
              ))
            ) : caseloadByStage.length > 0 ? (
              caseloadByStage.map((s) => (
                <div key={s.stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{s.stage}</span>
                    <span className="font-mono text-gray-500">{s.count}</span>
                  </div>
                  <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${STAGE_COLORS[s.stage] ?? 'bg-iw-sage/50'}`}
                      style={{ width: `${(s.count / maxStageCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-400 text-center py-4">No active cases</div>
            )}
          </div>
        </div>
      </div>

      {/* Approval queue — live from API (certification stage cases) */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Pending Approvals</h3>
          <span className="text-xs text-amber-600 font-semibold">
            {approvalQueue.length} waiting
          </span>
        </div>
        <div>
          {approvalQueue.map((item) => (
            <div
              key={item.caseId}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono font-semibold text-iw-navy">{item.caseId}</span>
                <span className="text-sm text-gray-700">{item.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                  {item.caseType === 'DRO' ? 'DRO Review' : item.stage}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">{item.daysOpen}d open</span>
                <button className="px-3 py-1.5 rounded-lg bg-iw-sage text-white text-xs font-semibold hover:bg-iw-sageDark transition-colors">
                  Review
                </button>
              </div>
            </div>
          ))}
          {approvalQueue.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              No cases pending approval
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
