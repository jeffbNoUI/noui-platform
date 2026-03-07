/**
 * Shared micro-components used across workflow stages.
 */

export function Field({
  label,
  value,
  highlight,
  badge,
  sub,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  badge?: { text: string; className: string };
  sub?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
      <div>
        <span className="text-sm text-gray-500">{label}</span>
        {sub && <span className="block text-xs text-gray-400 mt-0.5">{sub}</span>}
      </div>
      <span className="flex items-center gap-2">
        {badge && (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.className}`}>
            {badge.text}
          </span>
        )}
        <span className={`font-semibold font-mono text-sm ${highlight ? 'text-iw-sage' : 'text-gray-900'}`}>
          {value}
        </span>
      </span>
    </div>
  );
}

export function Callout({
  type,
  title,
  text,
}: {
  type: 'success' | 'warning' | 'info' | 'danger';
  title?: string;
  text: string;
}) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-50 border-emerald-500 text-emerald-700',
    warning: 'bg-amber-50 border-amber-500 text-amber-700',
    info: 'bg-blue-50 border-blue-500 text-blue-700',
    danger: 'bg-red-50 border-red-500 text-red-700',
  };
  return (
    <div className={`mt-3 p-3 rounded-lg border-l-[3px] ${styles[type]}`}>
      {title && <div className="text-xs font-bold mb-1">{title}</div>}
      <div className="text-xs leading-relaxed">{text}</div>
    </div>
  );
}

export function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcAge(dob: string): number {
  const birth = new Date(dob.includes('T') ? dob : dob + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
