export const OPS_THRESHOLDS = {
  dqScoreCritical: Number(import.meta.env.VITE_DQ_SCORE_CRITICAL ?? 60),
  dqScoreWarning: Number(import.meta.env.VITE_DQ_SCORE_WARNING ?? 80),
  slaOverdueWarning: Number(import.meta.env.VITE_SLA_OVERDUE_WARNING ?? 1),
  caseVolumeWarning: Number(import.meta.env.VITE_CASE_VOLUME_WARNING ?? 10),
} as const;
