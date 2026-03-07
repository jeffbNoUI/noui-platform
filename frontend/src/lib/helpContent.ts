/**
 * Stage-indexed contextual help data.
 *
 * Each stage has a checklist ("What to check"), rule references (RMC citations),
 * and a next-action recommendation (shown only in Guided mode).
 */

export interface HelpItem {
  /** Stage id (matches StageDescriptor.id) */
  stageId: string;
  title: string;
  context: string;
  checklist: string[];
  rules: { code: string; description: string }[];
  nextAction: string;
}

const HELP: HelpItem[] = [
  {
    stageId: 'intake',
    title: 'Application Intake',
    context:
      'Verify that all required documents are present and properly signed before advancing. Flag any missing or expired items.',
    checklist: [
      'Confirm signed retirement application is on file',
      'Verify birth certificate and photo ID',
      'Check spousal consent / notarization if married',
      'Ensure DRO court order is attached (if applicable)',
      'Confirm beneficiary designation form is current',
    ],
    rules: [
      { code: 'RMC \u00a718-201', description: 'Filing requirements' },
      { code: 'RMC \u00a718-203', description: 'Spousal consent' },
    ],
    nextAction:
      'Verify all required documents are received. Flag any missing items or discrepancies before proceeding.',
  },
  {
    stageId: 'verify-employment',
    title: 'Verify Employment',
    context:
      'Review the member\u2019s employment history for completeness. Verify there are no unexplained gaps, and confirm purchased/military service credit if applicable.',
    checklist: [
      'Confirm hire date matches HR records',
      'Verify all employment periods are accounted for',
      'Check for gaps \u2014 any break >30 days requires explanation',
      'Validate purchased service credit amounts',
      'Confirm military service credit documentation',
    ],
    rules: [
      { code: 'RMC \u00a718-301', description: 'Service credit definitions' },
      { code: 'RMC \u00a718-302', description: 'Purchased service rules' },
      { code: 'RMC \u00a718-303', description: 'Military service credit' },
    ],
    nextAction:
      'Review employment records for completeness. Confirm all periods and purchased service, then advance.',
  },
  {
    stageId: 'salary-ams',
    title: 'Salary & AMS',
    context:
      'The system has identified the highest consecutive salary window. Verify the salary records are complete and the AMS window is correct for the member\u2019s tier.',
    checklist: [
      'AMS uses highest 36 consecutive months (Tier 1/2) or 60 months (Tier 3)',
      'Verify salary records are complete for the window period',
      'Check for leave payout impact on final month salary',
      'Confirm no salary anomalies (sudden spikes or drops)',
    ],
    rules: [
      { code: 'RMC \u00a718-401(d)', description: 'AMS definition' },
      { code: 'RMC \u00a718-401(e)', description: 'Salary inclusions/exclusions' },
    ],
    nextAction:
      'Review the salary table, confirm AMS window period, and verify leave payout impact if any.',
  },
  {
    stageId: 'eligibility',
    title: 'Eligibility Determination',
    context:
      'Confirm the member meets the eligibility requirements for their retirement type. Check tier-specific rules (Rule of 75 for Tier 1/2, Rule of 85 for Tier 3).',
    checklist: [
      'Verify member meets minimum vesting requirement (5 years)',
      'Check age + service against tier-specific rule threshold',
      'If early retirement \u2014 confirm reduction percentage is correct',
      'Verify the elected retirement date is valid',
    ],
    rules: [
      { code: 'RMC \u00a718-401(a)', description: 'Eligibility requirements' },
      { code: 'RMC \u00a718-401(b)', description: 'Rule of 75 / Rule of 85' },
      { code: 'RMC \u00a718-401(c)', description: 'Early retirement reduction' },
    ],
    nextAction:
      'Confirm eligibility type (Normal/Early/Deferred). If early, verify reduction factor before advancing.',
  },
  {
    stageId: 'dro',
    title: 'DRO Division',
    context:
      'A Domestic Relations Order (DRO) applies to this case. Verify the marital fraction calculation and confirm the court-ordered division percentage.',
    checklist: [
      'Verify marriage and divorce dates on the DRO',
      'Confirm marital fraction numerator (service during marriage)',
      'Verify court-ordered division percentage (typically 50%)',
      'Check that DRO award is applied before payment option selection',
      'Confirm alternate payee contact information is on file',
    ],
    rules: [
      { code: 'RMC \u00a718-501', description: 'DRO requirements' },
      { code: 'RMC \u00a718-502', description: 'Marital fraction calculation' },
      { code: 'RMC \u00a718-503', description: 'Alternate payee rights' },
    ],
    nextAction:
      'Verify marital fraction and DRO award amount. Confirm alternate payee details before advancing.',
  },
  {
    stageId: 'benefit-calc',
    title: 'Benefit Calculation',
    context:
      'The system has automatically calculated the benefit using the member\u2019s tier-specific formula. Your job is to verify the inputs are correct.',
    checklist: [
      'Verify multiplier matches member tier (2.0% T1, 1.5% T2, variable T3)',
      'Confirm AMS amount matches Salary & AMS stage',
      'Verify service credit years match employment verification',
      'If early retirement \u2014 confirm reduction factor is applied',
      'Cross-check final monthly benefit against formula',
    ],
    rules: [
      { code: 'RMC \u00a718-401(a)', description: 'Benefit formula' },
      { code: 'RMC \u00a718-401(d)', description: 'AMS definition' },
      { code: 'RMC \u00a718-401(c)', description: 'Early retirement reduction' },
    ],
    nextAction:
      'Review the salary table, confirm AMS window, then click "Confirm & Continue" to advance to Payment Options.',
  },
  {
    stageId: 'election',
    title: 'Election Recording',
    context:
      'Record the member\u2019s payment option selection, death benefit election, and health insurance (IPR) enrollment. Ensure spousal consent is obtained for non-maximum options.',
    checklist: [
      'Member must select one payment option (Maximum, 100/75/50% J&S)',
      'If J&S selected \u2014 verify spousal/beneficiary information',
      'Record death benefit election (lump sum vs installments)',
      'Check IPR enrollment and confirm pre/post-Medicare amounts',
      'Obtain spousal consent signature if required',
    ],
    rules: [
      { code: 'RMC \u00a718-601', description: 'Payment option definitions' },
      { code: 'RMC \u00a718-602', description: 'Spousal consent requirements' },
      { code: 'RMC \u00a718-701', description: 'IPR enrollment' },
    ],
    nextAction:
      'Member must select a payment option and health insurance election. Flag if spousal consents are missing.',
  },
  {
    stageId: 'submit',
    title: 'Final Certification',
    context:
      'All stages have been reviewed. Perform a final check of all data before certifying and submitting for supervisor approval.',
    checklist: [
      'All prior stages confirmed and data verified',
      'No outstanding flags or issues',
      'Member signature and date confirmed',
      'Analyst certification statement reviewed',
      'Case ready for supervisor approval queue',
    ],
    rules: [
      { code: 'RMC \u00a718-801', description: 'Certification requirements' },
      { code: 'RMC \u00a718-802', description: 'Supervisor review process' },
    ],
    nextAction:
      'Perform final review of all data, then click "Certify & Submit" to send to supervisor for approval.',
  },
];

/** Lookup help content by stage ID. */
export function getHelpForStage(stageId: string): HelpItem | undefined {
  return HELP.find((h) => h.stageId === stageId);
}

/** Get all help items (for expert-mode reference). */
export function getAllHelp(): HelpItem[] {
  return HELP;
}
