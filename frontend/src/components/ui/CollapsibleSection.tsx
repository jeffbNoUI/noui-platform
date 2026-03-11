import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  defaultExpanded?: boolean;
  className?: string;
  titleClassName?: string;
  badgeClassName?: string;
  children: React.ReactNode;
}

// Same spring-like timing as useSpawnAnimation
const TIMING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const DURATION = '350ms';

export default function CollapsibleSection({
  title,
  badge,
  defaultExpanded = false,
  className,
  titleClassName,
  badgeClassName,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={
        className || 'rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden'
      }
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <h3 className={titleClassName || 'text-sm font-semibold text-gray-900'}>{title}</h3>
          {badge !== undefined && badge !== null && (
            <span
              className={
                badgeClassName ||
                'rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600'
              }
            >
              {badge}
            </span>
          )}
        </div>
        <svg
          className="h-4 w-4 text-gray-400"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: `transform ${DURATION} ${TIMING}`,
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className="grid"
        style={{
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: `grid-template-rows ${DURATION} ${TIMING}`,
        }}
      >
        <div className="overflow-hidden">
          <div
            className="px-5 py-4 border-t border-gray-200"
            style={{
              opacity: expanded ? 1 : 0,
              transition: `opacity ${DURATION} ${TIMING}`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
