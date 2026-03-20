// ─── Employer Ops Hooks ─────────────────────────────────────────────────────
// React Query hooks for Phase 8 cross-service employer endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEmployerRoster,
  fetchEmployerMemberSummary,
  fetchEmployerDQScore,
  fetchEmployerDQIssues,
  fetchEmployerDQChecks,
  fetchOrgInteractions,
  fetchOrgContacts,
  createEmployerInteraction,
  fetchEmployerTemplates,
  generateEmployerLetter,
  fetchEmployerCases,
  fetchEmployerCaseSummary,
  createEmployerCase,
} from '@/lib/employerOpsApi';
import type {
  EmployerAlert,
  AlertSeverity,
  ActivityEvent,
  CreateEmployerInteractionRequest,
  GenerateEmployerLetterRequest,
  CreateEmployerCaseRequest,
} from '@/types/EmployerOps';
import { OPS_THRESHOLDS } from '@/lib/employerOpsConfig';

// ─── Query hooks ────────────────────────────────────────────────────────────

export function useEmployerRoster(orgId: string, limit?: number, offset?: number) {
  return useQuery({
    queryKey: ['employer-ops', 'roster', orgId, limit, offset],
    queryFn: () => fetchEmployerRoster(orgId, { limit, offset }),
    enabled: !!orgId,
  });
}

export function useEmployerMemberSummary(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'member-summary', orgId],
    queryFn: () => fetchEmployerMemberSummary(orgId),
    enabled: !!orgId,
  });
}

export function useEmployerDQScore(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'dq-score', orgId],
    queryFn: () => fetchEmployerDQScore(orgId),
    enabled: !!orgId,
  });
}

export function useEmployerDQIssues(
  orgId: string,
  opts?: { severity?: string; status?: string; limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['employer-ops', 'dq-issues', orgId, opts],
    queryFn: () => fetchEmployerDQIssues(orgId, opts),
    enabled: !!orgId,
  });
}

export function useEmployerDQChecks(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'dq-checks', orgId],
    queryFn: () => fetchEmployerDQChecks(orgId),
    enabled: !!orgId,
  });
}

export function useOrgInteractions(orgId: string, category?: string) {
  return useQuery({
    queryKey: ['employer-ops', 'interactions', orgId, category],
    queryFn: () => fetchOrgInteractions(orgId, { category }),
    enabled: !!orgId,
  });
}

export function useOrgContacts(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'contacts', orgId],
    queryFn: () => fetchOrgContacts(orgId),
    enabled: !!orgId,
  });
}

export function useEmployerTemplates() {
  return useQuery({
    queryKey: ['employer-ops', 'templates'],
    queryFn: () => fetchEmployerTemplates(),
  });
}

export function useEmployerCases(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'cases', orgId],
    queryFn: () => fetchEmployerCases(orgId),
    enabled: !!orgId,
  });
}

export function useEmployerCaseSummary(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'case-summary', orgId],
    queryFn: () => fetchEmployerCaseSummary(orgId),
    enabled: !!orgId,
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────────────────

export function useCreateEmployerInteraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: CreateEmployerInteractionRequest) => createEmployerInteraction(vars),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['employer-ops', 'interactions', vars.orgId],
      });
    },
  });
}

export function useGenerateEmployerLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: GenerateEmployerLetterRequest) => generateEmployerLetter(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employer-ops', 'templates'],
      });
    },
  });
}

export function useCreateEmployerCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: CreateEmployerCaseRequest) => createEmployerCase(vars),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['employer-ops', 'cases', vars.employerOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ['employer-ops', 'case-summary', vars.employerOrgId],
      });
    },
  });
}

// ─── Alert aggregation hook ─────────────────────────────────────────────────

