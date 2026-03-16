import ProficiencySelector from '@/components/workflow/ProficiencySelector';
import NavigationModelPicker, {
  type NavigationModel,
} from '@/components/workflow/NavigationModelPicker';
import { calcAge } from '@/components/workflow/shared';
import type { ProficiencyLevel } from '@/hooks/useProficiency';
import type { Member } from '@/types/Member';
import type { ServiceCreditResponse } from '@/types/Member';
import type { StageDescriptor } from '@/lib/workflowComposition';

interface RetirementApplicationHeaderProps {
  caseId: string;
  member: Member | undefined;
  svcCreditData: ServiceCreditResponse | undefined;
  retirementDate: string;
  caseFlags?: string[];
  stages: StageDescriptor[];
  activeIdx: number;
  completed: Set<number>;
  proficiency: ProficiencyLevel;
  navModel: NavigationModel;
  onBack: () => void;
  onSetProficiency: (level: ProficiencyLevel) => void;
  onSetNavModel: (model: NavigationModel) => void;
  onNavigate: (idx: number) => void;
}

export default function RetirementApplicationHeader({
  caseId,
  member,
  svcCreditData,
  retirementDate,
  caseFlags,
  stages,
  activeIdx,
  completed,
  proficiency,
  navModel,
  onBack,
  onSetProficiency,
  onSetNavModel,
  onNavigate,
}: RetirementApplicationHeaderProps) {
  return (
    <>
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {'\u2190'} Back to Queue
              </button>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <div className="text-sm font-bold text-iw-navy font-display leading-none">
                  Retirement Application
                </div>
                <div className="text-[10px] text-gray-400 font-mono">{caseId}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ProficiencySelector level={proficiency} onChange={onSetProficiency} />
              <div className="h-5 w-px bg-gray-200" />
              <NavigationModelPicker model={navModel} onChange={onSetNavModel} />
              <div className="text-xs text-gray-400">
                Stage {activeIdx + 1} of {stages.length}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Member banner */}
      {member && (
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 ${
                  member.tier_code === 1
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : member.tier_code === 2
                      ? 'bg-amber-50 border-amber-400 text-amber-700'
                      : 'bg-emerald-50 border-emerald-400 text-emerald-700'
                }`}
              >
                T{member.tier_code}
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {member.first_name} {member.last_name}
                </div>
                <div className="text-xs text-gray-500">
                  ID: {member.member_id} {'\u00b7'} Age {calcAge(member.dob) || '\u2014'} {'\u00b7'}{' '}
                  {svcCreditData?.summary?.earned_years?.toFixed(2) || '\u2014'}y service
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {caseFlags?.map((flag) => (
                <span
                  key={flag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium"
                >
                  {flag}
                </span>
              ))}
              {[
                {
                  label: 'Status',
                  value: member.status_code || 'Active',
                  color: 'text-emerald-600',
                },
                { label: 'Dept', value: member.dept_name || '\u2014' },
                {
                  label: 'Retiring',
                  value: new Date(
                    retirementDate.includes('T') ? retirementDate : retirementDate + 'T00:00:00',
                  ).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                  color: 'text-iw-sage',
                },
              ].map((t) => (
                <div
                  key={t.label}
                  className="px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 text-xs"
                >
                  <span className="text-gray-400">{t.label} </span>
                  <span className={`font-semibold ${t.color || 'text-gray-700'}`}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex gap-1">
            {stages.map((stage, i) => (
              <div
                key={stage.id}
                className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer group relative ${
                  completed.has(i)
                    ? 'bg-iw-sage'
                    : i === activeIdx
                      ? 'bg-iw-sage animate-pulse'
                      : 'bg-gray-200'
                }`}
                onClick={() => onNavigate(i)}
              >
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                    {stage.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
