import { describe, it, expect } from 'vitest';
import { statusToContext } from '../useDocumentChecklist';

describe('statusToContext', () => {
  it('maps ACTIVE to retirement_application', () => {
    expect(statusToContext('ACTIVE')).toBe('retirement_application');
  });

  it('maps INACTIVE to refund_application', () => {
    expect(statusToContext('INACTIVE')).toBe('refund_application');
  });

  it('maps DECEASED to death_notification', () => {
    expect(statusToContext('DECEASED')).toBe('death_notification');
  });

  it('maps RETIRED to empty string (no checklist)', () => {
    expect(statusToContext('RETIRED')).toBe('');
  });

  it('handles lowercase input', () => {
    expect(statusToContext('active')).toBe('retirement_application');
  });

  it('returns empty for unknown status', () => {
    expect(statusToContext('UNKNOWN')).toBe('');
  });
});
