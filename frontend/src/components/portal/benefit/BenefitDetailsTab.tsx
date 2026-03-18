import { C, BODY } from '@/lib/designSystem';

interface BenefitDetailsTabProps {
  memberId: number;
}

export default function BenefitDetailsTab({ memberId: _memberId }: BenefitDetailsTabProps) {
  return (
    <div data-testid="benefit-details-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
      Benefit details will be available here.
    </div>
  );
}
