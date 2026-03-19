import type { MemberPersona } from '@/types/MemberPortal';

export interface TourStep {
  id: string;
  targetId: string; // matches data-tour-id on DOM elements
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const COMMON_STEPS: TourStep[] = [
  {
    id: 'welcome-cards',
    targetId: 'card-grid',
    title: 'Your Dashboard',
    description:
      'Your portal is organized into cards. Each card shows a summary and takes you to the full section when clicked.',
    position: 'top',
  },
  {
    id: 'card-documents',
    targetId: 'card-documents',
    title: 'Your Documents',
    description: 'Upload required documents and view your complete document history here.',
    position: 'bottom',
  },
  {
    id: 'card-messages',
    targetId: 'card-messages',
    title: 'Messages',
    description: 'Send messages to plan staff and view your communication history.',
    position: 'bottom',
  },
  {
    id: 'card-preferences',
    targetId: 'card-preferences',
    title: 'Preferences',
    description: 'Customize notification settings, accessibility options, and account security.',
    position: 'bottom',
  },
];

const ACTIVE_STEPS: TourStep[] = [
  {
    id: 'benefit-hero',
    targetId: 'benefit-hero',
    title: 'Your Estimated Benefit',
    description:
      'This shows your estimated monthly pension benefit at retirement. It updates as your service years and salary change.',
    position: 'bottom',
  },
  {
    id: 'milestone-timeline',
    targetId: 'milestone-timeline',
    title: 'Retirement Milestones',
    description:
      'Track your progress toward retirement eligibility. These milestones are based on your plan tier and hire date.',
    position: 'left',
  },
  {
    id: 'action-items',
    targetId: 'action-items',
    title: 'Action Items',
    description:
      'Items that need your attention appear here — incomplete profile fields, pending documents, or unread messages.',
    position: 'right',
  },
  {
    id: 'documents-checklist',
    targetId: 'documents-section',
    title: 'Document Checklist',
    description:
      'When you start your retirement application, required documents will appear here. Upload them to keep your application moving.',
    position: 'bottom',
  },
];

const RETIREE_STEPS: TourStep[] = [
  {
    id: 'next-payment',
    targetId: 'next-payment',
    title: 'Your Next Payment',
    description: 'See your upcoming payment amount, deductions, and deposit date at a glance.',
    position: 'bottom',
  },
  {
    id: 'tax-documents',
    targetId: 'card-tax-documents',
    title: 'Tax Documents',
    description:
      'Download your 1099-R forms for tax filing. Documents are available each January for the prior tax year.',
    position: 'bottom',
  },
  {
    id: 'payment-history',
    targetId: 'benefit-section',
    title: 'Payment History',
    description:
      'View your complete payment history including gross amounts, deductions, and net deposits.',
    position: 'bottom',
  },
];

const INACTIVE_STEPS: TourStep[] = [
  {
    id: 'options-comparison',
    targetId: 'options-comparison',
    title: 'Your Options',
    description:
      'Compare your available options: a deferred pension benefit (if vested) or a refund of your contributions.',
    position: 'bottom',
  },
  {
    id: 'refund-option',
    targetId: 'card-refund',
    title: 'Request a Refund',
    description:
      'If you are no longer employed, you can request a refund of your contributions. Review the details and start the process here.',
    position: 'bottom',
  },
];

const BENEFICIARY_STEPS: TourStep[] = [
  {
    id: 'next-payment',
    targetId: 'next-payment',
    title: 'Survivor Benefit',
    description: 'Your survivor benefit payment details are shown here.',
    position: 'bottom',
  },
  {
    id: 'death-benefit-info',
    targetId: 'benefit-section',
    title: 'Benefit Details',
    description:
      'View your survivor benefit details, payment schedule, and any lump sum death benefit information.',
    position: 'bottom',
  },
];

export function getTourSteps(persona: MemberPersona): TourStep[] {
  const personaSteps: Record<MemberPersona, TourStep[]> = {
    active: ACTIVE_STEPS,
    retiree: RETIREE_STEPS,
    inactive: INACTIVE_STEPS,
    beneficiary: BENEFICIARY_STEPS,
  };

  return [...COMMON_STEPS, ...(personaSteps[persona] ?? [])];
}

export const CURRENT_TOUR_VERSION = 3;
