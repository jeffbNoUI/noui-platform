import { C, BODY } from '@/lib/designSystem';

interface EmploymentHistoryTabProps {
  memberId: number;
}

export default function EmploymentHistoryTab({ memberId }: EmploymentHistoryTabProps) {
  return (
    <div data-testid="employment-history-tab">
      <p style={{ fontFamily: BODY, color: C.textSecondary }}>
        Employment history for member {memberId}
      </p>
    </div>
  );
}
