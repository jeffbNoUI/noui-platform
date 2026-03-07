import type { EmploymentEvent } from '@/types/Member';
import { formatDateShort, formatCurrency } from '@/lib/formatters';

interface EmploymentTimelineProps {
  events: EmploymentEvent[];
}

const eventColors: Record<string, string> = {
  HIRE: 'bg-green-500',
  REHIRE: 'bg-green-400',
  PROMOTION: 'bg-blue-500',
  TRANSFER: 'bg-purple-500',
  SEPARATION: 'bg-red-500',
  LOA: 'bg-amber-500',
};

const eventLabels: Record<string, string> = {
  HIRE: 'Hired',
  REHIRE: 'Rehired',
  PROMOTION: 'Promotion',
  TRANSFER: 'Transfer',
  SEPARATION: 'Separation',
  LOA: 'Leave of Absence',
};

export default function EmploymentTimeline({ events }: EmploymentTimelineProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Employment Timeline</h2>
      </div>

      <div className="p-6">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          {events.map((event) => (
            <div key={event.event_id} className="relative flex items-start gap-4 pb-6 last:pb-0">
              <div className={`relative z-10 mt-1 h-3 w-3 rounded-full ${eventColors[event.event_type] || 'bg-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    {eventLabels[event.event_type] || event.event_type}
                  </p>
                  <time className="text-xs text-gray-500">{formatDateShort(event.event_date)}</time>
                </div>
                <div className="mt-1 text-xs text-gray-500 space-x-2">
                  {event.dept_code && <span>Dept: {event.dept_code}</span>}
                  {event.pos_code && <span>Pos: {event.pos_code}</span>}
                  {event.annual_salary != null && (
                    <span>Salary: {formatCurrency(event.annual_salary)}</span>
                  )}
                  {event.separation_reason && (
                    <span className="text-red-500">{event.separation_reason}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
