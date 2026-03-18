import type {
  PlanProfile,
  DocumentChecklistRule,
  DataChangeImpact,
  GlossaryTerm,
} from '@/types/PlanProfile';
import profileData from '@/config/plan-profile.yaml';

let cachedProfile: PlanProfile | null = null;

export function getPlanProfile(): PlanProfile {
  if (!cachedProfile) {
    cachedProfile = profileData as unknown as PlanProfile;
  }
  return cachedProfile;
}

export function getFieldPermission(field: string): 'immediate' | 'staff_review' {
  const profile = getPlanProfile();
  if (profile.field_permissions.immediate_edit.includes(field)) return 'immediate';
  return 'staff_review';
}

export function getDocumentChecklist(
  context: string,
  memberData: Record<string, unknown>,
): DocumentChecklistRule[] {
  const profile = getPlanProfile();
  return profile.documents.checklist_rules.filter((rule) => {
    if (!rule.contexts.includes(context)) return false;
    if (rule.required_when === 'always') return true;
    return evaluateCondition(rule.required_when, memberData);
  });
}

export function getDataChangeImpacts(trigger: string): DataChangeImpact[] {
  const profile = getPlanProfile();
  return profile.data_change_impacts.filter((i) => i.trigger === trigger);
}

export function getGlossaryTerm(term: string, tierId?: string): GlossaryTerm | undefined {
  const profile = getPlanProfile();
  return profile.help_content.plan_specific_terms.find(
    (t) =>
      t.term === term && (!t.applies_to_tiers || !tierId || t.applies_to_tiers.includes(tierId)),
  );
}

function evaluateCondition(condition: string, data: Record<string, unknown>): boolean {
  const match = condition.match(/^(\w+)\.(\w+)\s*==\s*'?([^']+)'?$/);
  if (!match) return true;
  const [, , field, value] = match;
  return String(data[field]) === value;
}
