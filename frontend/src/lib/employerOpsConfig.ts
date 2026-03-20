import { C } from '@/lib/designSystem';

export const OPS_THRESHOLDS = {
  dqScoreCritical: Number(import.meta.env.VITE_DQ_SCORE_CRITICAL ?? 60),
  dqScoreWarning: Number(import.meta.env.VITE_DQ_SCORE_WARNING ?? 80),
  slaOverdueWarning: Number(import.meta.env.VITE_SLA_OVERDUE_WARNING ?? 1),
  caseVolumeWarning: Number(import.meta.env.VITE_CASE_VOLUME_WARNING ?? 10),
} as const;

/** Color for DQ score based on threshold boundaries. */
export function dqScoreColor(score: number): string {
  if (score < OPS_THRESHOLDS.dqScoreCritical) return C.coral;
  if (score < OPS_THRESHOLDS.dqScoreWarning) return C.gold;
  return C.sage;
}
