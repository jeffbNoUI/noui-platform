import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MemberBanner from '../MemberBanner';
import type { Member } from '@/types/Member';

const makeMember = (overrides: Partial<Member> = {}): Member => ({
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  dob: '1963-05-12',
  marital_status: 'M',
  hire_date: '2000-03-15',
  status_code: 'A',
  tier_code: 1,
  dept_name: 'Public Works',
  pos_title: 'Senior Engineer',
  medicare_flag: 'N',
  email: 'rmartinez@city.gov',
  ...overrides,
});

describe('MemberBanner', () => {
  it('renders member name and initials avatar', () => {
    render(<MemberBanner member={makeMember()} />);
    expect(screen.getByText(/Robert/)).toBeInTheDocument();
    expect(screen.getByText(/Martinez/)).toBeInTheDocument();
    // Initials: R + M
    expect(screen.getByText('RM')).toBeInTheDocument();
  });

  it('shows member ID, department, and position', () => {
    render(<MemberBanner member={makeMember()} />);
    expect(screen.getByText(/10001/)).toBeInTheDocument();
    expect(screen.getByText(/Public Works/)).toBeInTheDocument();
    expect(screen.getByText(/Senior Engineer/)).toBeInTheDocument();
  });

  it('shows tier badge and status badge', () => {
    render(<MemberBanner member={makeMember()} />);
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('displays DOB, hire date, marital status, medicare, and email', () => {
    render(<MemberBanner member={makeMember()} />);
    expect(screen.getByText('May 12, 1963')).toBeInTheDocument();
    expect(screen.getByText('March 15, 2000')).toBeInTheDocument();
    expect(screen.getByText('Married')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('rmartinez@city.gov')).toBeInTheDocument();
  });

  it('shows termination date when present', () => {
    render(<MemberBanner member={makeMember({ term_date: '2023-12-31', status_code: 'T' })} />);
    expect(screen.getByText('Terminated')).toBeInTheDocument();
    expect(screen.getByText(/Termination Date/)).toBeInTheDocument();
    expect(screen.getByText('December 31, 2023')).toBeInTheDocument();
  });

  it('includes middle name when provided', () => {
    render(<MemberBanner member={makeMember({ middle_name: 'James' })} />);
    expect(screen.getByText(/Robert James Martinez/)).toBeInTheDocument();
  });
});
