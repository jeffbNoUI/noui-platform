import { fmt } from './shared';
import type { StageDescriptor } from '@/lib/workflowComposition';

interface LiveSummaryProps {
  stages: StageDescriptor[];
  completed: Set<number>;
  activeIdx: number;
  /** Benefit amounts (from calculation or demo data) */
  benefit?: {
    monthlyBenefit?: number;
    reducedBenefit?: number;
    multiplier?: number;
    ams?: number;
    serviceYears?: number;
  };
  /** DRO amounts */
  dro?: {
    memberRemaining?: number;
    altPayeeMonthly?: number;
  } | null;
  /** Elected payment option */
  electedOption?: string;
  electedMonthly?: number;
  /** IPR enrollment */
  iprMonthly?: number;
}

function SumRow({
  label,
  value,
  done,
  color,
}: {
  label: string;
  value: string;
  done: boolean;
  color?: string;
}) {
  return (
    <div
      className="flex justify-between items-center py-1 transition-opacity duration-300"
      style={{ opacity: done ? 1 : 0.45 }}
    >
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className={`text-[11px] font-mono font-semibold ${color || 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * Live calculation summary sidebar.
 * Shows running totals that update as stages are confirmed.
 */
export default function LiveSummary({
  stages,
  completed,
  benefit,
  dro,
  electedOption,
  electedMonthly,
  iprMonthly,
}: LiveSummaryProps) {
  const progress = completed.size;
  const total = stages.length;
  const allDone = progress >= total;
  const pct = total > 0 ? (progress / total) * 100 : 0;

  const monthlyBenefit = benefit?.reducedBenefit || benefit?.monthlyBenefit || 0;
  const hasDro = !!dro?.memberRemaining;
  const displayBenefit = hasDro ? (dro?.memberRemaining || 0) : monthlyBenefit;

  const multiplierLabel = benefit?.multiplier
    ? `${(benefit.multiplier * 100).toFixed(1)}%`
    : '\u2014';

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          Live Calculation
        </h3>
      </div>

      {/* Hero benefit display */}
      <div className="px-4 py-5 text-center border-b border-gray-100">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
          {hasDro ? 'Monthly (after DRO)' : 'Monthly Benefit'}
        </div>
        <div
          className={`text-2xl font-bold font-mono transition-colors duration-300 ${
            progress > 0 ? 'text-iw-sage' : 'text-gray-300'
          }`}
        >
          {fmt(displayBenefit)}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          {multiplierLabel} \u00d7 AMS \u00d7 Service
        </div>
        {progress === 0 && (
          <div className="text-[10px] text-amber-500 mt-1 italic">Pending confirmation</div>
        )}
      </div>

      {/* Line items */}
      <div className="px-4 py-3 space-y-0.5">
        <SumRow
          label="Tier Multiplier"
          value={multiplierLabel}
          done={progress >= 1}
        />
        <SumRow
          label="AMS"
          value={fmt(benefit?.ams)}
          done={progress >= 2}
        />
        <SumRow
          label="Service Credit"
          value={`${(benefit?.serviceYears || 0).toFixed(2)}y`}
          done={progress >= 2}
        />
        <SumRow
          label="Gross Benefit"
          value={fmt(benefit?.monthlyBenefit)}
          done={progress >= 3}
        />
        {benefit?.reducedBenefit && benefit.reducedBenefit !== benefit.monthlyBenefit && (
          <SumRow
            label="After Reduction"
            value={fmt(benefit.reducedBenefit)}
            done={progress >= 4}
            color="text-amber-600"
          />
        )}

        {hasDro && (
          <>
            <div className="border-t border-gray-100 my-2" />
            <SumRow
              label="DRO Split"
              value={fmt(dro?.altPayeeMonthly)}
              done={progress >= 4}
              color="text-red-500"
            />
            <SumRow
              label="Member Remaining"
              value={fmt(dro?.memberRemaining)}
              done={progress >= 4}
              color="text-iw-sage"
            />
          </>
        )}

        {electedOption && (
          <>
            <div className="border-t border-gray-100 my-2" />
            <SumRow
              label={`Option: ${electedOption}`}
              value={fmt(electedMonthly)}
              done={progress >= 5}
            />
          </>
        )}

        {iprMonthly != null && iprMonthly > 0 && (
          <SumRow
            label="IPR (pre-Medicare)"
            value={fmt(iprMonthly)}
            done={progress >= 5}
          />
        )}
      </div>

      {/* Progress footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
          <span>Progress</span>
          <span className="font-mono">
            {progress}/{total}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-400 ${
              allDone ? 'bg-emerald-400' : 'bg-iw-sage'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {allDone && (
          <div className="mt-2 text-center">
            <span className="text-[10px] font-bold text-emerald-600">
              \u2713 Ready for certification
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
