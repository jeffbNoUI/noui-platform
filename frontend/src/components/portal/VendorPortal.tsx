function fmt(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ENROLLMENT_QUEUE = [
  {
    id: 'ENR-2026-0041',
    member: 'Robert Martinez',
    plan: 'Kaiser HMO',
    status: 'Pending Verification',
    date: 'Mar 15, 2026',
    ipr: 359.38,
  },
  {
    id: 'ENR-2026-0038',
    member: 'David Washington',
    plan: 'Kaiser HMO',
    status: 'Enrolled',
    date: 'Mar 12, 2026',
    ipr: 169.75,
  },
  {
    id: 'ENR-2026-0035',
    member: 'Patricia Morales',
    plan: 'Cigna PPO',
    status: 'Pending Docs',
    date: 'Mar 10, 2026',
    ipr: 212.5,
  },
  {
    id: 'ENR-2026-0029',
    member: 'James Butler',
    plan: 'Kaiser HMO',
    status: 'Enrolled',
    date: 'Mar 5, 2026',
    ipr: 293.75,
  },
];

const STATUS_STYLES: Record<string, string> = {
  Enrolled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Pending Docs': 'bg-amber-50 text-amber-700 border-amber-200',
  'Pending Verification': 'bg-teal-50 text-teal-700 border-teal-200',
};

interface VendorPortalProps {
  onChangeView?: (mode: string) => void;
}

/**
 * Vendor Portal — Health insurance enrollment queue with IPR amounts.
 */
export default function VendorPortal({ onChangeView }: VendorPortalProps) {
  return (
    <div className="min-h-screen bg-[#f7faf9]">
      {/* Top nav */}
      <nav className="bg-white border-b border-[#c8dbd8] shadow-sm">
        <div className="max-w-3xl mx-auto px-5">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm">
                V
              </div>
              <div>
                <div className="text-sm font-bold text-[#14312d] leading-none">Vendor Portal</div>
                <div className="text-[9px] text-[#6b9691] tracking-widest uppercase font-semibold">
                  Health Insurance Enrollment
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {onChangeView && (
                <button
                  onClick={() => onChangeView('staff')}
                  className="text-xs text-[#6b9691] hover:text-[#3d6660] transition-colors"
                >
                  \u2190 Back to Staff
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center text-xs font-bold text-teal-700">
                  JP
                </div>
                <div className="text-xs text-[#3d6660]">James Park</div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Pending Enrollments', value: '6' },
            { label: 'Enrolled This Month', value: '23' },
            { label: 'Avg IPR Benefit', value: '$258.84' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-lg border border-[#c8dbd8] p-4 text-center shadow-sm"
            >
              <div className="text-[10px] text-[#6b9691] uppercase tracking-wider font-semibold">
                {stat.label}
              </div>
              <div className="text-2xl font-extrabold text-[#14312d] font-mono mt-1">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Enrollment queue */}
        <div className="bg-white rounded-lg border border-[#c8dbd8] overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-[#e2edeb]">
            <h2 className="text-sm font-bold text-[#14312d]">Enrollment Queue</h2>
          </div>

          {ENROLLMENT_QUEUE.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between px-4 py-3.5 border-b border-[#e2edeb] hover:bg-[#f0f5f4] transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-[#14312d]">{q.member}</div>
                <div className="text-[11px] text-[#6b9691]">
                  {q.id} \u00b7 {q.plan} \u00b7 {q.date}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-[#6b9691]">IPR</div>
                  <div className="text-sm font-semibold font-mono text-teal-600">{fmt(q.ipr)}</div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    STATUS_STYLES[q.status] || STATUS_STYLES['Pending Verification']
                  }`}
                >
                  {q.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-6 text-center text-[10px] text-[#a3bfbb]">
          Vendor Portal \u00b7 Kaiser Permanente \u00b7 Enrollment Specialist View
        </footer>
      </main>
    </div>
  );
}
