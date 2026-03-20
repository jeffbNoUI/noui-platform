import type { MemberPersona } from '@/types/MemberPortal';

export interface LearningHint {
  id: string;
  cardKey: string;
  personas: MemberPersona[];
  teaser: string;
  expanded: string;
}

const LEARNING_HINTS: LearningHint[] = [
  {
    id: 'benefit-growth',
    cardKey: 'calculator',
    personas: ['active'],
    teaser: 'Each additional year of service increases your monthly benefit.',
    expanded:
      'Your retirement benefit is calculated as: years of service \u00d7 tier multiplier \u00d7 average monthly salary. Running scenarios with different retirement dates helps you see exactly how additional years affect your benefit.',
  },
  {
    id: 'vesting',
    cardKey: 'profile',
    personas: ['active', 'inactive'],
    teaser: 'Five years of service makes you fully vested in your pension.',
    expanded:
      'Vesting means you have earned the right to receive a pension benefit when you reach retirement age, even if you leave employment before then. Your vesting status is shown on your profile.',
  },
  {
    id: 'ams-window',
    cardKey: 'calculator',
    personas: ['active', 'inactive'],
    teaser: 'Your benefit is based on your highest consecutive salary months.',
    expanded:
      'The Average Monthly Salary (AMS) uses your highest 36 or 60 consecutive months of salary, depending on your tier. Salary increases near retirement can significantly impact your benefit.',
  },
  {
    id: 'documents-matter',
    cardKey: 'documents',
    personas: ['active'],
    teaser: 'Submitting documents early can speed up your retirement application.',
    expanded:
      'When you begin a retirement application, certain documents are required before processing can begin. Uploading them ahead of time means faster processing when you are ready to apply.',
  },
  {
    id: 'payment-schedule',
    cardKey: 'benefit',
    personas: ['retiree'],
    teaser: 'Pension payments are deposited on the last business day of each month.',
    expanded:
      'Your monthly benefit is calculated after deductions for taxes, health insurance, and any other withholdings. You can view your full deduction breakdown in your payment history.',
  },
  {
    id: 'tax-1099r',
    cardKey: 'tax-documents',
    personas: ['retiree'],
    teaser: '1099-R forms are available each January for the prior tax year.',
    expanded:
      'Your 1099-R reports the total pension benefits paid and taxes withheld during the calendar year. You can download current and prior year forms from the Tax Documents section.',
  },
  {
    id: 'refund-vs-deferred',
    cardKey: 'refund',
    personas: ['inactive'],
    teaser: 'Compare your refund amount against a future monthly pension.',
    expanded:
      'If you are vested (5+ years of service), you may choose between a one-time refund of your contributions or a deferred monthly pension starting at retirement age. The deferred benefit may be worth significantly more over time.',
  },
  {
    id: 'beneficiary-updates',
    cardKey: 'profile',
    personas: ['retiree', 'beneficiary'],
    teaser: 'Keeping beneficiary designations current protects your loved ones.',
    expanded:
      'Life events like marriage, divorce, or the birth of a child may affect who should receive your benefit. Review your beneficiary designations periodically to make sure they reflect your wishes.',
  },
  {
    id: 'secure-messages',
    cardKey: 'messages',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
    teaser: 'Secure messages are the fastest way to reach plan staff.',
    expanded:
      'Messages sent through the portal are encrypted and go directly to your dedicated service team. Most inquiries receive a response within one business day.',
  },
];

/** Get the most relevant hint for a card and persona. Returns null if none match. */
export function getHintForCard(cardKey: string, personas: MemberPersona[]): LearningHint | null {
  return (
    LEARNING_HINTS.find(
      (h) => h.cardKey === cardKey && h.personas.some((p) => personas.includes(p)),
    ) ?? null
  );
}
