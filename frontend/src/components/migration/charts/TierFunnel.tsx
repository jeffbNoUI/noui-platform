import { C, BODY, MONO } from '@/lib/designSystem';

interface TierFunnelProps {
  tier1: { total: number; match: number };
  tier2: { total: number; match: number };
  tier3: { total: number; match: number };
}

interface TierBarProps {
  label: string;
  total: number;
  match: number;
}

function TierBar({ label, total, match }: TierBarProps) {
  const pct = total > 0 ? (match / total) * 100 : 0;

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 500, color: C.text }}>
          {label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.textSecondary }}>
          {match}/{total} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: 12,
          borderRadius: 6,
          background: C.borderLight,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 6,
            background: C.sage,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

export default function TierFunnel({ tier1, tier2, tier3 }: TierFunnelProps) {
  return (
    <div>
      <TierBar label="Tier 1" total={tier1.total} match={tier1.match} />
      <TierBar label="Tier 2" total={tier2.total} match={tier2.match} />
      <TierBar label="Tier 3" total={tier3.total} match={tier3.match} />
    </div>
  );
}
