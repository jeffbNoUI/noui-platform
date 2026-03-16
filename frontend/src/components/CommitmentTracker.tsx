import { useState, useRef } from 'react';
import { useCommitments, useUpdateCommitment } from '@/hooks/useCRM';
import type { CommitmentListParams } from '@/types/CRM';
import CommitmentDetail from '@/components/detail/CommitmentDetail';
import CommitmentTrackerCard from './CommitmentTrackerCard';
import CommitmentTrackerFilters from './CommitmentTrackerFilters';

interface CommitmentTrackerProps {
  contactId?: string;
  conversationId?: string;
}

export default function CommitmentTracker({ contactId, conversationId }: CommitmentTrackerProps) {
  const params: CommitmentListParams = {
    ...(contactId ? { contactId } : {}),
    ...(conversationId ? { conversationId } : {}),
  };

  const { data, isLoading, error } = useCommitments(params);
  const updateCommitment = useUpdateCommitment();

  const [fulfillInput, setFulfillInput] = useState<Record<string, string>>({});
  const [expandedFulfill, setExpandedFulfill] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  const commitments = data?.items ?? [];

  // Sort: overdue first, then pending, in_progress, fulfilled, cancelled
  const statusOrder: Record<string, number> = {
    overdue: 0,
    pending: 1,
    in_progress: 2,
    fulfilled: 3,
    cancelled: 4,
  };
  const sorted = [...commitments].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 5;
    const orderB = statusOrder[b.status] ?? 5;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
  });

  const filtered = search
    ? sorted.filter((c) => c.description.toLowerCase().includes(search.toLowerCase()))
    : sorted;

  const handleFulfill = (commitmentId: string) => {
    if (expandedFulfill !== commitmentId) {
      setExpandedFulfill(commitmentId);
      return;
    }

    updateCommitment.mutate({
      commitmentId,
      req: {
        status: 'fulfilled',
        fulfillmentNote: fulfillInput[commitmentId]?.trim() || undefined,
      },
    });
    setExpandedFulfill(null);
    setFulfillInput((prev) => {
      const next = { ...prev };
      delete next[commitmentId];
      return next;
    });
  };

  const handleCancel = (commitmentId: string) => {
    updateCommitment.mutate({
      commitmentId,
      req: { status: 'cancelled' },
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
        Loading commitments...
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

  const activeCount = commitments.filter(
    (c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'overdue',
  ).length;
  const overdueCount = commitments.filter((c) => c.status === 'overdue').length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <CommitmentTrackerFilters
        activeCount={activeCount}
        overdueCount={overdueCount}
        search={search}
        onSearchChange={setSearch}
        filteredCount={filtered.length}
        totalCount={sorted.length}
      />

      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-4">No commitments recorded.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((commitment, idx) => (
              <CommitmentTrackerCard
                key={commitment.commitmentId}
                commitment={commitment}
                fulfillInput={fulfillInput[commitment.commitmentId] ?? ''}
                onFulfillInputChange={(val) =>
                  setFulfillInput((prev) => ({ ...prev, [commitment.commitmentId]: val }))
                }
                showFulfillInput={expandedFulfill === commitment.commitmentId}
                onFulfill={() => handleFulfill(commitment.commitmentId)}
                onCancel={() => handleCancel(commitment.commitmentId)}
                isMutating={updateCommitment.isPending}
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
            ))}
          </ul>
        )}
      </div>

      {selectedIdx !== null && sourceRect && (
        <CommitmentDetail
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
