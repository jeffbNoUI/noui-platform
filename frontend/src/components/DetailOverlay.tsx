import { useEffect, type ReactNode } from 'react';
import { useSpawnAnimation } from '@/hooks/useSpawnAnimation';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DetailOverlayProps {
  sourceRect: DOMRect;
  onClose: () => void;
  totalItems?: number;
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

// ─── Main component ─────────────────────────────────────────────────────────

export function DetailOverlay({
  sourceRect,
  onClose,
  totalItems,
  currentIndex,
  onNavigate,
  icon,
  title,
  subtitle,
  statusBadge,
  footer,
  children,
}: DetailOverlayProps) {
  const { panelRef, isVisible, style, open, close } = useSpawnAnimation();

  const canNavigate = totalItems != null && currentIndex != null && onNavigate;
  const hasPrev = canNavigate && currentIndex > 0;
  const hasNext = canNavigate && currentIndex < totalItems - 1;

  const handleClose = () => {
    close();
    setTimeout(onClose, 350);
  };

  // Trigger open animation on mount
  useEffect(() => {
    open(sourceRect);
  }, [open, sourceRect]);

  // Keyboard: Escape to close, ArrowLeft/ArrowRight to navigate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        onNavigate?.((currentIndex ?? 0) - 1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onNavigate?.((currentIndex ?? 0) + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        data-testid="detail-overlay-backdrop"
        className="absolute inset-0 bg-black/30 transition-opacity"
        style={{ opacity: style.opacity, transitionDuration: '350ms' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-[55vw] max-w-3xl max-h-[70vh] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        style={{
          ...style,
          transformOrigin: 'center center',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            {icon && <span className="text-2xl">{icon}</span>}
            <div>
              <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>
              {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {statusBadge}
            {canNavigate && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => hasPrev && onNavigate?.((currentIndex ?? 0) - 1)}
                  disabled={!hasPrev}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
                  title="Previous (←)"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="text-xs text-gray-400 tabular-nums min-w-[4rem] text-center">
                  {(currentIndex ?? 0) + 1} of {totalItems}
                </span>
                <button
                  onClick={() => hasNext && onNavigate?.((currentIndex ?? 0) + 1)}
                  disabled={!hasNext}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
                  title="Next (→)"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none p-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">{children}</div>

        {/* Footer */}
        {footer && <div className="border-t border-gray-200 px-6 py-3 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface MetadataGridProps {
  fields: { label: string; value: string | undefined | null }[];
}

export function MetadataGrid({ fields }: MetadataGridProps) {
  const visible = fields.filter((f) => f.value != null);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {visible.map((field) => (
        <div key={field.label}>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
            {field.label}
          </div>
          <div className="text-sm text-gray-800 capitalize mt-0.5">{field.value}</div>
        </div>
      ))}
    </div>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
  colorMap: Record<string, string>;
}

export function StatusBadge({ status, colorMap }: StatusBadgeProps) {
  const colorClass = colorMap[status] || 'text-gray-500 bg-gray-50';
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colorClass}`}>{status}</span>
  );
}
