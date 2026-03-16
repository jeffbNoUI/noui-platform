// ── SLA helpers ─────────────────────────────────────────────────────────────

export interface SLAState {
  label: string;
  color: string;
  timeRemaining: string;
  breached: boolean;
  warningLevel: 'safe' | 'warning' | 'danger' | 'breached';
}

export function computeSLAState(
  slaDueAt: string | undefined,
  slaBreached: boolean,
): SLAState | null {
  if (!slaDueAt) return null;

  const now = new Date();
  const due = new Date(slaDueAt);
  const diffMs = due.getTime() - now.getTime();

  if (slaBreached || diffMs < 0) {
    const overMs = Math.abs(diffMs);
    return {
      label: 'SLA Breached',
      color: 'bg-red-100 border-red-300 text-red-800',
      timeRemaining: formatTimeDistance(overMs) + ' overdue',
      breached: true,
      warningLevel: 'breached',
    };
  }

  const totalMinutes = diffMs / 60000;
  if (totalMinutes <= 30) {
    return {
      label: 'SLA Critical',
      color: 'bg-red-50 border-red-200 text-red-700',
      timeRemaining: formatTimeDistance(diffMs) + ' remaining',
      breached: false,
      warningLevel: 'danger',
    };
  }

  if (totalMinutes <= 120) {
    return {
      label: 'SLA Warning',
      color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
      timeRemaining: formatTimeDistance(diffMs) + ' remaining',
      breached: false,
      warningLevel: 'warning',
    };
  }

  return {
    label: 'SLA OK',
    color: 'bg-green-50 border-green-200 text-green-700',
    timeRemaining: formatTimeDistance(diffMs) + ' remaining',
    breached: false,
    warningLevel: 'safe',
  };
}

export function formatTimeDistance(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h`;
}

export function formatTimestamp(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
