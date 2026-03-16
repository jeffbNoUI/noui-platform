import type { ViewMode } from '@/types/auth';

interface VendorPortalProps {
  onChangeView?: (mode: ViewMode) => void;
}

/**
 * Vendor Portal — Health insurance enrollment specialist view.
 * Enrollment queue replaced with Coming Soon placeholder (no enrollment API exists).
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
                  {'\u2190'} Back to Staff
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

        {/* Enrollment queue — Coming Soon */}
        <div className="bg-white rounded-lg border border-[#c8dbd8] overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-[#e2edeb]">
            <h2 className="text-sm font-bold text-[#14312d]">Enrollment Queue</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-sm text-[#6b9691] text-center max-w-md mb-4">
              Online enrollment processing is coming soon. You will be able to review, verify, and
              manage health insurance enrollments directly from this portal.
            </p>
            <span className="text-xs font-semibold px-4 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-[#c8dbd8]">
              Coming Soon
            </span>
          </div>
        </div>

        <footer className="mt-6 text-center text-[10px] text-[#a3bfbb]">
          Vendor Portal {'\u00b7'} Kaiser Permanente {'\u00b7'} Enrollment Specialist View
        </footer>
      </main>
    </div>
  );
}
