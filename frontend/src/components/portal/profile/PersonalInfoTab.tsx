import { C, BODY } from '@/lib/designSystem';

interface PersonalInfoTabProps {
  memberId: number;
}

export default function PersonalInfoTab({ memberId }: PersonalInfoTabProps) {
  return (
    <div data-testid="personal-info-tab">
      <p style={{ fontFamily: BODY, color: C.textSecondary }}>
        Personal information for member {memberId}
      </p>
    </div>
  );
}
