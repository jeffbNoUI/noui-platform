import { C, BODY } from '@/lib/designSystem';

interface ContributionsTabProps {
  memberId: number;
}

export default function ContributionsTab({ memberId }: ContributionsTabProps) {
  return (
    <div data-testid="contributions-tab">
      <p style={{ fontFamily: BODY, color: C.textSecondary }}>
        Contributions for member {memberId}
      </p>
    </div>
  );
}
