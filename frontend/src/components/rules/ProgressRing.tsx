// frontend/src/components/rules/ProgressRing.tsx
interface ProgressRingProps {
  passing: number;
  total: number;
  size?: number;
}

export default function ProgressRing({ passing, total, size = 36 }: ProgressRingProps) {
  const pct = total > 0 ? Math.round((passing / total) * 100) : 0;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={pct === 100 ? 'text-green-500' : pct > 0 ? 'text-green-400' : 'text-gray-300'}
        />
      </svg>
      <span className="absolute text-[8px] font-semibold text-gray-600">{pct}%</span>
    </div>
  );
}
