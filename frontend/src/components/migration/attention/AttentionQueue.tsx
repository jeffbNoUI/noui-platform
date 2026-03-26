import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import { useAttentionItems } from '@/hooks/useMigrationApi';
import { migrationAPI } from '@/lib/migrationApi';
import CorpusIndicator from '../ai/CorpusIndicator';
import type { AttentionItem } from '@/types/Migration';

interface Props {
  engagementId: string;
}

type PriorityFilter = 'ALL' | 'P1' | 'P2' | 'P3';

const PRIORITY_COLORS: Record<string, string> = {
  P1: C.coral,
  P2: C.gold,
  P3: C.sky,
};

const FILTER_OPTIONS: { key: PriorityFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'P1', label: 'P1' },
  { key: 'P2', label: 'P2' },
  { key: 'P3', label: 'P3' },
];

function AttentionItemCard({
  item,
  onResolve,
  onDefer,
  isLoading,
}: {
  item: AttentionItem;
  onResolve: (note: string) => void;
  onDefer: (note: string) => void;
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState<'resolve' | 'defer' | null>(null);
  const [note, setNote] = useState('');
  const color = PRIORITY_COLORS[item.priority] || C.sky;

  const handleConfirm = () => {
    if (showNoteInput === 'resolve') {
      onResolve(note);
    } else if (showNoteInput === 'defer') {
      onDefer(note);
    }
    setShowNoteInput(null);
    setNote('');
  };

  const handleCancel = () => {
    setShowNoteInput(null);
    setNote('');
  };

  return (
    <div
      style={{
        background: C.cardBg,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${color}`,
        padding: 14,
        fontFamily: BODY,
      }}
    >
      {/* Top row: priority badge + source tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 700,
            color: C.textOnDark,
            background: color,
          }}
        >
          {item.priority}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            color: C.textTertiary,
          }}
        >
          {item.source}
        </span>
      </div>

      {/* Summary */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: C.navy,
          marginBottom: 4,
        }}
      >
        {item.summary}
      </div>

      {/* Detail */}
      <div
        style={{
          fontSize: 13,
          color: C.textSecondary,
          lineHeight: 1.5,
          marginBottom: 8,
          ...(expanded
            ? {}
            : {
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }),
        }}
      >
        {item.detail}
      </div>

      {item.detail.length > 100 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 11,
            color: C.sky,
            cursor: 'pointer',
            fontFamily: BODY,
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Suggested action box */}
      {item.suggestedAction && (
        <div
          style={{
            background: C.pageBg,
            borderRadius: 6,
            padding: '8px 10px',
            marginBottom: 10,
            fontSize: 12,
            color: C.text,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              color: C.textTertiary,
              marginBottom: 3,
              letterSpacing: '0.03em',
            }}
          >
            Suggested Action
          </div>
          {item.suggestedAction}
          {item.corpusContext && (
            <div style={{ marginTop: 4 }}>
              <CorpusIndicator context={item.corpusContext} />
            </div>
          )}
        </div>
      )}

      {/* Resolution note input */}
      {showNoteInput && (
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder={showNoteInput === 'resolve' ? 'Resolution note...' : 'Deferral reason...'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            aria-label="resolution note"
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: 12,
              fontFamily: BODY,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              background: C.pageBg,
              color: C.text,
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: 6,
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <ActionButton
              label={showNoteInput === 'resolve' ? 'Confirm Resolve' : 'Confirm Defer'}
              color={showNoteInput === 'resolve' ? C.sage : C.textTertiary}
              filled
              onClick={handleConfirm}
              disabled={isLoading}
            />
            <ActionButton label="Cancel" color={C.textTertiary} filled={false} onClick={handleCancel} disabled={isLoading} />
          </div>
        </div>
      )}

      {/* Action buttons — hidden when note input is showing */}
      {!showNoteInput && (
        <div style={{ display: 'flex', gap: 8 }}>
          {item.priority === 'P1' ? (
            <>
              <ActionButton label="Resolve" color={C.sage} filled onClick={() => setShowNoteInput('resolve')} disabled={isLoading} />
              <ActionButton label="Defer" color={C.textTertiary} filled={false} onClick={() => setShowNoteInput('defer')} disabled={isLoading} />
            </>
          ) : (
            <>
              <ActionButton label="Apply to All" color={C.sage} filled onClick={() => setShowNoteInput('resolve')} disabled={isLoading} />
              <ActionButton label="Review" color={C.sky} filled={false} onClick={() => {}} disabled={isLoading} />
              <ActionButton label="Defer" color={C.textTertiary} filled={false} onClick={() => setShowNoteInput('defer')} disabled={isLoading} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  color,
  filled,
  onClick,
  disabled = false,
}: {
  label: string;
  color: string;
  filled: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: BODY,
        fontSize: 11,
        fontWeight: 600,
        padding: '5px 12px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.15s',
        opacity: disabled ? 0.5 : 1,
        ...(filled
          ? {
              background: color,
              color: C.textOnDark,
              border: 'none',
            }
          : {
              background: 'transparent',
              color: color,
              border: `1px solid ${color}`,
            }),
      }}
    >
      {label}
    </button>
  );
}

export default function AttentionQueue({ engagementId }: Props) {
  const [filter, setFilter] = useState<PriorityFilter>('ALL');
  const [mutatingItemId, setMutatingItemId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useAttentionItems(
    engagementId,
    filter === 'ALL' ? undefined : { priority: filter },
  );

  const activeItems = items?.filter((i) => !i.resolved) ?? [];
  const totalCount = activeItems.length;

  const handleMutation = async (
    itemId: string,
    source: string,
    action: 'resolve' | 'defer',
    note: string,
  ) => {
    setMutatingItemId(itemId);

    // Optimistic update: remove the item from the list immediately.
    const queryKey = ['migration', 'attention', engagementId, filter === 'ALL' ? undefined : { priority: filter }];
    const previousItems = queryClient.getQueryData<AttentionItem[]>(queryKey);

    queryClient.setQueryData<AttentionItem[]>(queryKey, (old) =>
      old?.map((i) => (i.id === itemId ? { ...i, resolved: true } : i)),
    );

    try {
      if (action === 'resolve') {
        await migrationAPI.resolveAttentionItem(engagementId, itemId, source, note);
      } else {
        await migrationAPI.deferAttentionItem(engagementId, itemId, source, note);
      }
      // Invalidate to refetch fresh data from server.
      queryClient.invalidateQueries({ queryKey: ['migration', 'attention'] });
    } catch {
      // Rollback on error.
      queryClient.setQueryData(queryKey, previousItems);
    } finally {
      setMutatingItemId(null);
    }
  };

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3
            style={{
              fontFamily: DISPLAY,
              fontSize: 16,
              fontWeight: 600,
              color: C.navy,
              margin: 0,
            }}
          >
            Attention
          </h3>
          {totalCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                padding: '0 6px',
                fontSize: 11,
                fontWeight: 700,
                background: C.coral,
                color: C.textOnDark,
              }}
            >
              {totalCount}
            </span>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = filter === opt.key;
          const pillColor =
            opt.key === 'ALL'
              ? C.navy
              : PRIORITY_COLORS[opt.key] || C.navy;

          return (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              style={{
                fontFamily: BODY,
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 14px',
                borderRadius: 14,
                cursor: 'pointer',
                transition: 'all 0.15s',
                ...(isActive
                  ? {
                      background: pillColor,
                      color: C.textOnDark,
                      border: `1px solid ${pillColor}`,
                    }
                  : {
                      background: 'transparent',
                      color: pillColor,
                      border: `1px solid ${C.border}`,
                    }),
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Item list */}
      {isLoading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            fontSize: 13,
            color: C.textTertiary,
          }}
        >
          Loading...
        </div>
      ) : activeItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>&#10003;</div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: C.sage,
            }}
          >
            No items requiring attention
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeItems.map((item) => (
            <AttentionItemCard
              key={item.id}
              item={item}
              isLoading={mutatingItemId === item.id}
              onResolve={(note) => handleMutation(item.id, item.source, 'resolve', note)}
              onDefer={(note) => handleMutation(item.id, item.source, 'defer', note)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
