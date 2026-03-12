/**
 * Maps frontend workflow stage IDs to correspondence template stage_category values.
 * Used to suggest the appropriate letter template after a stage completes.
 */
export const STAGE_TO_TEMPLATE: Record<string, string> = {
  intake: 'intake',
  'verify-employment': 'verify-employment',
  eligibility: 'eligibility',
  dro: 'dro',
  'benefit-calc': 'benefit-calc',
  election: 'election',
  submit: 'submit',
};

/** Returns the template stage_category for a given frontend stage ID, or null. */
export function getTemplateCategoryForStage(stageId: string): string | null {
  return STAGE_TO_TEMPLATE[stageId] ?? null;
}
