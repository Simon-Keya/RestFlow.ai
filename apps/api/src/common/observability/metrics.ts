// apps/api/src/common/observability/metrics.ts
import {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

const enabled = process.env.METRICS_ENABLED !== 'false';

export const register = new Registry();

if (enabled) {
  collectDefaultMetrics({ register, prefix: 'restflow_' });
}

export const httpRequestsTotal = new Counter({
  name: 'restflow_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'restflow_http_request_duration_seconds',
  help: 'HTTP request latency seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

export const httpInFlight = new Gauge({
  name: 'restflow_http_in_flight',
  help: 'In-flight HTTP requests',
  registers: [register],
});

/** Low-cardinality path for Prometheus labels */
export function normalizeRoute(path: string): string {
  if (!path) return '/';
  let p = path.split('?')[0];
  p = p.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '{id}',
  );
  p = p.replace(/\/PROD-[^/]+/gi, '/{productionId}');
  p = p.replace(/\b[0-9a-f]{16,}\b/gi, '{id}');
  p = p.replace(/\/\d+(?=\/|$)/g, '/{id}');
  if (p.length > 80) p = p.slice(0, 80);
  return p;
}

export function recordHttp(
  method: string,
  path: string,
  status: number,
  durationSec: number,
) {
  if (!enabled) return;
  const route = normalizeRoute(path);
  const statusStr = String(status);
  httpRequestsTotal.inc({ method, route, status: statusStr });
  httpRequestDuration.observe(
    { method, route, status: statusStr },
    durationSec,
  );
}

export function metricsEnabled(): boolean {
  return enabled;
}
