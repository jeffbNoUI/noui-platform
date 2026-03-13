import { useState } from 'react';
import type { DQIssue } from '@/types/DataQuality';
import { DetailOverlay, MetadataGrid, Section, StatusBadge } from '@/components/DetailOverlay';
import { useUpdateDQIssue } from '@/hooks/useDataQuality';

export interface DQIssueDetailProps {
  item: DQIssue;
  sourceRect: DOMRect;
  onClose: () => void;
  items: DQIssue[];
  currentIndex: number;
  onNavigate: (newIndex: number) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-blue-50 text-blue-700',
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: '\u{1F534}',
  warning: '\u{1F7E1}',
  info: '\u{1F535}',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DQIssueDetail({
  item,
  sourceRect,
  onClose,
  items,
  currentIndex,
  onNavigate,
}: DQIssueDetailProps) {
  const updateMutation = useUpdateDQIssue();
  const [showResolveInput, setShowResolveInput] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  const subtitle = [item.fieldName, `${item.recordTable}:${item.recordId}`]
    .filter(Boolean)
    .join(' \u00B7 ');

  const isActionable = item.status === 'open' || item.status === 'acknowledged';

  const handleAcknowledge = () => {
    updateMutation.mutate({ issueId: item.issueId, req: { status: 'acknowledged' } });
  };

  const handleResolve = () => {
    if (!showResolveInput) {
      setShowResolveInput(true);
      return;
    }
    updateMutation.mutate({
      issueId: item.issueId,
      req: { status: 'resolved', resolutionNote: resolutionNote || undefined },
    });
    setShowResolveInput(false);
    setResolutionNote('');
  };

  const handleFalsePositive = () => {
    updateMutation.mutate({ issueId: item.issueId, req: { status: 'false_positive' } });
  };

  const footer = isActionable ? (
    <div className="flex items-center gap-2 flex-wrap">
      {item.status === 'open' && (
        <button
          onClick={handleAcknowledge}
          disabled={updateMutation.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Acknowledge
        </button>
      )}
      <button
        onClick={handleResolve}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
      >
        Resolve
      </button>
      <button
        onClick={handleFalsePositive}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        False Positive
      </button>
      {showResolveInput && (
        <div className="flex items-center gap-2 w-full mt-1">
          <input
            type="text"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Resolution note (optional)"
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400"
            data-testid="resolution-note-input"
          />
          <button
            onClick={handleResolve}
            disabled={updateMutation.isPending}
            className="px-3 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <DetailOverlay
      sourceRect={sourceRect}
      onClose={onClose}
      totalItems={items.length}
      currentIndex={currentIndex}
      onNavigate={onNavigate}
      icon={
        <span role="img" aria-label={item.severity}>
          {SEVERITY_ICONS[item.severity] || SEVERITY_ICONS.info}
        </span>
      }
      title={item.description}
      subtitle={subtitle}
      statusBadge={<StatusBadge status={item.severity} colorMap={SEVERITY_COLORS} />}
      footer={footer}
    >
      {/* Metadata */}
      <MetadataGrid
        fields={[
          { label: 'Status', value: item.status },
          { label: 'Field Name', value: item.fieldName },
          { label: 'Record Table', value: item.recordTable },
          { label: 'Record ID', value: item.recordId },
          { label: 'Current Value', value: item.currentValue },
          { label: 'Expected Pattern', value: item.expectedPattern },
          { label: 'Created At', value: formatDate(item.createdAt) },
        ]}
      />

      {/* Resolution info */}
      {(item.status === 'resolved' || item.status === 'false_positive') && (
        <Section title="Resolution">
          <MetadataGrid
            fields={[
              {
                label: 'Resolved At',
                value: item.resolvedAt ? formatDate(item.resolvedAt) : undefined,
              },
              { label: 'Resolved By', value: item.resolvedBy },
              { label: 'Resolution Note', value: item.resolutionNote },
            ]}
          />
        </Section>
      )}
    </DetailOverlay>
  );
}
