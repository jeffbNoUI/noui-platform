interface StaffPortalKPIStatsProps {
  total: number;
  urgent: number;
  atRisk: number;
  avgDays: number;
}

export default function StaffPortalKPIStats({
  total,
  urgent,
  atRisk,
  avgDays,
}: StaffPortalKPIStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
          Active Cases
        </div>
        <div className="text-2xl font-bold text-iw-navy mt-1">{total}</div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Urgent</div>
        <div className="text-2xl font-bold text-red-600 mt-1">{urgent}</div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
          SLA At Risk
        </div>
        <div className="text-2xl font-bold text-amber-600 mt-1">{atRisk}</div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
          Avg Days Open
        </div>
        <div className="text-2xl font-bold text-gray-700 mt-1">{avgDays}</div>
      </div>
    </div>
  );
}
