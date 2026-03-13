import { useEffect } from 'react';
import { useSpawnAnimation } from '@/hooks/useSpawnAnimation';
import ConversationPanel from '@/components/ConversationPanel';
import type { Conversation } from '@/types/CRM';

interface ConversationDetailOverlayProps {
  conversationId: string;
  sourceRect: DOMRect;
  onClose: () => void;
  // Navigation props
  conversations?: Conversation[];
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
}

export default function ConversationDetailOverlay({
  conversationId,
  sourceRect,
  onClose,
  conversations,
  currentIndex,
  onNavigate,
}: ConversationDetailOverlayProps) {
  const { panelRef, isVisible, style, open, close } = useSpawnAnimation();

  const canNavigate = conversations && currentIndex != null && onNavigate;
  const hasPrev = canNavigate && currentIndex > 0;
  const hasNext = canNavigate && currentIndex < conversations.length - 1;

  const currentConv = conversations?.[currentIndex ?? 0];
  const subject = currentConv?.subject || 'Untitled Conversation';

  const handleClose = () => {
    close();
    setTimeout(onClose, 350);
  };

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
        onNavigate!(currentIndex! - 1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onNavigate!(currentIndex! + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!isVisible) return null;

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-600',
    reopened: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        style={{ opacity: style.opacity, transitionDuration: '350ms' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-[55vw] max-w-3xl max-h-[70vh] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        style={{ ...style, transformOrigin: 'center center' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">💬</span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">{subject}</h2>
              {currentConv && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[currentConv.status] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {currentConv.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {currentConv.interactionCount} interaction
                    {currentConv.interactionCount !== 1 ? 's' : ''}
                  </span>
                  {currentConv.slaBreached && (
                    <span className="text-[10px] font-medium text-red-600">SLA Breached</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {canNavigate && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => hasPrev && onNavigate!(currentIndex! - 1)}
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
                  {currentIndex! + 1} of {conversations!.length}
                </span>
                <button
                  onClick={() => hasNext && onNavigate!(currentIndex! + 1)}
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

        {/* Body — delegates to ConversationPanel (without its outer card border) */}
        <div className="overflow-y-auto flex-1">
          <ConversationPanel conversationId={conversationId} />
        </div>
      </div>
    </div>
  );
}
