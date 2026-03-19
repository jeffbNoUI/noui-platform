import { describe, it, expect } from 'vitest';
import { CARD_DEFINITIONS, getCardsForPersona, getLabelForSection } from '../cardDefinitions';

describe('cardDefinitions', () => {
  it('has no duplicate keys', () => {
    const keys = CARD_DEFINITIONS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every card has at least one persona', () => {
    CARD_DEFINITIONS.forEach((card) => {
      expect(card.personas.length).toBeGreaterThan(0);
    });
  });

  describe('getCardsForPersona', () => {
    it('returns profile, calculator, retirement-app, documents, messages, preferences for active', () => {
      const cards = getCardsForPersona(['active']);
      const keys = cards.map((c) => c.key);
      expect(keys).toContain('profile');
      expect(keys).toContain('calculator');
      expect(keys).toContain('retirement-app');
      expect(keys).toContain('documents');
      expect(keys).toContain('messages');
      expect(keys).toContain('preferences');
      // Should not include retiree/inactive-only cards
      expect(keys).not.toContain('benefit');
      expect(keys).not.toContain('tax-documents');
      expect(keys).not.toContain('refund');
    });

    it('returns profile, benefit, tax-documents, documents, messages, preferences for retiree', () => {
      const cards = getCardsForPersona(['retiree']);
      const keys = cards.map((c) => c.key);
      expect(keys).toContain('profile');
      expect(keys).toContain('benefit');
      expect(keys).toContain('tax-documents');
      expect(keys).not.toContain('calculator');
      expect(keys).not.toContain('retirement-app');
      expect(keys).not.toContain('refund');
    });

    it('returns profile, calculator, refund, documents, messages, preferences for inactive', () => {
      const cards = getCardsForPersona(['inactive']);
      const keys = cards.map((c) => c.key);
      expect(keys).toContain('profile');
      expect(keys).toContain('calculator');
      expect(keys).toContain('refund');
      expect(keys).not.toContain('benefit');
      expect(keys).not.toContain('retirement-app');
      expect(keys).not.toContain('tax-documents');
    });

    it('returns profile, benefit, documents, messages, preferences for beneficiary', () => {
      const cards = getCardsForPersona(['beneficiary']);
      const keys = cards.map((c) => c.key);
      expect(keys).toContain('profile');
      expect(keys).toContain('benefit');
      expect(keys).toContain('documents');
      expect(keys).not.toContain('calculator');
      expect(keys).not.toContain('refund');
    });

    it('returns combined cards for dual personas', () => {
      const cards = getCardsForPersona(['active', 'beneficiary']);
      const keys = cards.map((c) => c.key);
      // Active cards
      expect(keys).toContain('calculator');
      expect(keys).toContain('retirement-app');
      // Beneficiary cards
      expect(keys).toContain('benefit');
    });
  });

  describe('getLabelForSection', () => {
    it('returns card label for known sections', () => {
      expect(getLabelForSection('profile')).toBe('My Profile');
      expect(getLabelForSection('calculator')).toBe('Plan My Retirement');
      expect(getLabelForSection('documents')).toBe('Documents');
    });

    it('capitalizes unknown sections as fallback', () => {
      expect(getLabelForSection('unknown')).toBe('Unknown');
    });
  });
});
