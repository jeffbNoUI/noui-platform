import type { Beneficiary } from '@/types/Member';
import { DetailOverlay, MetadataGrid, Section, StatusBadge } from '@/components/DetailOverlay';

export interface BeneficiaryDetailProps {
  item: Beneficiary;
  sourceRect: DOMRect;
  onClose: () => void;
  items: Beneficiary[];
  currentIndex: number;
  onNavigate: (newIndex: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  PRIMARY: 'Primary',
  CONTINGENT: 'Contingent',
  DEATH_BENEFIT: 'Death Benefit',
};

const TYPE_COLORS: Record<string, string> = {
  Primary: 'bg-blue-50 text-blue-700',
  Contingent: 'bg-purple-50 text-purple-700',
  'Death Benefit': 'bg-gray-100 text-gray-600',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function computeAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export default function BeneficiaryDetail({
  item,
  sourceRect,
  onClose,
  items,
  currentIndex,
  onNavigate,
}: BeneficiaryDetailProps) {
  const typeLabel = TYPE_LABELS[item.bene_type] || item.bene_type;
  const subtitle = `${item.relationship || 'Unknown'} \u00b7 ${item.alloc_pct}% allocation`;

  const metadataFields: { label: string; value: string | undefined | null }[] = [
    { label: 'Relationship', value: item.relationship || 'Not specified' },
    { label: 'Type', value: typeLabel },
    { label: 'Allocation %', value: `${item.alloc_pct}%` },
    {
      label: 'Date of Birth',
      value: item.dob ? `${formatDate(item.dob)} (age ${computeAge(item.dob)})` : undefined,
    },
    { label: 'Effective Date', value: formatDate(item.eff_date) },
    { label: 'End Date', value: item.end_date ? formatDate(item.end_date) : undefined },
  ];

  return (
    <DetailOverlay
      sourceRect={sourceRect}
      onClose={onClose}
      totalItems={items.length}
      currentIndex={currentIndex}
      onNavigate={onNavigate}
      icon={
        <span role="img" aria-label="beneficiary">
          👤
        </span>
      }
      title={`${item.first_name} ${item.last_name}`}
      subtitle={subtitle}
      statusBadge={<StatusBadge status={typeLabel} colorMap={TYPE_COLORS} />}
    >
      <Section title="Beneficiary Details">
        <MetadataGrid fields={metadataFields} />
      </Section>
    </DetailOverlay>
  );
}
