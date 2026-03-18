import { C, BODY } from '@/lib/designSystem';

interface ServiceCreditTabProps {
  memberId: number;
}

export default function ServiceCreditTab({ memberId }: ServiceCreditTabProps) {
  return (
    <div data-testid="service-credit-tab">
      <p style={{ fontFamily: BODY, color: C.textSecondary }}>
        Service credit for member {memberId}
      </p>
    </div>
  );
}
