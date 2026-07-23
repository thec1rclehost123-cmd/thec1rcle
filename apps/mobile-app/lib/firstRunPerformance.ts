import { trackFirstRun, type FirstRunMetric } from './firstRunAnalytics';

const starts = new Map<FirstRunMetric, number>();
const clock = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

export function startFirstRunMetric(metric: FirstRunMetric) {
  starts.set(metric, clock());
}

export function finishFirstRunMetric(metric: FirstRunMetric, outcome: 'success' | 'failure' = 'success') {
  const startedAt = starts.get(metric);
  if (startedAt === undefined) return null;
  starts.delete(metric);
  const durationMs = Math.max(0, Math.round(clock() - startedAt));
  trackFirstRun('first_run_performance', { metric, duration_ms: durationMs, outcome });
  return durationMs;
}

export function resetFirstRunMetricsForTests() {
  starts.clear();
}
