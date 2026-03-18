import { describe, it, expect } from 'vitest';
import { resolveMemberPersona } from '../MemberPortal';

describe('resolveMemberPersona', () => {
  it('returns active for active member', () => {
    expect(resolveMemberPersona({ status_code: 'ACTIVE', member_id: 1 })).toEqual(['active']);
  });

  it('returns inactive for inactive member', () => {
    expect(resolveMemberPersona({ status_code: 'INACTIVE', member_id: 1 })).toEqual(['inactive']);
  });

  it('returns inactive for deferred member', () => {
    expect(resolveMemberPersona({ status_code: 'DEFERRED', member_id: 1 })).toEqual(['inactive']);
  });

  it('returns retiree for retired member', () => {
    expect(resolveMemberPersona({ status_code: 'RETIRED', member_id: 1 })).toEqual(['retiree']);
  });

  it('returns dual role for active member who is also beneficiary', () => {
    expect(resolveMemberPersona({ status_code: 'ACTIVE', member_id: 1 }, [2])).toEqual([
      'active',
      'beneficiary',
    ]);
  });

  it('returns inactive + beneficiary for inactive beneficiary', () => {
    expect(resolveMemberPersona({ status_code: 'INACTIVE', member_id: 1 }, [2])).toEqual([
      'inactive',
      'beneficiary',
    ]);
  });

  it('falls back to active for unknown status', () => {
    expect(resolveMemberPersona({ status_code: 'UNKNOWN', member_id: 1 })).toEqual(['active']);
  });

  it('returns beneficiary only when unknown status with beneficiaryOf', () => {
    expect(resolveMemberPersona({ status_code: 'UNKNOWN', member_id: 1 }, [5])).toEqual([
      'beneficiary',
    ]);
  });
});
