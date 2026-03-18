import { C, BODY } from '@/lib/designSystem';

interface AddressesTabProps {
  memberId: number;
}

export default function AddressesTab({ memberId }: AddressesTabProps) {
  return (
    <div data-testid="addresses-tab">
      <p style={{ fontFamily: BODY, color: C.textSecondary }}>Addresses for member {memberId}</p>
    </div>
  );
}
