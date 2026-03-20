// Employer Ops API client — fetch functions for Phase 8 cross-service employer endpoints.

import {
  fetchAPI,
  fetchPaginatedAPI,
  postAPI,
  toQueryString,
  type PaginatedResult,
} from './apiClient';
import type {
  EmployerRosterMember,
  EmployerMemberSummary,
  EmployerDQScore,
  EmployerDQIssue,
  EmployerDQCheck,
  CreateEmployerInteractionRequest,
  GenerateEmployerLetterRequest,
  EmployerCaseSummary,
  CreateEmployerCaseRequest,
} from '@/types/EmployerOps';
import type { Interaction, Contact } from '@/types/CRM';
import type { CorrespondenceTemplate, Correspondence } from '@/types/Correspondence';
import type { RetirementCase } from '@/types/Case';

// ── Data Access (port 8081) ────────────────────────────────────────────────

interface RosterOpts {
  limit?: number;
  offset?: number;
}

export function fetchEmployerRoster(
  orgId: string,
  opts?: RosterOpts,
): Promise<PaginatedResult<EmployerRosterMember>> {
  const qs = toQueryString(opts ?? {});
  return fetchPaginatedAPI<EmployerRosterMember>(`/api/v1/employer/${orgId}/members${qs}`);
}

export function fetchEmployerMemberSummary(orgId: string): Promise<EmployerMemberSummary> {
  return fetchAPI<EmployerMemberSummary>(`/api/v1/employer/${orgId}/members/summary`);
}

// ── Data Quality (port 8086) ───────────────────────────────────────────────

export function fetchEmployerDQScore(orgId: string): Promise<EmployerDQScore> {
  return fetchAPI<EmployerDQScore>(`/api/v1/dq/employer/${orgId}/score`);
}

interface DQIssueOpts {
  severity?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export function fetchEmployerDQIssues(
  orgId: string,
  opts?: DQIssueOpts,
): Promise<PaginatedResult<EmployerDQIssue>> {
  const qs = toQueryString(opts ?? {});
  return fetchPaginatedAPI<EmployerDQIssue>(`/api/v1/dq/employer/${orgId}/issues${qs}`);
}

interface DQCheckOpts {
  limit?: number;
  offset?: number;
}

export function fetchEmployerDQChecks(
  orgId: string,
  opts?: DQCheckOpts,
): Promise<PaginatedResult<EmployerDQCheck>> {
  const qs = toQueryString(opts ?? {});
  return fetchPaginatedAPI<EmployerDQCheck>(`/api/v1/dq/employer/${orgId}/checks${qs}`);
}

// ── CRM (port 8083/8084) ──────────────────────────────────────────────────

interface InteractionOpts {
  category?: string;
  limit?: number;
  offset?: number;
}

export function fetchOrgInteractions(
  orgId: string,
  opts?: InteractionOpts,
): Promise<PaginatedResult<Interaction>> {
  const qs = toQueryString(opts ?? {});
  return fetchPaginatedAPI<Interaction>(`/api/v1/crm/organizations/${orgId}/interactions${qs}`);
}

interface ContactOpts {
  limit?: number;
  offset?: number;
}

export function fetchOrgContacts(
  orgId: string,
  opts?: ContactOpts,
): Promise<PaginatedResult<Contact>> {
  const qs = toQueryString(opts ?? {});
  return fetchPaginatedAPI<Contact>(`/api/v1/crm/organizations/${orgId}/contacts${qs}`);
}

export function createEmployerInteraction(
  req: CreateEmployerInteractionRequest,
): Promise<Interaction> {
  return postAPI<Interaction>('/api/v1/crm/interactions/employer', req);
}

// ── Correspondence (port 8085) ─────────────────────────────────────────────

interface TemplateOpts {
  limit?: number;
  offset?: number;
}

export function fetchEmployerTemplates(
  opts?: TemplateOpts,
): Promise<PaginatedResult<CorrespondenceTemplate>> {
  const qs = toQueryString(opts ?? {});
  return fetchPaginatedAPI<CorrespondenceTemplate>(
    `/api/v1/correspondence/templates/employer${qs}`,
  );
}

export function generateEmployerLetter(
  req: GenerateEmployerLetterRequest,
): Promise<Correspondence> {
  return postAPI<Correspondence>('/api/v1/correspondence/generate/employer', req);
}

// ── Case Management (port 8088) ────────────────────────────────────────────

interface CaseOpts {
  limit?: number;
  offset?: number;
}

export function fetchEmployerCases(
  orgId: string,
  opts?: CaseOpts,
): Promise<PaginatedResult<RetirementCase>> {
  const qs = toQueryString(opts ?? {});
  return fetchPaginatedAPI<RetirementCase>(`/api/v1/employer/${orgId}/cases${qs}`);
}

export function fetchEmployerCaseSummary(orgId: string): Promise<EmployerCaseSummary> {
  return fetchAPI<EmployerCaseSummary>(`/api/v1/employer/${orgId}/cases/summary`);
}

export function createEmployerCase(req: CreateEmployerCaseRequest): Promise<RetirementCase> {
  return postAPI<RetirementCase>('/api/v1/employer/cases', req);
}
