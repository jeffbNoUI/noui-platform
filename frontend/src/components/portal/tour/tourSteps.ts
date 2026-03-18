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
    id: 'welcome-sidebar',
    targetId: 'sidebar-nav',
    title: 'Navigation',
    description:
      'Use the sidebar to move between sections of your portal. The items shown are based on your account type.',
    position: 'right',
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
];

const RETIREE_STEPS: TourStep[] = [
  {
    id: 'next-payment',
    targetId: 'next-payment',
    title: 'Your Next Payment',
    description: 'See your upcoming payment amount, deductions, and deposit date at a glance.',
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
];

const BENEFICIARY_STEPS: TourStep[] = [
  {
    id: 'next-payment',
    targetId: 'next-payment',
    title: 'Survivor Benefit',
    description: 'Your survivor benefit payment details are shown here.',
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

export const CURRENT_TOUR_VERSION = 1;
