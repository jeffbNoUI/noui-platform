const TEAM_MEMBERS = [
  { name: 'Sarah Chen', cases: 4, proficiency: 'Expert' as const, avgDays: 6.2, efficiency: 94, signal: 'Expert — high efficiency' },
  { name: 'Michael Torres', cases: 6, proficiency: 'Assisted' as const, avgDays: 8.5, efficiency: 82, signal: 'Ready for Expert' },
  { name: 'Lisa Park', cases: 3, proficiency: 'Guided' as const, avgDays: 12.1, efficiency: 68, signal: 'On track' },
  { name: 'James Wilson', cases: 5, proficiency: 'Assisted' as const, avgDays: 7.8, efficiency: 87, signal: 'Near Expert threshold' },
  { name: 'Amanda Roberts', cases: 2, proficiency: 'Guided' as const, avgDays: 15.3, efficiency: 55, signal: 'Needs mentoring' },
];

const APPROVAL_QUEUE = [
  { caseId: 'RET-2026-0141', member: 'Thomas Anderson', type: 'DRO Review', submittedBy: 'Sarah Chen', daysWaiting: 2 },
  { caseId: 'RET-2026-0138', member: 'Maria Gonzalez', type: 'Early Retirement', submittedBy: 'Michael Torres', daysWaiting: 4 },
  { caseId: 'RET-2026-0145', member: 'William Taylor', type: 'Certification', submittedBy: 'Lisa Park', daysWaiting: 1 },
];

const CASELOAD_BY_STAGE = [
  { stage: 'Intake', count: 5, color: 'bg-blue-400' },
  { stage: 'Employment', count: 3, color: 'bg-cyan-400' },
  { stage: 'Eligibility', count: 4, color: 'bg-emerald-400' },
  { stage: 'Benefit Calc', count: 6, color: 'bg-amber-400' },
  { stage: 'Election', count: 2, color: 'bg-orange-400' },
  { stage: 'Certification', count: 3, color: 'bg-iw-sage' },
];

const PROFICIENCY_STYLES = {
  Guided: 'bg-blue-50 text-blue-700 border-blue-200',
  Assisted: 'bg-amber-50 text-amber-700 border-amber-200',
  Expert: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function SupervisorDashboard() {
  const totalCases = TEAM_MEMBERS.reduce((a, m) => a + m.cases, 0);
  const avgProcessing = (TEAM_MEMBERS.reduce((a, m) => a + m.avgDays, 0) / TEAM_MEMBERS.length).toFixed(1);
  const atRisk = 3;
  const completed = 47;
  const qaFindings = 2;

  const maxStageCount = Math.max(...CASELOAD_BY_STAGE.map((s) => s.count));

  return (
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Active Cases', value: totalCases, color: 'text-iw-navy' },
          { label: 'Avg Processing', value: `${avgProcessing}d`, color: 'text-gray-700' },
          { label: 'At Risk', value: atRisk, color: 'text-amber-600' },
          { label: 'Completed (MTD)', value: completed, color: 'text-emerald-600' },
          { label: 'QA Findings', value: qaFindings, color: 'text-red-600' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{m.label}</div>
            <div className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Team performance table (2/3) */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700">Team Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-semibold">Analyst</th>
                  <th className="text-center px-3 py-2 font-semibold">Cases</th>
                  <th className="text-center px-3 py-2 font-semibold">Mode</th>
                  <th className="text-center px-3 py-2 font-semibold">Avg Days</th>
                  <th className="text-left px-3 py-2 font-semibold">Efficiency</th>
                  <th className="text-left px-3 py-2 font-semibold">Signal</th>
                </tr>
              </thead>
              <tbody>
                {TEAM_MEMBERS.map((tm) => (
                  <tr key={tm.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-iw-sageLight flex items-center justify-center text-xs font-bold text-iw-sage">
                          {tm.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{tm.name}</span>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3 text-sm font-mono text-gray-700">{tm.cases}</td>
                    <td className="text-center px-3 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PROFICIENCY_STYLES[tm.proficiency]}`}>
                        {tm.proficiency}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3 text-sm font-mono text-gray-700">{tm.avgDays}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              tm.efficiency >= 90 ? 'bg-emerald-400' : tm.efficiency >= 70 ? 'bg-amber-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${tm.efficiency}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-mono">{tm.efficiency}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 italic">{tm.signal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Caseload by stage (1/3) */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700">Caseload by Stage</h3>
          </div>
          <div className="p-4 space-y-3">
            {CASELOAD_BY_STAGE.map((s) => (
              <div key={s.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{s.stage}</span>
                  <span className="font-mono text-gray-500">{s.count}</span>
                </div>
                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${s.color}`}
                    style={{ width: `${(s.count / maxStageCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Approval queue */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Pending Approvals</h3>
          <span className="text-xs text-amber-600 font-semibold">{APPROVAL_QUEUE.length} waiting</span>
        </div>
        <div>
          {APPROVAL_QUEUE.map((item) => (
            <div key={item.caseId} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono font-semibold text-iw-navy">{item.caseId}</span>
                <span className="text-sm text-gray-700">{item.member}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                  {item.type}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">by {item.submittedBy} · {item.daysWaiting}d ago</span>
                <button className="px-3 py-1.5 rounded-lg bg-iw-sage text-white text-xs font-semibold hover:bg-iw-sageDark transition-colors">
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
