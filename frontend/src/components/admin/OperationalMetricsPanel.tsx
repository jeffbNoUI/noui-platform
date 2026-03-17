import { useCaseStats, useSLAStats, useVolumeStats } from '@/hooks/useCaseStats';
import { useCommitmentStats } from '@/hooks/useCommitmentStats';
import { useDQScore } from '@/hooks/useDataQuality';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert "intake-review" → "Intake Review" */
function formatStageName(stage: string): string {
  return stage
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OperationalMetricsPanel() {
  const { data: caseStats, isLoading: casesLoading } = useCaseStats();
  const { data: slaStats, isLoading: slaLoading } = useSLAStats();
  const { data: volumeStats } = useVolumeStats();
  const { data: commitments } = useCommitmentStats();
  const { data: dqScore } = useDQScore();

  const dash = '-';

  // KPI values
  const activeCases = caseStats ? String(caseStats.totalActive) : dash;
  const slaTotal = slaStats ? slaStats.onTrack + slaStats.atRisk + slaStats.overdue : 0;
  const slaOnTrackPct = slaTotal > 0 ? ((slaStats!.onTrack / slaTotal) * 100).toFixed(1) : null;
  const slaOnTrack = slaOnTrackPct ? `${slaOnTrackPct}%` : dash;
  const avgProcessing = slaStats ? `${slaStats.avgProcessingDays} days` : dash;
  const dqValue = dqScore ? `${dqScore.overallScore}%` : dash;

  // Pipeline bar data (sorted by count descending)
  const stages = caseStats?.caseloadByStage
    ? [...caseStats.caseloadByStage].sort((a, b) => b.count - a.count)
    : [];
  const maxStageCount = stages.length > 0 ? Math.max(...stages.map((s) => s.count)) : 1;

  // SLA percentages
  const atRiskPct = slaTotal > 0 ? ((slaStats!.atRisk / slaTotal) * 100).toFixed(1) : '0';
  const overduePct = slaTotal > 0 ? ((slaStats!.overdue / slaTotal) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Active Cases" value={activeCases} />
        <KPICard label="SLA On-Track" value={slaOnTrack} />
        <KPICard label="Avg Processing" value={avgProcessing} />
        <KPICard label="DQ Score" value={dqValue} />
      </div>

      {/* Pipeline + SLA row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Case Pipeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Case Pipeline</h3>
          {stages.length === 0 &&
            (casesLoading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : (
              <p className="text-sm text-gray-400">No data</p>
            ))}
          <div className="space-y-2">
            {stages.map((s) => (
              <div key={s.stage} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-40 truncate">
                  {formatStageName(s.stage)}
                </span>
                <div className="flex-1 bg-gray-100 rounded h-4">
                  <div
                    className="bg-blue-500 rounded h-4"
                    style={{ width: `${(s.count / maxStageCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-700 w-6 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SLA Health */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">SLA Health</h3>
          {slaStats ? (
            <>
              <div className="flex rounded overflow-hidden h-6">
                {slaOnTrackPct && parseFloat(slaOnTrackPct) > 0 && (
                  <div
                    className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${slaOnTrackPct}%` }}
                  >
                    {slaOnTrackPct}%
                  </div>
                )}
                {parseFloat(atRiskPct) > 0 && (
                  <div
                    className="bg-amber-400 flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${atRiskPct}%` }}
                  >
                    {atRiskPct}%
                  </div>
                )}
                {parseFloat(overduePct) > 0 && (
                  <div
                    className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${overduePct}%` }}
                  >
                    {overduePct}%
                  </div>
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> On Track (
                  {slaStats.onTrack})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> At Risk (
                  {slaStats.atRisk})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Overdue (
                  {slaStats.overdue})
                </span>
              </div>
            </>
          ) : slaLoading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </div>
      </div>

      {/* Commitments + Volume row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Commitments Due */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Commitments Due</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold text-red-600">{commitments?.overdue ?? dash}</p>
              <p className="text-xs text-gray-500">Overdue</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-amber-500">
                {commitments?.dueThisWeek ?? dash}
              </p>
              <p className="text-xs text-gray-500">Due This Week</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-500">
                {commitments?.upcoming ?? dash}
              </p>
              <p className="text-xs text-gray-500">Upcoming</p>
            </div>
          </div>
        </div>

        {/* Volume Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Case Volume Trend</h3>
          {volumeStats?.months && volumeStats.months.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={volumeStats.months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}
