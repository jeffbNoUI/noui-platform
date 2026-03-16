// ── Employer slate color palette ────────────────────────────────────────────

export const EC = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  navy: '#1E293B',
  navyLight: '#334155',
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  accent: '#475569',
  accentLight: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  green: '#059669',
  greenLight: '#ECFDF5',
  amber: '#D97706',
  amberLight: '#FFFBEB',
} as const;

// ── Date formatter ──────────────────────────────────────────────────────────

export function fmtDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Shared types ────────────────────────────────────────────────────────────

export type ViewMode = 'portal' | 'workspace' | 'crm' | 'employer';
export type PortalTab = 'communications' | 'reporting' | 'enrollment' | 'correspondence';
