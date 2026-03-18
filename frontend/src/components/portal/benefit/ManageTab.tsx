import { C, BODY } from '@/lib/designSystem';

interface ManageTabProps {
  memberId: number;
}

export default function ManageTab({ memberId: _memberId }: ManageTabProps) {
  return (
    <div data-testid="manage-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
      Account management options will be available here.
    </div>
  );
}
