const PROFICIENCY_STYLES = {
  Guided: 'bg-blue-50 text-blue-700 border-blue-200',
  Assisted: 'bg-amber-50 text-amber-700 border-amber-200',
  Expert: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export interface TeamMember {
  name: string;
  cases: number;
  proficiency: 'Expert' | 'Assisted' | 'Guided';
  avgDays: number;
  efficiency: number;
  signal: string;
}

interface SupervisorDashboardTeamTableProps {
  teamMembers: TeamMember[];
  isLoading: boolean;
}

export default function SupervisorDashboardTeamTable({
  teamMembers,
  isLoading,
}: SupervisorDashboardTeamTableProps) {
  return (
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
            {isLoading ? (
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="h-5 bg-gray-200 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : teamMembers.length > 0 ? (
              teamMembers.map((tm) => (
                <tr key={tm.name} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-iw-sageLight flex items-center justify-center text-xs font-bold text-iw-sage">
                        {tm.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{tm.name}</span>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3 text-sm font-mono text-gray-700">
                    {tm.cases}
                  </td>
                  <td className="text-center px-3 py-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PROFICIENCY_STYLES[tm.proficiency]}`}
                    >
                      {tm.proficiency}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3 text-sm font-mono text-gray-700">
                    {tm.avgDays}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            tm.efficiency >= 90
                              ? 'bg-emerald-400'
                              : tm.efficiency >= 70
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                          }`}
                          style={{ width: `${tm.efficiency}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{tm.efficiency}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 italic">{tm.signal}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-gray-400">
                  No team data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
