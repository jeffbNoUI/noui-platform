import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ServiceHealthCard from '../ServiceHealthCard';
import type { ServiceHealth } from '@/types/serviceHealth';

function makeHealth(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  return {
    status: 'ok',
    service: 'test-service',
    version: '2.1.0',
    uptime: '5d 12h',
    uptime_sec: 475200,
    started_at: '2026-03-12T00:00:00Z',
    requests: {
      total: 500,
      errors_4xx: 2,
      errors_5xx: 0,
      avg_latency_ms: 15,
      p95_latency_ms: 45,
    },
    runtime: {
      goroutines: 20,
      heap_alloc_mb: 64,
      heap_sys_mb: 128,
      gc_pause_ms_avg: 0.5,
    },
    ...overrides,
  };
}

describe('ServiceHealthCard', () => {
  it('renders service name and version when healthy', () => {
    const health = makeHealth({ version: '2.1.0' });
    render(<ServiceHealthCard name="Case Management" health={health} />);

    expect(screen.getByText('Case Management')).toBeInTheDocument();
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
  });

  it('shows green status indicator for healthy service', () => {
    const health = makeHealth();
    const { container } = render(<ServiceHealthCard name="Healthy Svc" health={health} />);

    const dot = container.querySelector('.bg-emerald-500');
    expect(dot).toBeInTheDocument();
  });

  it('shows yellow status for degraded service (pool >80%)', () => {
    const health = makeHealth({
      db: {
        max_open: 20,
        open: 18,
        in_use: 17,
        idle: 1,
        wait_count: 5,
        wait_duration_ms: 100,
        utilization_pct: 90,
      },
    });
    const { container } = render(<ServiceHealthCard name="Degraded Svc" health={health} />);

    const dot = container.querySelector('.bg-amber-400');
    expect(dot).toBeInTheDocument();
  });

  it('shows "Unreachable" badge when unreachable', () => {
    render(<ServiceHealthCard name="Down Svc" unreachable />);

    expect(screen.getByText('Unreachable')).toBeInTheDocument();
  });

  it('shows DB pool utilization bar when DB stats present', () => {
    const health = makeHealth({
      db: {
        max_open: 20,
        open: 10,
        in_use: 6,
        idle: 4,
        wait_count: 0,
        wait_duration_ms: 0,
        utilization_pct: 50,
      },
    });
    render(<ServiceHealthCard name="DB Svc" health={health} />);

    expect(screen.getByText('DB Pool')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('hides DB pool section when no DB stats', () => {
    const health = makeHealth();
    // Default makeHealth has no db field
    delete (health as unknown as Record<string, unknown>).db;
    render(<ServiceHealthCard name="No DB Svc" health={health} />);

    expect(screen.queryByText('DB Pool')).not.toBeInTheDocument();
  });
});
