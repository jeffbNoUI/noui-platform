import type { ReactNode } from 'react';

interface ReferenceCardProps {
  title: string;
  count?: number | string;
  preview?: string;
  highlight?: boolean;
  isLoading?: boolean;
  onViewAll?: () => void;
  children?: ReactNode;
}

export default function ReferenceCard({
  title,
  count,
  preview,
  highlight,
  isLoading,
  onViewAll,
  children,
}: ReferenceCardProps) {
  const borderClass = highlight ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200 bg-white';

  return (
    <div className={`rounded-lg border shadow-sm overflow-hidden ${borderClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        {count != null && (
          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {count}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-3 pb-2">
        {isLoading ? (
          <div className="h-5 w-2/3 rounded bg-gray-100 animate-pulse" />
        ) : children ? (
          <div className="text-xs text-gray-600">{children}</div>
        ) : preview ? (
          <p className="text-xs text-gray-600 line-clamp-1">{preview}</p>
        ) : (
          <p className="text-xs text-gray-400 italic">None on file</p>
        )}
      </div>

      {/* Footer */}
      {onViewAll && (
        <div className="border-t border-gray-100 px-3 py-1.5">
          <button
            onClick={onViewAll}
            className="text-[11px] font-medium text-iw-sage hover:text-iw-sageDark transition-colors"
          >
            View all &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
