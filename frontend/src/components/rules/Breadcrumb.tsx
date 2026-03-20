// frontend/src/components/rules/Breadcrumb.tsx
export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export default function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {segments.map((segment, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <span className="text-gray-400">{'>'}</span>}
            {segment.onClick && !isLast ? (
              <button
                onClick={segment.onClick}
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                {segment.label}
              </button>
            ) : (
              <span className={isLast ? 'font-medium text-gray-900' : 'text-gray-500'}>
                {segment.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
