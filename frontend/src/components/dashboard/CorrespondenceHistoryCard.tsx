import { useRef, useState, useMemo } from 'react';
import type { Correspondence } from '@/types/Correspondence';
import CorrespondenceDetail from '@/components/detail/CorrespondenceDetail';

interface CorrespondenceHistoryCardProps {
  correspondence: Correspondence[];
}

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700',
  final: 'bg-blue-50 text-blue-700',
  draft: 'bg-gray-100 text-gray-600',
  void: 'bg-red-50 text-red-700',
};

const INITIAL_LIMIT = 5;

export default function CorrespondenceHistoryCard({
  correspondence,
}: CorrespondenceHistoryCardProps) {
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const filteredCorrespondence = useMemo(() => {
    if (!searchTerm.trim()) return correspondence;
    const q = searchTerm.toLowerCase();
    return correspondence.filter((item) => item.subject.toLowerCase().includes(q));
  }, [correspondence, searchTerm]);

  // When search is active, show all matches; otherwise cap at INITIAL_LIMIT
  const visible = searchTerm.trim()
    ? filteredCorrespondence
    : showAll
      ? filteredCorrespondence
      : filteredCorrespondence.slice(0, INITIAL_LIMIT);

  const hasMore = !searchTerm.trim() && filteredCorrespondence.length > INITIAL_LIMIT;

  const handleRowClick = (item: Correspondence) => {
    const el = rowRefs.current.get(item.correspondenceId);
    if (!el) return;
    const idx = visible.indexOf(item);
    setSourceRect(el.getBoundingClientRect());
    setSelectedIdx(idx >= 0 ? idx : 0);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 shrink-0">Correspondence</h3>
        <div className="flex items-center gap-3">
          {correspondence.length > 0 && (
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-48 rounded-md border border-gray-200 bg-gray-50 pl-7 pr-2 py-1 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300"
              />
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}
          {correspondence.length > 0 && (
            <span className="text-xs text-gray-400 shrink-0">
              {searchTerm.trim()
                ? `${filteredCorrespondence.length} of ${correspondence.length} matching`
                : `${correspondence.length} items`}
            </span>
          )}
        </div>
      </div>

      {correspondence.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No correspondence on file</div>
      ) : (
        <>
          {visible.length === 0 && searchTerm.trim() && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No correspondence matches &ldquo;{searchTerm}&rdquo;
            </div>
          )}

          {visible.length > 0 && (
            <div className="divide-y divide-gray-100">
              {visible.map((item) => (
                <div
                  key={item.correspondenceId}
                  ref={(el) => {
                    if (el) rowRefs.current.set(item.correspondenceId, el);
                    else rowRefs.current.delete(item.correspondenceId);
                  }}
                  onClick={() => handleRowClick(item)}
                  className="px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-800">{item.subject}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[item.status] || ''}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.generatedBy}
                    {item.sentAt ? (
                      <>
                        {' '}
                        &middot; Sent{' '}
                        {new Date(item.sentAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </>
                    ) : (
                      <>
                        {' '}
                        &middot; Created{' '}
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full border-t border-gray-200 px-5 py-2.5 text-xs font-medium text-iw-sage hover:bg-gray-50 transition-colors"
            >
              {showAll ? 'Show less' : `Show all ${correspondence.length} items`}
            </button>
          )}
        </>
      )}

      {selectedIdx != null && sourceRect && (
        <CorrespondenceDetail
          item={visible[selectedIdx]}
          sourceRect={sourceRect}
          onClose={() => {
            setSelectedIdx(null);
            setSourceRect(null);
          }}
          items={visible}
          currentIndex={selectedIdx}
          onNavigate={(newIdx) => setSelectedIdx(newIdx)}
        />
      )}
    </div>
  );
}
