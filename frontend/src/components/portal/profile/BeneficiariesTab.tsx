import { C, BODY } from '@/lib/designSystem';

interface BeneficiariesTabProps {
  memberId: number;
}

export default function BeneficiariesTab({ memberId }: BeneficiariesTabProps) {
  return (
    <div data-testid="beneficiaries-tab">
      <p style={{ fontFamily: BODY, color: C.textSecondary }}>
        Beneficiaries for member {memberId}
      </p>
    </div>
  );
}
