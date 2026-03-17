export interface DBPoolStats {
  max_open: number;
  open: number;
  in_use: number;
  idle: number;
  wait_count: number;
  wait_duration_ms: number;
  utilization_pct: number;
}

export interface RequestStats {
  total: number;
  errors_4xx: number;
  errors_5xx: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
}

export interface RuntimeStats {
  goroutines: number;
  heap_alloc_mb: number;
  heap_sys_mb: number;
  gc_pause_ms_avg: number;
}

export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  uptime: string;
  uptime_sec: number;
  started_at: string;
  db?: DBPoolStats;
  requests: RequestStats;
  runtime: RuntimeStats;
}

export interface AggregateHealth {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  unreachable?: string[];
}
