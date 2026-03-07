import type { ReactNode } from 'react';
import type { StageDescriptor } from '@/lib/workflowComposition';

interface StageCardProps {
  stage: StageDescriptor;
  index: number;
  isActive: boolean;
  isDone: boolean;
  children?: ReactNode;
  onNavigate?: () => void;
  /** Render navigation buttons inside the card */
  actions?: ReactNode;
}

export default function StageCard({
  stage,
  index,
  isActive,
  isDone,
  children,
  onNavigate,
  actions,
}: StageCardProps) {
  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-300 ${
        isActive
          ? 'border-iw-sage shadow-lg bg-white'
          : isDone
          ? 'border-gray-200 bg-white cursor-pointer hover:border-gray-300 hover:shadow-sm'
          : 'border-gray-100 bg-gray-50/50'
      }`}
      onClick={isDone && !isActive ? onNavigate : undefined}
    >
      {/* Header */}
      <div className={`flex justify-between items-center ${isActive ? 'px-5 py-4' : 'px-4 py-2.5'}`}>
        <div className="flex items-center gap-3">
          <span className={`transition-all ${isActive ? 'text-xl' : 'text-sm'}`}>{stage.icon}</span>
          <div>
            <span
              className={`${
                isActive
                  ? 'text-gray-900 font-bold text-[15px]'
                  : isDone
                  ? 'text-gray-600 font-medium text-sm'
                  : 'text-gray-400 text-sm'
              }`}
            >
              {stage.label}
              {isDone && !isActive && <span className="text-iw-sage text-xs ml-2">✓</span>}
            </span>
            {isActive && (
              <span className="block text-xs text-gray-400 mt-0.5">{stage.description}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stage.conditional && (
            <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 font-semibold">
              Conditional
            </span>
          )}
          {isActive && (
            <span className="text-xs text-gray-400">Stage {index + 1}</span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isActive && children && (
        <div className="px-5 pb-5">
          {children}
          {actions && <div className="mt-5 flex justify-between">{actions}</div>}
        </div>
      )}
    </div>
  );
}