const ALERT_REFETCH_INTERVAL = 60_000;

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function useEmployerAlerts(orgIds: string[], orgNames: Record<string, string>) {
  // Fan out DQ score queries for all orgs
  const dqScoreQueries = useQueries({
    queries: orgIds.map((orgId) => ({
      queryKey: ['employer-ops', 'dq-score', orgId],
      queryFn: () => fetchEmployerDQScore(orgId),
      enabled: !!orgId,
      refetchInterval: ALERT_REFETCH_INTERVAL,
    })),
  });

  // Fan out case summary queries for all orgs
  const caseSummaryQueries = useQueries({
    queries: orgIds.map((orgId) => ({
      queryKey: ['employer-ops', 'case-summary', orgId],
      queryFn: () => fetchEmployerCaseSummary(orgId),
      enabled: !!orgId,
      refetchInterval: ALERT_REFETCH_INTERVAL,
    })),
  });

  const isLoading =
    dqScoreQueries.some((q) => q.isLoading) || caseSummaryQueries.some((q) => q.isLoading);

  const alerts: EmployerAlert[] = [];

  for (let i = 0; i < orgIds.length; i++) {
    const orgId = orgIds[i];
    const orgName = orgNames[orgId] ?? orgId;
    const dq = dqScoreQueries[i]?.data;
    const cs = caseSummaryQueries[i]?.data;

    // DQ score alerts
    if (dq) {
      if (dq.overallScore < OPS_THRESHOLDS.dqScoreCritical) {
        alerts.push({
          orgId,
          orgName,
          type: 'dq_score',
          severity: 'critical',
          message: `Data quality score ${dq.overallScore}% is critically low`,
          value: dq.overallScore,
        });
      } else if (dq.overallScore < OPS_THRESHOLDS.dqScoreWarning) {
        alerts.push({
          orgId,
          orgName,
          type: 'dq_score',
          severity: 'warning',
          message: `Data quality score ${dq.overallScore}% below warning threshold`,
          value: dq.overallScore,
        });
      }

      // DQ issues alert
      if (dq.openIssues > 0) {
        alerts.push({
          orgId,
          orgName,
          type: 'dq_issues',
          severity: dq.criticalIssues > 0 ? 'critical' : 'warning',
          message:
            dq.criticalIssues > 0
              ? `${dq.criticalIssues} critical data quality issues`
              : `${dq.openIssues} open data quality issues`,
          value: dq.criticalIssues > 0 ? dq.criticalIssues : dq.openIssues,
        });
      }
    }

    // Case-based alerts
    if (cs) {
      // SLA breach
      if (cs.atRiskCases >= OPS_THRESHOLDS.slaOverdueWarning) {
        alerts.push({
          orgId,
          orgName,
          type: 'sla_breach',
          severity: 'critical',
          message: `${cs.atRiskCases} cases at risk of SLA breach`,
          value: cs.atRiskCases,
        });
      }

      // Case volume
      if (cs.activeCases >= OPS_THRESHOLDS.caseVolumeWarning) {
        alerts.push({
          orgId,
          orgName,
          type: 'case_volume',
          severity: 'info',
          message: `${cs.activeCases} active cases — high volume`,
          value: cs.activeCases,
        });
      }
    }
  }

  // Sort: critical first, then warning, then info, then by orgName
  alerts.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.orgName.localeCompare(b.orgName);
  });

  return { alerts, isLoading };
}

// ─── Unified Activity Feed hook ───────────────────────────────────────────

export function useEmployerActivity(orgId: string): { events: ActivityEvent[] } {
  const { data: interactionsData } = useOrgInteractions(orgId);
  const { data: casesData } = useEmployerCases(orgId);
  const { data: issuesData } = useEmployerDQIssues(orgId);

  const events = useMemo(() => {
    const result: ActivityEvent[] = [];

    // ── Interactions → ActivityEvent ──────────────────────────────────
    for (const ix of interactionsData?.items ?? []) {
      const channel = String(ix?.channel ?? '');
      let icon = '\u{1F4AC}'; // 💬
      if (channel.startsWith('phone'))
        icon = '\u{1F4DE}'; // 📞
      else if (channel.startsWith('email') || channel === 'secure_message')
        icon = '\u{2709}\u{FE0F}'; // ✉️

      result.push({
        id: ix?.interactionId ?? '',
        type: 'interaction',
        timestamp: ix?.startedAt ?? ix?.endedAt ?? '',
        summary: ix?.summary ?? `${channel} interaction`,
        icon,
      });
    }

    // ── Cases → ActivityEvent ────────────────────────────────────────
    for (const c of casesData?.items ?? []) {
      const status = c?.status ?? '';
      let icon = '\u{1F4CB}'; // 📋
      if (c?.sla === 'at-risk' || c?.sla === 'urgent')
        icon = '\u{1F534}'; // 🔴
      else if (status === 'completed' || status === 'closed') icon = '\u{2705}'; // ✅

      result.push({
        id: c?.caseId ?? '',
        type: 'case_change',
        timestamp: c?.updatedAt ?? c?.createdAt ?? '',
        summary: `${c?.caseType ?? 'Case'} — ${c?.stage ?? status}`,
        icon,
        severity: c?.sla === 'at-risk' || c?.sla === 'urgent' ? 'warning' : undefined,
      });
    }

    // ── DQ Issues → ActivityEvent ────────────────────────────────────
    for (const dq of issuesData?.items ?? []) {
      const status = dq?.status ?? '';
      const icon = status === 'resolved' ? '\u{2705}' : '\u{1F4CB}'; // ✅ or 📋

      result.push({
        id: dq?.issueId ?? '',
        type: 'dq_issue',
        timestamp: dq?.createdAt ?? '',
        summary: dq?.description ?? 'Data quality issue',
        icon,
        severity:
          dq?.severity === 'critical'
            ? 'critical'
            : dq?.severity === 'warning'
              ? 'warning'
              : undefined,
      });
    }

    // Sort newest-first
    result.sort((a, b) => {
      const ta = a.timestamp || '';
      const tb = b.timestamp || '';
      return tb.localeCompare(ta);
    });

    return result;
  }, [interactionsData, casesData, issuesData]);

  return { events };
}
