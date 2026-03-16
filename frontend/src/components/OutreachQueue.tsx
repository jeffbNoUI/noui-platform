import { useState, useRef } from 'react';
import { useOutreach, useUpdateOutreach } from '@/hooks/useCRM';
import type { Outreach, OutreachListParams } from '@/types/CRM';
import OutreachDetail from '@/components/detail/OutreachDetail';
import OutreachQueueRow, { priorityBadge } from '@/components/OutreachQueueRow';

interface OutreachQueueProps {
  contactId?: string;
  assignedAgent?: string;
  assignedTeam?: string;
}

export default function OutreachQueue({
  contactId,
  assignedAgent,
  assignedTeam,
}: OutreachQueueProps) {
  const params: OutreachListParams = {
    ...(contactId ? { contactId } : {}),
    ...(assignedAgent ? { assignedAgent } : {}),
    ...(assignedTeam ? { assignedTeam } : {}),
  };

  const { data, isLoading, error } = useOutreach(params);
  const updateOutreach = useUpdateOutreach();

  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  const outreachItems = data?.items ?? [];

  // Sort by priority then due date
  const sorted = [...outreachItems].sort((a, b) => {
    const pa = priorityBadge[a.priority]?.sortOrder ?? 5;
    const pb = priorityBadge[b.priority]?.sortOrder ?? 5;
    if (pa !== pb) return pa - pb;
    if (a.dueBy && b.dueBy) return new Date(a.dueBy).getTime() - new Date(b.dueBy).getTime();
    return 0;
  });

  // Split into active and completed
  const allSorted = sorted;
  const lowerSearch = search.toLowerCase();
  const matchesSearch = (o: Outreach) =>
    !search || (o.subject ?? '').toLowerCase().includes(lowerSearch);

  const active = allSorted.filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled' && matchesSearch(o),
  );
  const completed = allSorted.filter(
    (o) => (o.status === 'completed' || o.status === 'cancelled') && matchesSearch(o),
  );
  const filtered = [...active, ...completed];
  const totalBeforeFilter = allSorted.length;

  const handleAttempt = (outreachId: string) => {
    updateOutreach.mutate({
      outreachId,
      req: { status: 'attempted' },
    });
  };

  const handleComplete = (outreachId: string) => {
    updateOutreach.mutate({
      outreachId,
      req: { status: 'completed' },
    });
  };

  const handleDefer = (outreachId: string) => {
    updateOutreach.mutate({
      outreachId,
      req: { status: 'deferred' },
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
        Loading outreach queue...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error.message}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Outreach Queue</h2>
            <p className="text-sm text-gray-500">
              {active.length} pending task{active.length !== 1 ? 's' : ''}
              {search && ` (${filtered.length} of ${totalBeforeFilter} matching)`}
            </p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search outreach..."
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {active.some((o) => o.priority === 'urgent') && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Urgent items
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        {active.length === 0 && completed.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-4">No outreach tasks.</p>
        ) : (
          <div className="space-y-6">
            {/* Active outreach */}
            {active.length > 0 && (
              <ul className="space-y-3">
                {active.map((outreach) => {
                  const idx = filtered.indexOf(outreach);
                  return (
                    <OutreachQueueRow
                      key={outreach.outreachId}
                      outreach={outreach}
                      onAttempt={() => handleAttempt(outreach.outreachId)}
                      onComplete={() => handleComplete(outreach.outreachId)}
                      onDefer={() => handleDefer(outreach.outreachId)}
                      isMutating={updateOutreach.isPending}
                      rowRef={(el) => {
                        if (el) rowRefs.current.set(idx, el);
                        else rowRefs.current.delete(idx);
                      }}
                      onClick={() => {
                        const el = rowRefs.current.get(idx);
                        if (el) {
                          setSourceRect(el.getBoundingClientRect());
                          setSelectedIdx(idx);
                        }
                      }}
                    />
                  );
                })}
              </ul>
            )}

            {/* Completed outreach (collapsed section) */}
            {completed.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
                  <span className="ml-1">{completed.length} completed/cancelled</span>
                </summary>
                <ul className="mt-3 space-y-3">
                  {completed.map((outreach) => {
                    const idx = filtered.indexOf(outreach);
                    return (
                      <OutreachQueueRow
                        key={outreach.outreachId}
                        outreach={outreach}
                        isMutating={false}
                        rowRef={(el) => {
                          if (el) rowRefs.current.set(idx, el);
                          else rowRefs.current.delete(idx);
                        }}
                        onClick={() => {
                          const el = rowRefs.current.get(idx);
                          if (el) {
                            setSourceRect(el.getBoundingClientRect());
                            setSelectedIdx(idx);
                          }
                        }}
                      />
                    );
                  })}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {selectedIdx !== null && sourceRect && filtered[selectedIdx] && (
        <OutreachDetail
          item={filtered[selectedIdx]}
          sourceRect={sourceRect}
          onClose={() => {
            setSelectedIdx(null);
            setSourceRect(null);
          }}
          items={filtered}
          currentIndex={selectedIdx}
          onNavigate={setSelectedIdx}
        />
      )}
    </div>
  );
}
