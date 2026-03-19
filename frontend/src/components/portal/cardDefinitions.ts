import { C } from '@/lib/designSystem';
import type { MemberPersona } from '@/types/MemberPortal';

export interface CardDefinition {
  key: string;
  label: string;
  icon: string;
  personas: MemberPersona[];
  accentColor: string;
  summaryKey:
    | 'action-count'
    | 'benefit-estimate'
    | 'message-count'
    | 'document-count'
    | 'payment-next'
    | 'refund-amount'
    | 'profile-completion'
    | 'static';
  staticSummary?: string;
}

export interface NavEntry {
  section: string;
  label: string;
}

/**
 * Single source of truth for dashboard navigation cards.
 * Replaces the NAV_ITEMS array from MemberPortalSidebar.
 * 'dashboard' is not included — it's the home view that renders these cards.
 */
export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    key: 'profile',
    label: 'My Profile',
    icon: '◉',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
    accentColor: C.sky,
    summaryKey: 'profile-completion',
  },
  {
    key: 'calculator',
    label: 'Plan My Retirement',
    icon: '◈',
    personas: ['active', 'inactive'],
    accentColor: C.sage,
    summaryKey: 'benefit-estimate',
  },
  {
    key: 'benefit',
    label: 'My Benefit',
    icon: '◈',
    personas: ['retiree', 'beneficiary'],
    accentColor: C.sage,
    summaryKey: 'payment-next',
  },
  {
    key: 'retirement-app',
    label: 'Apply to Retire',
    icon: '★',
    personas: ['active'],
    accentColor: C.gold,
    summaryKey: 'static',
    staticSummary: 'Start your retirement application',
  },
  {
    key: 'refund',
    label: 'Request a Refund',
    icon: '↩',
    personas: ['inactive'],
    accentColor: C.gold,
    summaryKey: 'refund-amount',
  },
  {
    key: 'tax-documents',
    label: 'Tax Documents',
    icon: '⊞',
    personas: ['retiree'],
    accentColor: C.gold,
    summaryKey: 'static',
    staticSummary: '1099-R forms for tax filing',
  },
  {
    key: 'documents',
    label: 'Documents',
    icon: '▤',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
    accentColor: C.navy,
    summaryKey: 'document-count',
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: '✉',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
    accentColor: C.coral,
    summaryKey: 'message-count',
  },
  {
    key: 'preferences',
    label: 'Preferences',
    icon: '⚙',
    personas: ['active', 'inactive', 'retiree', 'beneficiary'],
    accentColor: C.textSecondary,
    summaryKey: 'static',
    staticSummary: 'Notifications, accessibility, security',
  },
];

/** Filter cards for the given persona(s). */
export function getCardsForPersona(personas: MemberPersona[]): CardDefinition[] {
  return CARD_DEFINITIONS.filter((card) => card.personas.some((p) => personas.includes(p)));
}

/** Look up a card label by section key. */
export function getLabelForSection(section: string): string {
  const card = CARD_DEFINITIONS.find((c) => c.key === section);
  return card?.label ?? section.charAt(0).toUpperCase() + section.slice(1);
}
