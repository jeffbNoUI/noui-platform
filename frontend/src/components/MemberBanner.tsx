import type { Member } from '@/types/Member';
import { formatDate, tierLabel, statusLabel } from '@/lib/formatters';

interface MemberBannerProps {
  member: Member;
}

const tierColors: Record<number, string> = {
  1: 'bg-tier-1',
  2: 'bg-tier-2',
  3: 'bg-tier-3',
};

const statusColors: Record<string, string> = {
  A: 'bg-status-active',
  R: 'bg-status-retired',
  D: 'bg-status-deferred',
  T: 'bg-status-terminated',
};

export default function MemberBanner({ member }: MemberBannerProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
            {member.first_name[0]}{member.last_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {member.first_name} {member.middle_name ? `${member.middle_name} ` : ''}{member.last_name}
            </h1>
            <p className="text-sm text-gray-500">
              Member ID: {member.member_id}
              {member.dept_name && <> &middot; {member.dept_name}</>}
              {member.pos_title && <> &middot; {member.pos_title}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white ${tierColors[member.tier_code] || 'bg-gray-500'}`}>
            {tierLabel(member.tier_code)}
          </span>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white ${statusColors[member.status_code] || 'bg-gray-500'}`}>
            {statusLabel(member.status_code)}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-4 border-t border-gray-100 pt-3 text-sm">
        <div>
          <span className="text-gray-500">Date of Birth</span>
          <p className="font-medium">{formatDate(member.dob)}</p>
        </div>
        <div>
          <span className="text-gray-500">Hire Date</span>
          <p className="font-medium">{formatDate(member.hire_date)}</p>
        </div>
        <div>
          <span className="text-gray-500">Marital Status</span>
          <p className="font-medium">
            {member.marital_status === 'M' ? 'Married' :
             member.marital_status === 'S' ? 'Single' :
             member.marital_status === 'D' ? 'Divorced' :
             member.marital_status === 'W' ? 'Widowed' : member.marital_status}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Medicare</span>
          <p className="font-medium">{member.medicare_flag === 'Y' ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  );
}
