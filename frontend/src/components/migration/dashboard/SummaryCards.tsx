import { C, BODY, MONO } from '@/lib/designSystem';
import { useAttentionSummary } from '@/hooks/useMigrationApi';
import type { DashboardSummary } from '@/types/Migration';

interface SummaryCardsProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}

interface CardDef {
  label: string;
  getValue: (s: DashboardSummary, p1Count?: number) => string;
  getColor: (s: DashboardSummary, p1Count?: number) => string;
}

const CARDS: CardDef[] = [
  {
    label: 'Active Engagements',
    getValue: (s) => String(s.active_engagements),
    getColor: () => C.navy,
  },
  {
    label: 'Batches Running',
    getValue: (s) => String(s.batches_running),
    getColor: () => C.navy,
  },
  {
    label: 'Attention Items',
    getValue: (_s, p1Count) => String(p1Count ?? 0),
    getColor: (_s, p1Count) => ((p1Count ?? 0) > 0 ? C.coral : C.sage),
  },
  {
    label: 'Best Recon Score',
    getValue: (s) => `${(s.best_recon_score * 100).toFixed(1)}%`,
    getColor: (s) => {
      const pct = s.best_recon_score;
      if (pct >= 0.95) return C.sage;
      if (pct >= 0.9) return C.gold;
      return C.coral;
    },
  },
];

function SkeletonCard() {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <div
        className="animate-pulse"
        style={{
          height: 32,
          width: 60,
          borderRadius: 6,
          background: C.borderLight,
          marginBottom: 8,
        }}
      />
      <div
        className="animate-pulse"
        style={{ height: 14, width: 100, borderRadius: 4, background: C.borderLight }}
      />
    </div>
  );
}

export default function SummaryCards({ summary, isLoading }: SummaryCardsProps) {
  const { data: attentionSummary } = useAttentionSummary();
  const p1Count = attentionSummary?.p1 ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map((card) => (
        <div
          key={card.label}
          style={{
            background: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 28,
              fontWeight: 700,
              color: card.getColor(summary, p1Count),
            }}
          >
            {card.getValue(summary, p1Count)}
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 13,
              color: C.textSecondary,
              marginTop: 4,
            }}
          >
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
