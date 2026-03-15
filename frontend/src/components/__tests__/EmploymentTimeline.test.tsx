import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmploymentTimeline from '../EmploymentTimeline';
import type { EmploymentEvent } from '@/types/Member';

const events: EmploymentEvent[] = [
  {
    event_id: 1,
    member_id: 10001,
    event_type: 'HIRE',
    event_date: '2000-03-15',
    dept_code: 'PW',
    pos_code: 'ENG-3',
    annual_salary: 62000,
  },
  {
    event_id: 2,
    member_id: 10001,
    event_type: 'PROMOTION',
    event_date: '2005-07-01',
    dept_code: 'PW',
    pos_code: 'ENG-5',
    annual_salary: 78000,
  },
  {
    event_id: 3,
    member_id: 10001,
    event_type: 'TRANSFER',
    event_date: '2012-01-10',
    dept_code: 'IT',
    pos_code: 'MGR-2',
    annual_salary: 95000,
  },
  {
    event_id: 4,
    member_id: 10001,
    event_type: 'SEPARATION',
    event_date: '2020-06-30',
    separation_reason: 'Voluntary Resignation',
  },
];

describe('EmploymentTimeline', () => {
  it('renders employment events in order', () => {
    render(<EmploymentTimeline events={events} />);
    expect(screen.getByText('Employment Timeline')).toBeInTheDocument();
    expect(screen.getByText('Hired')).toBeInTheDocument();
    expect(screen.getByText('Promotion')).toBeInTheDocument();
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByText('Separation')).toBeInTheDocument();
  });

  it('shows event type labels correctly', () => {
    const loaEvent: EmploymentEvent = {
      event_id: 5,
      member_id: 10001,
      event_type: 'LOA',
      event_date: '2015-04-01',
    };
    render(<EmploymentTimeline events={[loaEvent]} />);
    expect(screen.getByText('Leave of Absence')).toBeInTheDocument();
  });

  it('shows dates, department, and position codes', () => {
    render(<EmploymentTimeline events={events} />);
    // formatDateShort('2000-03-15') → "Mar 15, 2000"
    expect(screen.getByText('Mar 15, 2000')).toBeInTheDocument();
    // 'Dept: PW' appears in HIRE and PROMOTION events
    expect(screen.getAllByText('Dept: PW')).toHaveLength(2);
    expect(screen.getByText('Pos: ENG-3')).toBeInTheDocument();
    expect(screen.getByText('Dept: IT')).toBeInTheDocument();
  });

  it('shows salary when present', () => {
    render(<EmploymentTimeline events={events} />);
    expect(screen.getByText('Salary: $62,000.00')).toBeInTheDocument();
    expect(screen.getByText('Salary: $78,000.00')).toBeInTheDocument();
    expect(screen.getByText('Salary: $95,000.00')).toBeInTheDocument();
  });

  it('shows separation reason for SEPARATION events', () => {
    render(<EmploymentTimeline events={events} />);
    expect(screen.getByText('Voluntary Resignation')).toBeInTheDocument();
  });
});
