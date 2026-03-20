import { useState } from 'react';
import type { ActivityEvent } from '@/types/EmployerOps';

interface ActivityFeedProps {
  events: ActivityEvent[];
}

const INITIAL_LIMIT = 10;

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? events : events.slice(0, INITIAL_LIMIT);
  const hasMore = events.length > INITIAL_LIMIT;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Recent Activity
        </h3>
      </div>

      {events.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-400">No recent activity</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {visible.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm flex-shrink-0">{ev.icon}</span>
                <span className="text-sm text-gray-700 truncate flex-1 min-w-0">{ev.summary}</span>
                <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                  {formatRelativeTime(ev.timestamp)}
                </span>
              </li>
            ))}
          </ul>

          {hasMore && !expanded && (
            <div className="px-4 pb-3 pt-1">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-xs font-medium text-[#87A878] hover:text-[#6b8c5e] transition-colors"
              >
                Show all {events.length} events&hellip;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
