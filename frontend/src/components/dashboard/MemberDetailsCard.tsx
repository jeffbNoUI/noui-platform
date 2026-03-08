import type { Member } from '@/types/Member';
import { formatDate } from '@/lib/formatters';

interface MemberDetailsCardProps {
  member: Member;
}

export default function MemberDetailsCard({ member }: MemberDetailsCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Member Details</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        <DetailRow label="Email" value={member.email || '—'} />
        <DetailRow label="Department" value={member.dept_name || '—'} />
        <DetailRow label="Position" value={member.pos_title || '—'} />
        <DetailRow label="Hire Date" value={formatDate(member.hire_date)} />
        <DetailRow label="Date of Birth" value={formatDate(member.dob)} />
        <DetailRow
          label="Marital Status"
          value={
            member.marital_status === 'M'
              ? 'Married'
              : member.marital_status === 'S'
                ? 'Single'
                : member.marital_status === 'D'
                  ? 'Divorced'
                  : member.marital_status === 'W'
                    ? 'Widowed'
                    : member.marital_status
          }
        />
        {member.term_date && (
          <DetailRow label="Termination Date" value={formatDate(member.term_date)} />
        )}
        <DetailRow label="Medicare" value={member.medicare_flag === 'Y' ? 'Yes' : 'No'} />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
