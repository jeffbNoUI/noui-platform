import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatDateShort,
  formatServiceYears,
  tierLabel,
  statusLabel,
  eligibilityLabel,
} from '../formatters';

describe('formatCurrency', () => {
  it('formats a positive amount with commas and two decimals', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats a negative amount', () => {
    expect(formatCurrency(-500)).toBe('-$500.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats a cents-only amount', () => {
    expect(formatCurrency(0.99)).toBe('$0.99');
  });
});

describe('formatPercent', () => {
  it('formats a decimal value as a percent string with default 1 decimal', () => {
    expect(formatPercent(3.5)).toBe('3.5%');
  });

  it('respects custom decimal places', () => {
    expect(formatPercent(3.456, 2)).toBe('3.46%');
  });

  it('formats zero percent', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string to long US format', () => {
    const result = formatDate('2024-06-15');
    expect(result).toBe('June 15, 2024');
  });

  it('handles ISO datetime strings', () => {
    const result = formatDate('2024-01-01T12:00:00Z');
    // Contains the expected components (exact output may vary by timezone)
    expect(result).toContain('2024');
    expect(result).toContain('January');
  });
});

describe('formatDateShort', () => {
  it('formats an ISO date string to short US format', () => {
    const result = formatDateShort('2024-06-15');
    expect(result).toBe('Jun 15, 2024');
  });
});

describe('formatServiceYears', () => {
  it('formats whole years', () => {
    expect(formatServiceYears(25)).toBe('25 years');
  });

  it('formats fractional years as years and months', () => {
    expect(formatServiceYears(25.5)).toBe('25 yr 6 mo');
  });

  it('formats small fractional part', () => {
    expect(formatServiceYears(10.25)).toBe('10 yr 3 mo');
  });
});

describe('tierLabel', () => {
  it('returns "Tier N" for a given number', () => {
    expect(tierLabel(1)).toBe('Tier 1');
    expect(tierLabel(3)).toBe('Tier 3');
  });
});

describe('statusLabel', () => {
  it('maps known codes to labels', () => {
    expect(statusLabel('A')).toBe('Active');
    expect(statusLabel('R')).toBe('Retired');
    expect(statusLabel('T')).toBe('Terminated');
    expect(statusLabel('D')).toBe('Deferred');
    expect(statusLabel('X')).toBe('Deceased');
  });

  it('returns the code itself for unknown codes', () => {
    expect(statusLabel('Z')).toBe('Z');
  });
});

describe('eligibilityLabel', () => {
  it('maps known types to labels', () => {
    expect(eligibilityLabel('NORMAL')).toBe('Normal Retirement');
    expect(eligibilityLabel('RULE_OF_75')).toBe('Rule of 75');
    expect(eligibilityLabel('RULE_OF_85')).toBe('Rule of 85');
    expect(eligibilityLabel('EARLY')).toBe('Early Retirement');
    expect(eligibilityLabel('DEFERRED')).toBe('Deferred Retirement');
    expect(eligibilityLabel('NONE')).toBe('Not Eligible');
  });

  it('returns the type itself for unknown types', () => {
    expect(eligibilityLabel('UNKNOWN')).toBe('UNKNOWN');
  });
});
