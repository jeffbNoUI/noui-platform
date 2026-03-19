import { useState } from 'react';
import { C } from '@/lib/designSystem';
import { usePendingDuplicates, useResolveDuplicate } from '@/hooks/useEmployerEnrollment';
import type { DuplicateMatchType } from '@/types/Employer';

interface DuplicateResolutionProps {
  orgId: string;
}

const MATCH_TYPE_LABELS: Record<DuplicateMatchType, { label: string; icon: string }> = {
  SSN_EXACT: { label: 'SSN Exact Match', icon: '!' },
  NAME_DOB_FUZZY: { label: 'Name + DOB Fuzzy Match', icon: '?' },
};

const MATCH_TYPE_COLORS: Record<DuplicateMatchType, { bg: string; text: string }> = {
  SSN_EXACT: { bg: C.coralLight, text: C.coral },
  NAME_DOB_FUZZY: { bg: C.goldLight, text: C.gold },
};

export default function DuplicateResolution({ orgId }: DuplicateResolutionProps) {
  const { data: result, isLoading } = usePendingDuplicates(orgId);
  const resolveMutation = useResolveDuplicate();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const duplicates = result?.items ?? [];
  const total = result?.pagination?.total ?? 0;

  const handleResolve = async (flagId: string, resolution: string) => {
    setError(null);
    try {
      await resolveMutation.mutateAsync({ id: flagId, resolution, note: resolveNote.trim() });
      setResolvingId(null);
      setResolveNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: C.textSecondary, fontSize: 14 }}>Loading duplicates...</div>
    );
  }

  if (total === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: C.textSecondary,
          fontSize: 14,
          background: C.cardBg,
          borderRadius: 8,
          border: `1px solid ${C.border}`,
        }}
      >
        No pending duplicate flags to review.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text }}>
          Duplicate Review Queue
        </h3>
        <span style={{ fontSize: 13, color: C.textSecondary }}>
          {total} pending {total === 1 ? 'flag' : 'flags'}
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: C.coralLight,
            color: C.coral,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {duplicates.map((flag) => {
        const matchColors = MATCH_TYPE_COLORS[flag.matchType as DuplicateMatchType];
        const matchLabel = MATCH_TYPE_LABELS[flag.matchType as DuplicateMatchType];
        const isResolving = resolvingId === flag.id;
        const confidence = parseFloat(flag.confidenceScore);

        return (
          <div
            key={flag.id}
            style={{
              padding: 16,
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: matchColors.bg,
                    color: matchColors.text,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {matchLabel.label}
                </span>
                <span style={{ fontSize: 12, color: C.textSecondary }}>
                  Confidence: {(confidence * 100).toFixed(0)}%
                </span>
              </div>
              <span style={{ fontSize: 12, color: C.textSecondary }}>
                Submission: {flag.submissionId.substring(0, 8)}...
              </span>
            </div>

            {flag.matchedMemberId && (
              <div style={{ fontSize: 13, color: C.textSecondary }}>
                Matched existing member: {flag.matchedMemberId.substring(0, 8)}...
              </div>
            )}
            {flag.matchedSubmissionId && (
              <div style={{ fontSize: 13, color: C.textSecondary }}>
                Matched submission: {flag.matchedSubmissionId.substring(0, 8)}...
              </div>
            )}

            {!isResolving ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setResolvingId(flag.id)}
                  style={{
                    padding: '6px 14px',
                    background: C.sky,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Review
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Resolution note..."
                  rows={2}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleResolve(flag.id, 'FALSE_POSITIVE')}
                    disabled={resolveMutation.isPending}
                    style={{
                      padding: '6px 14px',
                      background: C.sage,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Not a Duplicate
                  </button>
                  <button
                    onClick={() => handleResolve(flag.id, 'CONFIRMED_DUPLICATE')}
                    disabled={resolveMutation.isPending}
                    style={{
                      padding: '6px 14px',
                      background: C.coral,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Confirm Duplicate
                  </button>
                  <button
                    onClick={() => {
                      setResolvingId(null);
                      setResolveNote('');
                    }}
                    style={{
                      padding: '6px 14px',
                      background: 'transparent',
                      color: C.textSecondary,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
